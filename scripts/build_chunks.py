"""Cut the two LOLA elevation files into small terrain tiles for the browser.

"Horizon view anywhere" (docs/HORIZON_ANYWHERE_PLAN.md): the browser loads only
the tiles around the point the user picks. Heights are stored losslessly
(bit-for-bit the same values as the source files).

Sources (read from <terrain folder>/source, or over the internet with --remote):
  global-118m  Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif (USGS), int16 x 0.5 m
  south-*      LDEM_80S_20MPP_ADJ.TIF (PGDA product 90), float32 m, levels
               20 / 80 / 160 / 320 / 640 m (the file's own overviews, the same
               levels scripts/build_terrain.py reads)

Tile format (described in manifest.json, decoded by the app):
  512 x 512 values, row-major, little-endian, then zlib (deflate).
  int16  "delta-row": each value minus its left neighbour (uint16 wrap-around).
  float32 "shuffle-delta-row": the 4 bytes of each value split into 4 planes,
          then each byte minus its left neighbour (uint8 wrap-around).
  Both are exactly reversible. Tiles with no data at all are not written and
  are listed in manifest.json ("missing"), so the app never asks for them.

Commands:
  build    build tiles (skips tiles already on disk, so it can be re-run)
  verify   decode random tiles and compare them bit-for-bit with the source
  check    count files and bytes against 95% of the Cloudflare R2 free tier
  --test   with build: only a few tiles (one global band, polar tiles around
           Shackleton rim) to check the method before the full run

Output folder: %USERPROFILE%/concorde-terrain-tiles-2026 (override with
TERRAIN_TILES_DIR). It is outside the repository. No command here removes it.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import zlib
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.env import Env
from rasterio.windows import Window

TILE = 512
ZLIB_LEVEL = 9

TERRAIN_DIR = Path(os.environ.get("TERRAIN_TILES_DIR", Path.home() / "concorde-terrain-tiles-2026"))
SOURCE_DIR = TERRAIN_DIR / "source"
TILES_DIR = TERRAIN_DIR / "tiles"

GLOBAL = {
    "file": "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
    "url": "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
    "public_url": "https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
    "bytes": 8_494_203_833,
    "credit": "LRO LOLA Global LDEM 118 m (Mar 2014), USGS Astrogeology",
}
SOUTH = {
    "file": "LDEM_80S_20MPP_ADJ.TIF",
    "url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
    "public_url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
    "bytes": 2_696_082_051,
    "credit": "LOLA LDEM_80S_20MPP_ADJ (PGDA product 90), Barker et al. 2023",
}
# (overview level for rasterio, factor): None = full 20 m data.
SOUTH_LEVELS = [(None, 1), (1, 4), (2, 8), (3, 16), (4, 32)]

# Cloudflare R2 free tier (pricing page, 2026-10-30) and the 95% ceiling.
FREE_STORAGE_BYTES = 10 * 10**9
FREE_CLASS_A = 1_000_000
CEILING = 0.95

# Test area: Shackleton rim (scripts/sites.py) and the Apollo 11 band.
SHACKLETON = (-89.7849, 203.97)
APOLLO_11_LAT = 0.67416

# Same retries as scripts/build_terrain.py: PGDA answers 403 to bursts of
# range requests, then accepts again (PROJECT_MEMORY.md problem #9).
GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF",
    "GDAL_HTTP_MAX_RETRY": "8",
    "GDAL_HTTP_RETRY_DELAY": "3",
    "GDAL_HTTP_RETRY_CODES": "403,429,500,502,503,504",
}


# ---------- encoding (the app's decoder must mirror these exactly) ----------

def encode_int16(a: np.ndarray) -> bytes:
    u = np.ascontiguousarray(a, dtype="<i2").view("<u2")
    out = u.copy()
    out[:, 1:] = u[:, 1:] - u[:, :-1]  # uint16 arithmetic wraps
    return zlib.compress(out.tobytes(), ZLIB_LEVEL)


def decode_int16(data: bytes) -> np.ndarray:
    d = np.frombuffer(zlib.decompress(data), dtype="<u2").reshape(TILE, TILE)
    return np.cumsum(d, axis=1, dtype=np.uint16).view("<i2")


def encode_float32(a: np.ndarray) -> bytes:
    b = np.ascontiguousarray(a, dtype="<f4").view(np.uint8).reshape(TILE, TILE, 4)
    planes = np.ascontiguousarray(b.transpose(2, 0, 1))  # 4 x 512 x 512
    out = planes.copy()
    out[:, :, 1:] = planes[:, :, 1:] - planes[:, :, :-1]  # uint8 wraps
    return zlib.compress(out.tobytes(), ZLIB_LEVEL)


def decode_float32(data: bytes) -> np.ndarray:
    d = np.frombuffer(zlib.decompress(data), dtype=np.uint8).reshape(4, TILE, TILE)
    planes = np.cumsum(d, axis=2, dtype=np.uint8)
    return np.ascontiguousarray(planes.transpose(1, 2, 0)).view("<f4").reshape(TILE, TILE)


# ---------- helpers ----------

def source_path(src: dict, remote: bool) -> str:
    if remote:
        return f"/vsicurl/{src['url']}"
    path = SOURCE_DIR / src["file"]
    if not path.exists() or path.stat().st_size != src["bytes"]:
        have = path.stat().st_size if path.exists() else 0
        sys.exit(f"{path} is not complete ({have} of {src['bytes']} bytes). Finish the download or use --remote.")
    return str(path)


def tile_path(layer_id: str, row: int, col: int) -> Path:
    return TILES_DIR / layer_id / str(row) / f"{col}.bin"


def write_tile(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(path)  # never leaves a half-written tile


def read_padded(ds, row0: int, col0: int, rows: int, cols: int, fill) -> np.ndarray:
    """Read a window; parts outside the raster are filled with `fill`."""
    out = np.full((rows, cols), fill, dtype=ds.dtypes[0])
    r0, c0 = max(row0, 0), max(col0, 0)
    r1, c1 = min(row0 + rows, ds.height), min(col0 + cols, ds.width)
    if r1 > r0 and c1 > c0:
        out[r0 - row0 : r1 - row0, c0 - col0 : c1 - col0] = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0))
    return out


def layer_entry(layer_id: str, src: dict, ds, factor: int, dtype: str, encoding: str, scale: float, nodata) -> dict:
    t = ds.transform
    return {
        "id": layer_id,
        "source": src["credit"],
        "sourceUrl": src["public_url"],
        "crsWkt": ds.crs.to_wkt(),
        "pixelSizeM": t.a,
        "originX": t.c,  # map x of the top-left corner of pixel (0, 0)
        "originY": t.f,  # map y of that corner (y grows north / up)
        "width": ds.width,
        "height": ds.height,
        "tileSize": TILE,
        "rows": -(-ds.height // TILE),
        "cols": -(-ds.width // TILE),
        "dtype": dtype,
        "scale": scale,  # height in m = stored value x scale
        "nodata": nodata,
        "encoding": encoding,
        "path": f"{layer_id}/{{row}}/{{col}}.bin",
        "overviewFactor": factor,
        "missing": [],
    }


# ---------- build ----------

def build_global(remote: bool, test: bool) -> dict:
    with rasterio.open(source_path(GLOBAL, remote)) as ds:
        entry = layer_entry("global-118m", GLOBAL, ds, 1, "int16", "delta-row-int16+zlib", 0.5, -32768)
        rows, cols = entry["rows"], entry["cols"]
        band_rows = range(rows)
        if test:  # one band: the tile row that contains Apollo 11
            y = np.radians(APOLLO_11_LAT) * 1_737_400
            band_rows = [int((ds.transform.f - y) / -ds.transform.e) // TILE]
        start = time.time()
        for i, r in enumerate(band_rows):
            if all(tile_path("global-118m", r, c).exists() for c in range(cols)):
                continue
            band = read_padded(ds, r * TILE, 0, TILE, cols * TILE, -32768)
            for c in range(cols):
                p = tile_path("global-118m", r, c)
                if not p.exists():
                    write_tile(p, encode_int16(band[:, c * TILE : (c + 1) * TILE]))
            done = i + 1
            eta = (time.time() - start) / done * (len(band_rows) - done)
            print(f"global-118m band {r} ({done}/{len(band_rows)}), about {eta / 60:.0f} min left", flush=True)
    return entry


def build_south(remote: bool, test: bool) -> list[dict]:
    entries = []
    path = source_path(SOUTH, remote)
    for level, factor in SOUTH_LEVELS:
        layer_id = f"south-{20 * factor}m"
        with rasterio.open(path, overview_level=level) as ds:
            entry = layer_entry(layer_id, SOUTH, ds, factor, "float32", "shuffle-delta-row-float32+zlib", 1.0, "nan")
            # The overview's own transform must give exactly 20 m x factor.
            if abs(entry["pixelSizeM"] - 20.0 * factor) > 1e-9:
                sys.exit(f"{layer_id}: pixel size {entry['pixelSizeM']} m, expected {20 * factor} m")
            tiles = [(r, c) for r in range(entry["rows"]) for c in range(entry["cols"])]
            if test:  # only the tiles around Shackleton rim, at every level
                geo = Transformer.from_crs(CRS(ds.crs.to_wkt()).geodetic_crs, CRS(ds.crs.to_wkt()), always_xy=True)
                x, y = geo.transform(SHACKLETON[1], SHACKLETON[0])
                col = int((x - entry["originX"]) / entry["pixelSizeM"]) // TILE
                row = int((entry["originY"] - y) / entry["pixelSizeM"]) // TILE
                tiles = [
                    (r, c)
                    for r in range(max(row - 1, 0), min(row + 2, entry["rows"]))
                    for c in range(max(col - 1, 0), min(col + 2, entry["cols"]))
                ]
            written = 0
            for r, c in tiles:
                p = tile_path(layer_id, r, c)
                if p.exists():
                    written += 1
                    continue
                a = read_padded(ds, r * TILE, c * TILE, TILE, TILE, np.float32("nan"))
                if np.isnan(a).all():
                    entry["missing"].append(f"{r},{c}")
                    continue
                write_tile(p, encode_float32(a))
                written += 1
            print(f"{layer_id}: {written} tiles, {len(entry['missing'])} empty (not written)", flush=True)
            if test:
                entry["note"] = "test build: only some tiles exist"
            entries.append(entry)
    return entries


def cmd_build(args) -> None:
    TILES_DIR.mkdir(parents=True, exist_ok=True)
    layers = []
    with Env(**GDAL_ENV):
        if args.only in (None, "south"):
            layers += build_south(args.remote, args.test)
        if args.only in (None, "global"):
            layers.append(build_global(args.remote, args.test))
    manifest_path = TILES_DIR / "manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"layers": []}
    merged = {l["id"]: l for l in old["layers"]}
    merged.update({l["id"]: l for l in layers})
    manifest = {
        "version": 1,
        "createdUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generator": "scripts/build_chunks.py",
        "test": bool(args.test),
        "layers": sorted(merged.values(), key=lambda l: l["id"]),
    }
    manifest_path.write_text(json.dumps(manifest, indent=1))
    print(f"Wrote {manifest_path}")
    cmd_check(args)


# ---------- verify ----------

def cmd_verify(args) -> None:
    manifest = json.loads((TILES_DIR / "manifest.json").read_text())
    rng = random.Random(42)
    checked = 0
    with Env(**GDAL_ENV):
        for entry in manifest["layers"]:
            src = GLOBAL if entry["id"].startswith("global") else SOUTH
            level = dict((20 * f, lv) for lv, f in SOUTH_LEVELS).get(int(entry["id"].split("-")[1][:-1])) if src is SOUTH else None
            existing = sorted((TILES_DIR / entry["id"]).glob("*/*.bin"))
            if not existing:
                continue
            with rasterio.open(source_path(src, args.remote), overview_level=level) as ds:
                for p in rng.sample(existing, min(args.samples, len(existing))):
                    r, c = int(p.parent.name), int(p.stem)
                    data = p.read_bytes()
                    if entry["dtype"] == "int16":
                        got = decode_int16(data)
                        want = read_padded(ds, r * TILE, c * TILE, TILE, TILE, -32768)
                        same = np.array_equal(got, want)
                    else:
                        got = decode_float32(data)
                        want = read_padded(ds, r * TILE, c * TILE, TILE, TILE, np.float32("nan"))
                        same = np.array_equal(got.view(np.uint32), want.astype("<f4").view(np.uint32))
                    checked += 1
                    if not same:
                        sys.exit(f"MISMATCH in {p}")
            print(f"{entry['id']}: sampled tiles are bit-for-bit identical to the source")
    print(f"verify: {checked} tiles checked, all identical")


# ---------- check (95% of the free tier) ----------

def cmd_check(args) -> None:
    files = [p for p in TILES_DIR.rglob("*") if p.is_file() and p.suffix in (".bin", ".json")]
    total = sum(p.stat().st_size for p in files)
    # Uploading one file = one PutObject (Class A); listing costs about 1 per 1000 files.
    class_a = len(files) + len(files) // 1000 + 1 + args.class_a_used
    limits_ok = total <= CEILING * FREE_STORAGE_BYTES and class_a <= CEILING * FREE_CLASS_A
    print(
        f"check: {len(files):,} files, {total / 1e9:.2f} GB "
        f"(limit {CEILING * FREE_STORAGE_BYTES / 1e9:.1f} GB = 95% of the free 10 GB); "
        f"upload needs about {class_a:,} Class A operations "
        f"(limit {int(CEILING * FREE_CLASS_A):,} = 95% of the free 1,000,000 per month)"
    )
    print("check: OK to upload" if limits_ok else "check: STOP - over 95% of the free tier, do not upload")
    if not limits_ok:
        sys.exit(2)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["build", "verify", "check"])
    parser.add_argument("--only", choices=["global", "south"], help="build one source only")
    parser.add_argument("--test", action="store_true", help="build only a few tiles")
    parser.add_argument("--remote", action="store_true", help="read the sources over the internet")
    parser.add_argument("--samples", type=int, default=25, help="verify: tiles per layer")
    parser.add_argument("--class-a-used", type=int, default=0, help="check: Class A operations already used this month")
    args = parser.parse_args()
    {"build": cmd_build, "verify": cmd_verify, "check": cmd_check}[args.command](args)


if __name__ == "__main__":
    main()
