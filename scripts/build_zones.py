"""Zone grid around the lunar south pole for the requirements map.

For every 1 km cell (judged at its 4 highest spots, at least 200 m apart) of a 50 x 50 km box centred on the south pole (covers
Shackleton rim and Connecting Ridge) it writes:
  - slope share: % of the cell area with slope <= 1, 2, ..., 30 degrees,
    slope at a 100 m baseline from the LOLA 20 m DEM;
  - horizon: highest terrain elevation for 360 azimuth bins (1 degree) seen
    2 m above the cell centre, out to 200 km.
The app then computes Sun and Earth visibility for any date and stay in the
browser (src/scene/zones.ts) from these horizons and public/data/ephemeris.json.

Same method as scripts/build_terrain.py (rays sampled on the terrain, every
sample placed in true 3D Moon coordinates, elevation and azimuth in the local
east-north-up frame), but with coarser terrain so 2,500 horizons can be made:
LOLA 20 m to 2 km, overviews 80 m to 20 km, 160 m to 60 km and 320 m to 200 km, 720 rays.
This is screening data: a 1 km cell is much wider than the best spots
(20 to 40 m, Glaser et al. 2018).

Data: LOLA LDEM_80S_20MPP_ADJ (PGDA product 90), read by parts (no download).

Run from the project root:
    .venv/bin/python scripts/build_zones.py [--cells N]   (N = only the first N cells, to time it)
"""

import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import pyproj
import rasterio
from rasterio.windows import from_bounds

DEM_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
DEM_SOURCE = (
    "LOLA LDEM_80S_20MPP_ADJ (PGDA product 90), Barker et al. 2023, "
    "Planet. Sci. J. 4, 183, doi:10.3847/PSJ/acf3e1"
)
MOON_RADIUS_M = 1_737_400.0
OBSERVER_HEIGHT_M = 2.0
HALF_BOX_M = 25_000.0
CELL_M = 1_000.0
SLOPE_BASELINE_PX = 5  # 5 x 20 m = 100 m
SLOPE_THRESHOLDS = list(range(1, 31))
BINS = 360
RAYS = 720
POINTS_PER_CELL = 4
MIN_SEPARATION_M = 200.0
# (overview level, resolution m, from m, to m)
LEVELS = [(1, 80.0, 2_000.0, 20_000.0), (2, 160.0, 20_000.0, 60_000.0), (3, 320.0, 60_000.0, 200_000.0)]
# Close terrain decides the lowest angles: the first 2 km use the full 20 m data.
NEAR_LEVEL = (None, 20.0, 20.0, 2_000.0)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "public" / "data" / "zones"


def open_dem(level: int | None):
    url = f"/vsicurl/{DEM_URL}"
    return rasterio.open(url) if level is None else rasterio.open(url, overview_level=level)


def read(level: int | None, half: float) -> tuple[np.ndarray, rasterio.Affine]:
    with open_dem(level) as ds:
        window = from_bounds(-half, -half, half, half, ds.transform).round_offsets().round_lengths()
        return ds.read(1, window=window).astype(np.float64), ds.window_transform(window)


