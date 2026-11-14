"""Validation: the 3D view's shadow method vs the site horizon profile.

Repeats, on the CPU, what the terrain shader does (src/scene/terrainShader.ts):
march from the observer over the near/mid/far height grids (texture lookup via
the affine map, bilinear filtering, step x1.05) and take the highest terrain
angle per azimuth. Compares it with horizon.json (exact 3D method) and with the
visible/hidden decision for the Sun and Earth samples in sky.json.

Run from the project root:
    .venv/bin/python scripts/check_shadow_method.py
"""

import json
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parent.parent / "public" / "data" / "shackleton-rim"
EYE_HEIGHT_M = 2.0
SHADOW_BIAS_M = 0.5
START_M = 20.0
STEP_FACTOR = 1.05
MAX_STEPS = 220


def load_grid(meta: dict) -> dict:
    n = meta["size"]
    p = np.fromfile(DATA / meta["file"], dtype=np.float32).reshape(n, n, 3).astype(np.float64)
    a, b, c, d, e, f = meta["affine"]
    inv = np.array([[e, -b], [-d, a]]) / (a * e - b * d)
    col, row = np.meshgrid(np.arange(n), np.arange(n))
    dx = p[..., 0] - (a * col + b * row + c)
    dz = p[..., 2] - (d * col + e * row + f)
    dcol = inv[0, 0] * dx + inv[0, 1] * dz
    drow = inv[1, 0] * dx + inv[1, 1] * dz
    heights = bilinear(p[..., 1], col - dcol, row - drow)
    return {"heights": heights, "inv": inv, "origin": np.array([c, f]), "size": n}


def bilinear(values: np.ndarray, col: np.ndarray, row: np.ndarray) -> np.ndarray:
    n = values.shape[0]
    c = np.clip(col, 0, n - 1.001)
    r = np.clip(row, 0, n - 1.001)
    c0 = np.floor(c).astype(int)
    r0 = np.floor(r).astype(int)
    fc = c - c0
    fr = r - r0
    return (
        values[r0, c0] * (1 - fc) * (1 - fr)
        + values[r0, c0 + 1] * fc * (1 - fr)
        + values[r0 + 1, c0] * (1 - fc) * fr
        + values[r0 + 1, c0 + 1] * fc * fr
    )


def lookup(grid: dict, xz: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    col_row = (xz - grid["origin"]) @ grid["inv"].T
    uv = (col_row + 0.5) / grid["size"]
    inside = np.all((uv >= 0) & (uv <= 1), axis=-1)
    return bilinear(grid["heights"], col_row[..., 0], col_row[..., 1]), inside


def interp_profile(profile: np.ndarray, azimuth: float) -> float:
    step = 360 / len(profile)
    x = (azimuth / step) % len(profile)
    k = int(x)
    f = x - k
    return profile[k] * (1 - f) + profile[(k + 1) % len(profile)] * f


def main() -> None:
    meta = json.loads((DATA / "terrain.json").read_text())["grids"]
    grids = [load_grid(meta[name]) for name in ("near", "mid", "far")]
    reference = np.array(json.loads((DATA / "horizon.json").read_text())["elevationDeg"])
    azimuths = np.arange(0, 360, 360 / len(reference))
    az = np.radians(azimuths)
    dirs = np.stack([np.sin(az), -np.cos(az)], axis=1)

    best = np.full(len(az), -1e6)
    alive = np.ones(len(az), bool)
    t = START_M
    for _ in range(MAX_STEPS):
        heights = np.full(len(az), np.nan)
        found = np.zeros(len(az), bool)
        for grid in grids:
            h, inside = lookup(grid, dirs * t)
            use = inside & ~found
            heights[use] = h[use]
            found |= inside
        alive &= found
        best = np.where(alive, np.maximum(best, (heights - EYE_HEIGHT_M - SHADOW_BIAS_M) / t), best)
        t *= STEP_FACTOR
    shader = np.degrees(np.arctan(best))
    diff = shader - reference
    print(
        f"Horizon, shader method vs horizon.json: median |diff| {np.median(abs(diff)):.3f} deg, "
        f"p95 {np.percentile(abs(diff), 95):.3f}, max {abs(diff).max():.3f}"
    )

    samples = json.loads((DATA / "sky.json").read_text())["samples"]
    for key in ("sun", "earth"):
        same = 0
        for s in samples:
            b = s[key]
            top = b["elevationDeg"] + b["angularDiameterDeg"] / 2
            same += (top > interp_profile(shader, b["azimuthDeg"])) == (top > interp_profile(reference, b["azimuthDeg"]))
        print(f"{key}: same visible/hidden decision in {same}/{len(samples)} samples")


if __name__ == "__main__":
    main()
