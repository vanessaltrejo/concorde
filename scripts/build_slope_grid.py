"""Build a global slope grid for the whole-Moon requirements map (SLDEM2015 slope).

Reads the NASA global slope map and, for every map cell, stores what share of
its surface has a slope at or below 1, 2, ... 30 degrees. The app uses this
table to colour a cell when the user moves the slope limit (same 1..30 degree
steps as the south pole zone grid, scripts/build_zones.py).

Input (download it yourself, it is 16,986,931,200 bytes, about 17 GB):
    SLDEM2015_256_SL_90S_90N_000_360.IMG   (+ the small .LBL label next to it)
    https://imbrium.mit.edu/DATA/SLDEM2015_SLOPE/GLOBAL/FLOAT_IMG/
    Product page: https://pgda.gsfc.nasa.gov/products/67 (SLDEM2015 slope)
The label says: 256 pixels per degree (0.118451 km per pixel), SLDEM2015 between
60 N and 60 S, LOLA only closer to the poles. The slope baseline is assumed to be
about one pixel (about 118 m); the label does not state it, so this is not verified.

Run from the project root:
    python scripts/build_slope_grid.py --img PATH/SLDEM2015_256_SL_90S_90N_000_360.IMG

Writes public/data/global/slope_fraction.bin and slope_fraction.json (0.5 degree cells).

With --fine it writes public/data/global/slope_p90.bin and slope_p90.json instead:
1/16 degree cells (about 2 km, 5760 x 2880, 16.6 MB), one byte each: the slope
under which 90 % of the cell lies. That file only serves the 90 % rule.
The table keeps every 1..30 degree share, so the app's area rule can change
without running this script again (the printed summary uses the current 90 % rule).
Only numpy and the Python standard library are used. Self-test (no data):
    python scripts/build_slope_grid.py --selftest
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

# Slope limits stored in the table: 1, 2, ... 30 degrees (as in build_zones.py).
THRESHOLDS_DEG = np.arange(1, 31, dtype=np.float64)
# One byte per value: percent of the cell area (0 to 100).
CHANNELS = len(THRESHOLDS_DEG) + 1  # 30 slope fractions + 1 "valid data" share
VALID_CHANNEL = CHANNELS - 1

# Team rule (same as src/scene/zones.ts): a cell passes the slope requirement
# when at least this share of its area is under the limit. Used only for the summary.
MIN_SLOPE_AREA_PERCENT = 90
DEFAULT_LIMIT_DEG = 10
# The fine (--fine) table stores one value per cell for this rule only; the app
# checks the number in the .json and ignores the file if its own rule differs.
P90_AREA_PERCENT = MIN_SLOPE_AREA_PERCENT
FINE_CELL_DEG = 1 / 16  # about 1.9 km at the equator


def parse_label(path: Path) -> dict:
    """Read the PDS3 label into a flat dict of KEY -> text (last value wins)."""
    values = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.split("/*")[0].strip()
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip().upper()] = value.strip().strip('"')
    return values


def read_layout(label: dict, file_size: int, trust_layout: bool) -> dict:
    """Check the label says what this script assumes. Stop if anything is off."""
    problems = []

    def number(key):
        try:
            return float(label[key].split()[0])
        except (KeyError, ValueError, IndexError):
            return None

    lines, samples = number("LINES"), number("LINE_SAMPLES")
    bits = number("SAMPLE_BITS")
    sample_type = label.get("SAMPLE_TYPE", "").upper()
    if None in (lines, samples):
        problems.append("LINES or LINE_SAMPLES not found in the label")
    if bits != 32:
        problems.append(f"SAMPLE_BITS is {bits}, expected 32")
    if "REAL" not in sample_type:
        problems.append(f"SAMPLE_TYPE is '{sample_type}', expected a REAL type")
    if lines and samples and int(lines) * int(samples) * 4 != file_size:
        problems.append(
            f"label size {int(lines)} x {int(samples)} x 4 bytes does not match "
            f"the file size {file_size} (download not finished?)"
        )

    # The 256 ppd label has no UNIT field. Accept degrees when the image is named
    # SLOPE and its maximum is at most 90 (radians would be at most 1.571).
    unit_text = " ".join(v for k, v in label.items() if "UNIT" in k).upper()
    maximum = number("MAXIMUM")
    looks_like_degrees = label.get("NAME", "").upper() == "SLOPE" and maximum is not None and 1.6 < maximum <= 90
    if "DEG" not in unit_text and not looks_like_degrees:
        problems.append("the label does not show the slope is in degrees")

    checks = {
        "MAXIMUM_LATITUDE": 90.0,
        "MINIMUM_LATITUDE": -90.0,
        "WESTERNMOST_LONGITUDE": 0.0,
        "EASTERNMOST_LONGITUDE": 360.0,
    }
    for key, expected in checks.items():
        found = number(key)
        if found is None:
            problems.append(f"{key} not in the label (needed to check the layout)")
        elif abs(found - expected) > 1e-6:
            problems.append(f"{key} is {found}, expected {expected}")

    if problems:
        print("The label does not match what this script expects:")
        for p in problems:
            print(f"  - {p}")
        if not trust_layout:
            print("Check the label by hand. If you are sure the layout is north-up,")
            print("longitude 0 to 360 from the left, degrees, run again with --trust-layout.")
            sys.exit(1)
        print("Continuing because of --trust-layout.")

    # PDS3: PC_REAL / LSB_IEEE_REAL = little endian, IEEE_REAL / MSB_IEEE_REAL = big endian.
    little = sample_type.startswith(("PC_", "LSB"))
    return {
        "lines": int(lines),
        "samples": int(samples),
        "dtype": "<f4" if little else ">f4",
        "missing": number("MISSING_CONSTANT"),
        "ppd": number("MAP_RESOLUTION"),
        "km_per_pixel": number("MAP_SCALE"),
    }


def aggregate_band(slope, weights, cells_lon):
    """Weighted share of area with slope <= each limit, for one band of cells.

    slope: (rows, cells_lon * px) array in degrees, NaN or non-finite = no data.
    weights: (rows,) area weight of each pixel row (cos of its latitude).
    Returns an array (cells_lon, CHANNELS) with percentages 0 to 100.
    """
    rows, width = slope.shape
    px = width // cells_lon
    valid = np.isfinite(slope) & (slope >= 0)
    w = np.broadcast_to(weights[:, None], slope.shape)

    # Index of the first limit that is >= slope; slopes above 30 get index 30.
    bin_index = np.searchsorted(THRESHOLDS_DEG, np.where(valid, slope, 0.0), side="left")
    cell_of_col = np.repeat(np.arange(cells_lon), px)
    cell = np.broadcast_to(cell_of_col[None, :], slope.shape)
    nbins = len(THRESHOLDS_DEG) + 1

    flat = (cell * nbins + bin_index)[valid]
    counts = np.bincount(flat, weights=w[valid], minlength=cells_lon * nbins)
    counts = counts.reshape(cells_lon, nbins)
    valid_weight = counts.sum(axis=1)
    total_weight = np.bincount(cell.ravel(), weights=w.ravel(), minlength=cells_lon)

    out = np.zeros((cells_lon, CHANNELS), dtype=np.uint8)
    has_data = valid_weight > 0
    cumulative = np.cumsum(counts[:, : len(THRESHOLDS_DEG)], axis=1)
    fractions = np.zeros_like(cumulative)
    fractions[has_data] = cumulative[has_data] / valid_weight[has_data, None]
    out[:, : len(THRESHOLDS_DEG)] = np.rint(fractions * 100).astype(np.uint8)
    out[:, VALID_CHANNEL] = np.rint(100 * valid_weight / np.maximum(total_weight, 1e-12)).astype(np.uint8)
    return out


def p90_band(slope, px):
    """Slope under which 90 % of each px x px block lies, in 1/8 degree steps.

    slope: (px, cells_lon * px) array in degrees (no missing values expected).
    A block passes a limit L (whole degrees) when at least 90 % of its pixels
    are <= L, that is when its k-th smallest value is <= L, with
    k = ceil(0.9 * px * px). Storing ceil(that value * 8) keeps this exact:
    ceil(v * 8) <= 8 * L  <=>  v <= L. 255 means steeper than 31.75 degrees.
    Pixels in a block are not area weighted (a block spans 1/16 degree of latitude).
    """
    rows, width = slope.shape
    cells = width // px
    blocks = slope.reshape(rows, cells, px).transpose(1, 0, 2).reshape(cells, rows * px)
    blocks = np.where(np.isfinite(blocks), blocks, np.inf)  # no data counts as too steep
    k = int(np.ceil(P90_AREA_PERCENT / 100 * rows * px)) - 1
    value = np.partition(blocks, k, axis=1)[:, k]
    return np.minimum(np.ceil(value * 8), 255).astype(np.uint8)


def selftest() -> None:
    """Check aggregate_band and the unit check on inputs whose answer is known by hand."""
    cells_lon, px = 2, 4
    weights = np.ones(px)
    slope = np.zeros((px, cells_lon * px))
    slope[:, :px] = 3.0  # cell 0: every pixel at 3 degrees
    slope[:, px:] = 9.0  # cell 1: every pixel at 9 degrees
    slope[0, px:] = 35.0  # cell 1: one row (25 %) steeper than 30 degrees
    slope[3, px:] = np.nan  # cell 1: one row (25 %) with no data
    out = aggregate_band(slope, weights, cells_lon)
    assert out[0, 2] == 100 and out[0, 1] == 0, out[0]  # <=3 deg yes, <=2 deg no
    assert out[0, VALID_CHANNEL] == 100  # all valid
    # Cell 1: 3 valid rows of 4; 2 rows at 9 deg, 1 row at 35 deg.
    assert out[1, 7] == 0 and out[1, 8] == 67 and out[1, 29] == 67, out[1]  # <=8 no, <=9 and <=30 yes
    assert out[1, VALID_CHANNEL] == 75, out[1]
    # Weights: a pixel row with weight 3 counts three times a row with weight 1.
    heavy = aggregate_band(np.array([[2.0, 2.0], [40.0, 40.0]]), np.array([1.0, 3.0]), 1)
    assert heavy[0, 4] == 25, heavy[0]  # 1 / (1 + 3) of the area is <= 5 deg

    # Fine table: 4 x 4 blocks (16 pixels, 90 % = 15 pixels must be <= the limit).
    fine = np.full((4, 8), 3.0)
    fine[0, 0] = 25.0  # block 0: 1 of 16 pixels steep -> 15 of 16 at 3 deg -> passes 3
    fine[0:2, 4:6] = 25.0  # block 1: 4 of 16 steep -> only 12 at 3 deg -> 25 deg value
    fine[3, 7] = 10.01  # block 1 also has one pixel just above 10
    p90 = p90_band(fine, 4)
    assert p90[0] == 24, p90  # 3 deg * 8; passes L=3 (24 <= 24), fails L=2
    assert p90[1] == 200, p90  # 25 deg * 8
    edge = p90_band(np.array([[10.0, 10.0], [10.0, 10.001]]), 2)  # k = ceil(0.9 * 4) - 1 = 3
    assert edge[0] == 81, edge  # 10.001 deg -> ceil(80.008) = 81 -> fails L=10, passes L=11

    # Unit check: the real 256 ppd label has NAME = SLOPE, MAXIMUM = 89.053, no UNIT.
    base = {
        "LINES": "2", "LINE_SAMPLES": "2", "SAMPLE_BITS": "32", "SAMPLE_TYPE": "PC_REAL",
        "NAME": "SLOPE", "MAXIMUM": "89.053", "MAXIMUM_LATITUDE": "90 <deg>",
        "MINIMUM_LATITUDE": "-90 <deg>", "WESTERNMOST_LONGITUDE": "0 <deg>",
        "EASTERNMOST_LONGITUDE": "360 <deg>", "MAP_RESOLUTION": "256 <pix/deg>",
    }
    assert read_layout(base, 16, False)["dtype"] == "<f4"
    try:
        read_layout({**base, "MAXIMUM": "1.55"}, 16, False)  # looks like radians: must stop
        raise AssertionError("radian-like maximum was accepted")
    except SystemExit:
        pass
    print("self-test passed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--img", type=Path, help="path to the global slope .IMG file")
    parser.add_argument("--lbl", type=Path, help="label file (default: same name, .LBL)")
    parser.add_argument("--cell-deg", type=float, default=0.5, help="cell size in degrees")
    parser.add_argument("--out-dir", type=Path, default=Path("public/data/global"))
    parser.add_argument("--trust-layout", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument(
        "--fine",
        action="store_true",
        help="write slope_p90.bin instead: one byte per 1/16 degree cell (about 2 km), "
        "the slope under which 90 %% of the cell lies",
    )
    args = parser.parse_args()

    if args.selftest:
        selftest()
        return
    if args.img is None:
        parser.error("--img is required")
    lbl_path = args.lbl or args.img.with_suffix(".LBL")
    if not args.img.exists() or not lbl_path.exists():
        sys.exit(f"Missing file: {args.img if not args.img.exists() else lbl_path}")

    label = parse_label(lbl_path)
    layout = read_layout(label, args.img.stat().st_size, args.trust_layout)
    if args.fine:
        write_fine(args, layout)
        return
    lines, samples = layout["lines"], layout["samples"]
    cells_lat, cells_lon = round(180 / args.cell_deg), round(360 / args.cell_deg)
    if lines % cells_lat or samples % cells_lon:
        sys.exit(f"{lines} x {samples} pixels do not divide into {cells_lat} x {cells_lon} cells")
    rows_per_cell = lines // cells_lat
    print(f"Image {samples} x {lines}, cells {cells_lon} x {cells_lat}, {rows_per_cell} pixel rows per cell")

    image = np.memmap(args.img, dtype=layout["dtype"], mode="r", shape=(lines, samples))
    row_lat = 90 - (np.arange(lines) + 0.5) * 180 / lines  # pixel-centre latitude
    row_weight = np.cos(np.radians(row_lat))  # ground area of a pixel shrinks with latitude

    table = np.zeros((cells_lat, cells_lon, CHANNELS), dtype=np.uint8)
    seen_min, seen_max = np.inf, -np.inf
    started = time.time()
    for band in range(cells_lat):
        r0, r1 = band * rows_per_cell, (band + 1) * rows_per_cell
        data = np.array(image[r0:r1], dtype=np.float64)
        if layout["missing"] is not None:
            data[data == layout["missing"]] = np.nan
        finite = data[np.isfinite(data)]
        if finite.size:
            seen_min, seen_max = min(seen_min, finite.min()), max(seen_max, finite.max())
        table[band] = aggregate_band(data, row_weight[r0:r1], cells_lon)
        if band % 30 == 0:
            print(f"  band {band + 1}/{cells_lat} ({time.time() - started:.0f} s)", flush=True)

    print(f"Slope values seen: min {seen_min:.3f}, max {seen_max:.3f} (degrees expected, check)")
    has_data = table[:, :, VALID_CHANNEL] > 0
    passes = (table[:, :, DEFAULT_LIMIT_DEG - 1] >= MIN_SLOPE_AREA_PERCENT) & has_data
    print(
        f"Cells with >= {MIN_SLOPE_AREA_PERCENT} % of their area at <= {DEFAULT_LIMIT_DEG} degrees: "
        f"{passes.mean() * 100:.1f} % of all cells; cells with no data: {(~has_data).sum()}"
    )

    ppd, km = layout["ppd"], layout["km_per_pixel"]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    table.tofile(args.out_dir / "slope_fraction.bin")
    meta = {
        "description": "Share of each cell's area with slope at or below a limit.",
        "layout": "uint8, row-major [lat row][lon column][channel]; row 0 is the north edge "
        "(+90), column 0 starts at longitude 0 east, both increase south and east.",
        "cell_deg": args.cell_deg,
        "cells_lat": cells_lat,
        "cells_lon": cells_lon,
        "channels": [f"share (percent) of valid area with slope <= {int(t)} deg" for t in THRESHOLDS_DEG]
        + ["share (percent) of the cell with valid slope data"],
        "weighting": "pixels weighted by cos(latitude) (ground area)",
        "source_file": args.img.name,
        "source_label_unit_note": "label has no unit field; degrees inferred from NAME = SLOPE and MAXIMUM <= 90",
        "source": "SLDEM2015 slope, LOLA science team, PGDA product 67 "
        "(https://pgda.gsfc.nasa.gov/products/67); SLDEM2015 between 60 N and 60 S, LOLA only nearer the poles",
        "pixels_per_degree": ppd,
        "km_per_pixel": km,
        "baseline_note": f"slope baseline assumed to be about one pixel ({km * 1000:.0f} m); not stated in the label"
        if km
        else "slope baseline unknown",
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    (args.out_dir / "slope_fraction.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Wrote {args.out_dir}/slope_fraction.bin ({table.nbytes / 1e6:.1f} MB) and .json")


def write_fine(args, layout) -> None:
    """Fine table: one byte per 1/16 degree cell (see p90_band)."""
    lines, samples = layout["lines"], layout["samples"]
    cells_lat, cells_lon = round(180 / FINE_CELL_DEG), round(360 / FINE_CELL_DEG)
    if lines % cells_lat or samples % cells_lon or lines // cells_lat != samples // cells_lon:
        sys.exit(f"{lines} x {samples} pixels do not divide into {cells_lat} x {cells_lon} square cells")
    px = lines // cells_lat
    print(f"Image {samples} x {lines}, fine cells {cells_lon} x {cells_lat}, {px} x {px} pixels per cell")
    image = np.memmap(args.img, dtype=layout["dtype"], mode="r", shape=(lines, samples))
    table = np.zeros((cells_lat, cells_lon), dtype=np.uint8)
    started = time.time()
    for band in range(cells_lat):
        data = np.array(image[band * px : (band + 1) * px], dtype=np.float32)
        if layout["missing"] is not None:
            data[data == layout["missing"]] = np.nan
        table[band] = p90_band(data, px)
        if band % 240 == 0:
            print(f"  band {band + 1}/{cells_lat} ({time.time() - started:.0f} s)", flush=True)

    passes = (table <= DEFAULT_LIMIT_DEG * 8).mean() * 100
    print(f"Fine cells with >= {P90_AREA_PERCENT} % of their area at <= {DEFAULT_LIMIT_DEG} degrees: {passes:.1f} %")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    table.tofile(args.out_dir / "slope_p90.bin")
    km = layout["km_per_pixel"]
    meta = {
        "description": f"Slope (degrees x 8, rounded up) under which {P90_AREA_PERCENT} % of each cell lies.",
        "layout": "uint8, row-major [lat row][lon column]; row 0 is the north edge (+90), "
        "column 0 starts at longitude 0 east. 255 = steeper than 31.75 degrees or no data.",
        "use": "a cell passes a whole-degree limit L when value <= 8 * L",
        "area_percent": P90_AREA_PERCENT,
        "cell_deg": FINE_CELL_DEG,
        "cells_lat": cells_lat,
        "cells_lon": cells_lon,
        "pixels_per_cell": px * px,
        "weighting": "none inside a cell (a cell spans 1/16 degree of latitude)",
        "source_file": args.img.name,
        "source": "SLDEM2015 slope, LOLA science team, PGDA product 67 "
        "(https://pgda.gsfc.nasa.gov/products/67); SLDEM2015 between 60 N and 60 S, LOLA only nearer the poles",
        "km_per_pixel": km,
        "baseline_note": f"slope baseline assumed to be about one pixel ({km * 1000:.0f} m); not stated in the label"
        if km
        else "slope baseline unknown",
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    (args.out_dir / "slope_p90.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Wrote {args.out_dir}/slope_p90.bin ({table.nbytes / 1e6:.1f} MB) and .json")


if __name__ == "__main__":
    main()