class Grid:
    """One DEM window with the unit vector (Moon-fixed) of every node, so rays
    can be sampled without calling the map projection for every sample."""

    def __init__(self, data: np.ndarray, transform: rasterio.Affine, to_geo: pyproj.Transformer):
        self.h = data
        self.t = transform
        rows, cols = data.shape
        cc, rr = np.meshgrid(np.arange(cols) + 0.5, np.arange(rows) + 0.5)
        x = transform.c + cc * transform.a
        y = transform.f + rr * transform.e
        lon, lat = to_geo.transform(x, y)
        lo, la = np.radians(lon), np.radians(lat)
        self.u = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])

    def sample(self, x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Bilinear sample: 3D points (..., 3) in meters and a validity mask."""
        col = (x - self.t.c) / self.t.a - 0.5
        row = (y - self.t.f) / self.t.e - 0.5
        c0 = np.floor(col).astype(np.int64)
        r0 = np.floor(row).astype(np.int64)
        fc = col - c0
        fr = row - r0
        rows, cols = self.h.shape
        ok = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < cols) & (r0 + 1 < rows)
        c0 = np.where(ok, c0, 0)
        r0 = np.where(ok, r0, 0)
        w = [(1 - fc) * (1 - fr), fc * (1 - fr), (1 - fc) * fr, fc * fr]
        idx = [(r0, c0), (r0, c0 + 1), (r0 + 1, c0), (r0 + 1, c0 + 1)]
        h = sum(wi * self.h[i] for wi, i in zip(w, idx))
        u = sum(wi[None] * self.u[:, i[0], i[1]] for wi, i in zip(w, idx))
        u = u / np.linalg.norm(u, axis=0)
        p = (MOON_RADIUS_M + h)[None] * u
        ok &= np.isfinite(h)
        return np.moveaxis(p, 0, -1), ok


def local_frame(lon_deg: float, lat_deg: float):
    lo, la = math.radians(lon_deg), math.radians(lat_deg)
    east = np.array([-math.sin(lo), math.cos(lo), 0.0])
    north = np.array([-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)])
    up = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    return east, north, up


def slope_shares(data20: np.ndarray, t20: rasterio.Affine, centers: list[tuple[float, float]]) -> np.ndarray:
    """% of each cell with slope <= each threshold (100 m baseline)."""
    k = SLOPE_BASELINE_PX
    z = data20
    # 5 x 5 box average, then differences over 5 px (100 m).
    c = np.cumsum(np.cumsum(np.pad(z, ((1, 0), (1, 0))), 0), 1)
    zs = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
    gx = (zs[:-k, k:] - zs[:-k, :-k]) / (k * t20.a)
    gy = (zs[k:, :-k] - zs[:-k, :-k]) / (k * -t20.e)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    # Pixel centre of slope[i, j] in map coordinates (offset of the box and the difference).
    offset = (k - 1) / 2 + k / 2
    out = np.zeros((len(centers), len(SLOPE_THRESHOLDS)), dtype=np.uint8)
    for n, (cx, cy) in enumerate(centers):
        c0 = int(round((cx - CELL_M / 2 - t20.c) / t20.a - offset))
        r0 = int(round((t20.f - (cy + CELL_M / 2)) / -t20.e - offset))
        size = int(round(CELL_M / t20.a))
        cell = slope[max(r0, 0) : r0 + size, max(c0, 0) : c0 + size]
        cell = cell[np.isfinite(cell)]
        if cell.size:
            out[n] = [round(100 * float(np.mean(cell <= t))) for t in SLOPE_THRESHOLDS]
    return out


def candidate_points(data20: np.ndarray, t20: rasterio.Affine, cx: float, cy: float) -> list[tuple[float, float]]:
    """The POINTS_PER_CELL highest 20 m pixels of the cell, at least MIN_SEPARATION_M apart."""
    c0 = int(round((cx - CELL_M / 2 - t20.c) / t20.a))
    r0 = int(round((t20.f - (cy + CELL_M / 2)) / -t20.e))
    size = int(round(CELL_M / t20.a))
    block = data20[r0 : r0 + size, c0 : c0 + size].copy()
    block[~np.isfinite(block)] = -np.inf
    rr, cc = np.mgrid[0:block.shape[0], 0:block.shape[1]]
    out = []
    for _ in range(POINTS_PER_CELL):
        flat = int(np.argmax(block))
        if not np.isfinite(block.flat[flat]):
            break
        r, c = divmod(flat, block.shape[1])
        out.append((t20.c + (c0 + c + 0.5) * t20.a, t20.f + (r0 + r + 0.5) * t20.e))
        block[np.hypot(rr - r, cc - c) * t20.a < MIN_SEPARATION_M] = -np.inf
    while len(out) < POINTS_PER_CELL:
        out.append((cx, cy))  # flat or empty cell: fall back to the centre
    return out


def main() -> None:
    limit = int(sys.argv[sys.argv.index("--cells") + 1]) if "--cells" in sys.argv else None
    started = time.time()
    with open_dem(None) as ds:
        crs = pyproj.CRS.from_wkt(ds.crs.to_wkt())
    to_geo = pyproj.Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
    to_map = pyproj.Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)

    n = int(2 * HALF_BOX_M / CELL_M)
    centers = [(-HALF_BOX_M + (i + 0.5) * CELL_M, HALF_BOX_M - (j + 0.5) * CELL_M) for j in range(n) for i in range(n)]
    check = "--check" in sys.argv
    if check:
        # Validation: horizons at the curated polar sites, compared below with
        # their validated 20 m horizons (public/data/<site>/horizon.json).
        from sites import SITES
        check_ids = [i for i in SITES if SITES[i]["latitude_deg"] <= -86]
        centers = [to_map.transform(SITES[i]["east_longitude_deg"], SITES[i]["latitude_deg"]) for i in check_ids]
    elif limit:
        # Spread the test cells over the box, so timing is representative.
        centers = centers[:: max(1, len(centers) // limit)][:limit]

    data20, t20 = read(None, HALF_BOX_M + 400)
    print(f"20 m window {data20.shape} read ({time.time() - started:.0f} s)")
    shares = slope_shares(data20, t20, centers)

    grids = []
    for level, res, _, dist_to in LEVELS:
        data, transform = read(level, HALF_BOX_M + dist_to + 4 * res)
        grids.append(Grid(data, transform, to_geo))
        print(f"level {res:.0f} m window {data.shape} ready ({time.time() - started:.0f} s)")
    ground_grid = Grid(data20, t20, to_geo)

    ray_az = np.radians(np.arange(RAYS) * 360 / RAYS)

    def horizon_at(px: float, py: float) -> np.ndarray:
        """Horizon (360 bins, degrees) seen 2 m above the ground at map point (px, py)."""
        lon, lat = to_geo.transform(px, py)
        east, north, up = local_frame(lon, lat)
        ground_p, _ = ground_grid.sample(np.array([px]), np.array([py]))
        observer = ground_p[0] * (1 + OBSERVER_HEIGHT_M / np.linalg.norm(ground_p[0]))
        # Local north and east as map-plane directions (the projection is conformal).
        eps = 1e-5
        xn, yn = to_map.transform(lon, lat + eps)
        xe, ye = to_map.transform(lon + eps / math.cos(math.radians(lat)), lat)
        mn = np.array([xn - px, yn - py]); mn /= np.linalg.norm(mn)
        me = np.array([xe - px, ye - py]); me /= np.linalg.norm(me)
        dirs = np.outer(np.cos(ray_az), mn) + np.outer(np.sin(ray_az), me)
        best_el = np.full(RAYS, -90.0)
        best_az = np.degrees(ray_az)
        for grid, (_, res, d_from, d_to) in zip([ground_grid, *grids], [NEAR_LEVEL, *LEVELS]):
            dist = np.arange(d_from, d_to, res)
            xs = px + dirs[:, 0:1] * dist
            ys = py + dirs[:, 1:2] * dist
            p, ok = grid.sample(xs, ys)
            d = p - observer
            el = np.degrees(np.arcsin(np.clip((d @ up) / np.linalg.norm(d, axis=-1), -1, 1)))
            el = np.where(ok, el, -90.0)
            j = np.argmax(el, axis=1)
            rows = np.arange(RAYS)
            better = el[rows, j] > best_el
            dj = d[rows, j]
            az = np.degrees(np.arctan2(dj @ east, dj @ north)) % 360
            best_el = np.where(better, el[rows, j], best_el)
            best_az = np.where(better, az, best_az)
        horizon = np.full(BINS, -90.0)
        np.maximum.at(horizon, np.round(best_az).astype(np.int64) % BINS, best_el)
        # Fill any empty bin from its neighbours (720 rays for 360 bins, so rare).
        empty = horizon <= -90
        if empty.any():
            filled = np.where(empty, np.nan, horizon)
            idx = np.arange(BINS)
            horizon = np.interp(idx, idx[~empty], filled[~empty], period=BINS)
        return horizon

    # Candidate points per cell: the highest spots (rims and ridges get the most
    # light, Glaser et al. 2018), at least MIN_SEPARATION_M apart. The check mode
    # uses the exact site points instead.
    if check:
        points = [[c] for c in centers]
    else:
        points = [candidate_points(data20, t20, cx, cy) for cx, cy in centers]
    per_cell = 1 if check else POINTS_PER_CELL
    horizons = np.zeros((len(centers), per_cell, BINS), dtype=np.int16)
    cells = []
    t_h = time.time()
    total = len(centers) * per_cell
    for n_cell, (cx, cy) in enumerate(centers):
        for k, (px, py) in enumerate(points[n_cell]):
            horizons[n_cell, k] = np.round(horizon_at(px, py) * 100).astype(np.int16)
        lon, lat = to_geo.transform(cx, cy)
        corners = []
        for dx, dy in ((-1, 1), (1, 1), (1, -1), (-1, -1)):
            x, y = cx + dx * CELL_M / 2, cy + dy * CELL_M / 2
            if abs(x) < 1e-6 and abs(y) < 1e-6:
                # A corner exactly on the pole has no longitude: nudge it 1 m into the cell.
                x, y = x - dx, y - dy
            clon, clat = to_geo.transform(x, y)
            corners.append([round(clon, 6), round(clat, 6)])
        point_lonlat = [[round(v, 6) for v in to_geo.transform(px, py)] for px, py in points[n_cell]]
        cells.append({"lon": round(lon, 6), "lat": round(lat, 6), "corners": corners, "points": point_lonlat})
        done = (n_cell + 1) * per_cell
        if n_cell % 100 == 0 or n_cell == len(centers) - 1:
            per = (time.time() - t_h) / done
            print(f"cell {n_cell + 1}/{len(centers)}  {per:.2f} s per point, about {per * (total - done) / 60:.0f} min left", flush=True)

    if check:
        for site_id, row in zip(check_ids, horizons[:, 0]):
            ref = np.array(json.loads((PROJECT_ROOT / "public" / "data" / site_id / "horizon.json").read_text())["elevationDeg"])
            # Reference is 0.25 degree bins: take the max of the bins inside each 1 degree bin.
            ref1 = np.max(np.roll(ref, 2).reshape(BINS, -1), axis=1)
            diff = row / 100 - ref1
            print(f"{site_id}: zone method - site horizon: mean {diff.mean():+.2f} deg, "
                  f"median |d| {np.median(np.abs(diff)):.2f}, p95 |d| {np.percentile(np.abs(diff), 95):.2f}, max |d| {np.abs(diff).max():.2f}")
        return
    if limit:
        print("Timing run only, nothing written.")
        return
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "south-pole-1km-horizons.bin").write_bytes(horizons.tobytes())
    (OUT_DIR / "south-pole-1km-slope.bin").write_bytes(shares.tobytes())
    meta = {
        "id": "south-pole-1km",
        "cellSizeM": CELL_M,
        "boxHalfSizeM": HALF_BOX_M,
        "count": len(cells),
        "horizonFile": "south-pole-1km-horizons.bin",
        "pointsPerCell": POINTS_PER_CELL,
        "horizonFormat": "int16 little-endian, cells x points x 360, degrees x 100, bin k = azimuth k degrees (clockwise from north)",
        "slopeFile": "south-pole-1km-slope.bin",
        "slopeFormat": "uint8, cells x 30, % of the cell area with slope <= 1..30 degrees (100 m baseline)",
        "slopeThresholdsDeg": SLOPE_THRESHOLDS,
        "observerHeightM": OBSERVER_HEIGHT_M,
        "cells": cells,
        "provenance": {
            "source": DEM_SOURCE,
            "method": "scripts/build_zones.py; terrain 20 m to 2 km, 80 m to 20 km, 160 m to 60 km, 320 m to 200 km; 720 rays",
            "generatedUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }
    (OUT_DIR / "south-pole-1km.json").write_text(json.dumps(meta))
    print(f"Wrote {len(cells)} cells in {(time.time() - started) / 60:.1f} min")


if __name__ == "__main__":
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        GDAL_HTTP_MAX_RETRY="8",
        GDAL_HTTP_RETRY_DELAY="3",
        GDAL_HTTP_RETRY_CODES="403,429,500,502,503,504",
    ):
        main()
