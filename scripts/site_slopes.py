"""Local slope at each site, from the terrain files the app already has.

Reads public/data/<site>/terrain_near.f32 + terrain.json (exact scene x, y, z
per node: x = east, y = up, z = -north, site ground at the origin) and fits a
plane to the nodes within a radius of the site. The slope is the angle between
that plane and the local horizontal. No network, no new download.

Baseline: NASA's landing requirement is about 10 degrees over roughly 100 m
(team plan, NASA Artemis HLS update 2024). With 20 m polar data a 50 m radius
(100 m baseline) is used; with 118 m data the smallest honest fit uses the nodes
within 1.5 grid steps of the site (about 355 m baseline, 7 nodes). The baseline is written next to
every value, because slope depends on it.

Writes public/data/site_slopes.json. Run from the project root:
    python3 scripts/site_slopes.py
"""

import json
import math
from pathlib import Path

import numpy as np

from sites import SITES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA = PROJECT_ROOT / "public" / "data"


def site_slope(site_id: str) -> dict:
    meta = json.loads((DATA / site_id / "terrain.json").read_text())
    near = meta["grids"]["near"]
    size, spacing = near["size"], near["spacingM"]
    xyz = np.fromfile(DATA / site_id / near["file"], dtype=np.float32).reshape(-1, 3).astype(np.float64)
    horizontal = np.hypot(xyz[:, 0], xyz[:, 2])
    # 50 m radius for fine data; otherwise the 3 x 3 nodes around the site.
    radius = 50.0 if spacing <= 25 else spacing * 1.5
    pick = xyz[horizontal <= radius]
    # Plane y = a*x + b*z + c by least squares; slope = atan(|gradient|).
    design = np.column_stack([pick[:, 0], pick[:, 2], np.ones(len(pick))])
    (a, b, _), *_ = np.linalg.lstsq(design, pick[:, 1], rcond=None)
    return {
        "slopeDeg": round(math.degrees(math.atan(math.hypot(a, b))), 2),
        "baselineM": round(2 * radius),
        "nodes": int(len(pick)),
        "dataSpacingM": spacing,
    }


def main() -> None:
    out = {}
    for site_id in SITES:
        if (DATA / site_id / "terrain.json").exists():
            out[site_id] = site_slope(site_id)
            print(site_id, out[site_id])
    payload = {
        "method": "Plane fit to terrain nodes around the site (scripts/site_slopes.py). "
        "Slope depends on the baseline; compare only values with the same baseline.",
        "sites": out,
    }
    (DATA / "site_slopes.json").write_text(json.dumps(payload, indent=1))
    print("Wrote public/data/site_slopes.json")


if __name__ == "__main__":
    main()
