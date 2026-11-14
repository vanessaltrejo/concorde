"""Validation: long-term sunlight at the site vs Glaser et al. 2018.

Glaser et al. 2018 (Planetary and Space Science 162, Table 1) report, for the
Shackleton rim point at surface level over 2017-01-01 to 2037-01-01 (hourly):
average illumination 81.0 % and solar visibility 85.5 %.
(Values read from the PDF text extraction; check them in the PDF, page 4.)

This script repeats the idea with our own data:
  - Sun azimuth, elevation and size from JPL Horizons, every 6 hours, same period
  - our horizon from LOLA 20 m (scripts/build_terrain.py), observer at 0 m and 2 m
It reports:
  - solar visibility: % of time any part of the Sun's disc is above the horizon
  - average illumination: mean visible fraction of the Sun's disc

Run from the project root:
    .venv/bin/python scripts/check_illumination.py
"""

import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import rasterio

import build_terrain as bt

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
START_YEAR = 2017
END_YEAR = 2037  # exclusive, as in the paper (2017-01-01 to 2037-01-01)
STEP_SIZE = "6 h"

GLASER_SURFACE = {"averageIlluminationPct": 81.0, "solarVisibilityPct": 85.5}

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = PROJECT_ROOT / "data" / "validation" / "illumination_check.json"


def fetch_sun_year(year: int) -> np.ndarray:
    """Rows of (azimuth deg, elevation deg, angular diameter deg) for one year."""
    params = {
        "format": "json",
        "COMMAND": "'10'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{bt.SITE_LON_DEG},{bt.SITE_LAT_DEG},0'",
        "START_TIME": f"'{year}-01-01 00:00'",
        # Stop just before the next year so years do not overlap.
        "STOP_TIME": f"'{year}-12-31 18:00'",
        "STEP_SIZE": f"'{STEP_SIZE}'",
        "QUANTITIES": "'4,13'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=180) as response:
        payload = json.load(response)
    if "error" in payload:
        raise RuntimeError(f"Horizons error for {year}: {payload['error']}")
    result = payload["result"]
    block = result[result.index("$$SOE") + 5 : result.index("$$EOE")]
    rows = []
    for line in block.strip().splitlines():
        cells = [c.strip() for c in line.split(",")]
        rows.append((float(cells[3]), float(cells[4]), float(cells[5]) / 3600))
    return np.array(rows)


def visible_disc_fraction(center_above_deg: np.ndarray, radius_deg: np.ndarray) -> np.ndarray:
    """Fraction of a disc above a straight horizon line.

    center_above_deg: disc center elevation minus horizon elevation.
    Treats the horizon as a straight line across the small solar disc.
    """
    d = np.clip(center_above_deg / radius_deg, -1, 1)
    # Area of the circular segment below the line, as a fraction of the disc.
    below = (np.arccos(d) - d * np.sqrt(1 - d * d)) / math.pi
    return 1 - below


def horizon_at(horizon: np.ndarray, step: float, azimuth: np.ndarray) -> np.ndarray:
    x = (azimuth / step) % len(horizon)
    k = np.floor(x).astype(np.int64)
    f = x - k
    return horizon[k] * (1 - f) + horizon[(k + 1) % len(horizon)] * f


def build_horizons_for_heights(heights_m: list[float]) -> dict[float, np.ndarray]:
    with bt.open_dem(None) as ds:
        geom = bt.Geometry(ds.crs.to_wkt())
        x0, y0 = geom.to_map.transform(bt.SITE_LON_DEG, bt.SITE_LAT_DEG)
        site_data, site_transform = bt.read_window(ds, x0, y0, 200.0)
    ground = float(bt.bilinear(site_data, site_transform, np.array([x0]), np.array([y0]))[0])
    out = {}
    for h in heights_m:
        observer = geom.to_cartesian(np.array([x0]), np.array([y0]), np.array([ground + h]))[0]
        print(f"Horizon at {h} m above ground:")
        out[h] = bt.build_horizon(geom, x0, y0, observer)
    return out


def main() -> None:
    suns = []
    for year in range(START_YEAR, END_YEAR):
        rows = fetch_sun_year(year)
        suns.append(rows)
        print(f"Sun {year}: {len(rows)} rows")
        time.sleep(1)
    sun = np.concatenate(suns)
    azimuth, elevation, diameter = sun[:, 0], sun[:, 1], sun[:, 2]

    heights = [0.0, bt.OBSERVER_HEIGHT_M]
    horizons = build_horizons_for_heights(heights)

    results = {}
    for h, horizon in horizons.items():
        above = elevation - horizon_at(horizon, bt.AZIMUTH_STEP_DEG, azimuth)
        fraction = visible_disc_fraction(above, diameter / 2)
        results[f"{h:g}m"] = {
            "solarVisibilityPct": round(100 * float(np.mean(fraction > 0)), 2),
            "averageIlluminationPct": round(100 * float(np.mean(fraction)), 2),
        }

    report = {
        "site": {"lonDeg": bt.SITE_LON_DEG, "latDeg": bt.SITE_LAT_DEG},
        "period": f"{START_YEAR}-01-01 to {END_YEAR}-01-01, step {STEP_SIZE}",
        "samples": int(len(sun)),
        "ours": results,
        "glaser2018SurfaceTable1": GLASER_SURFACE,
        "sources": {"sun": "NASA/JPL Horizons API", "terrain": bt.DEM_SOURCE},
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        GDAL_HTTP_MAX_RETRY="8",
        GDAL_HTTP_RETRY_DELAY="3",
        GDAL_HTTP_RETRY_CODES="403,429,500,502,503,504",
    ):
        main()
