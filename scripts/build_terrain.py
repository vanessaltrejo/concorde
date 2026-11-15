"""Build the horizon profile and a terrain mesh for one site from LOLA data.

Reads only small windows of a remote Cloud-Optimized GeoTIFF (no full
download) and writes:
  public/data/<site_id>/horizon.json   horizon elevation for every azimuth
  public/data/<site_id>/terrain_near.f32  20 m grid around the site, exact scene x,y,z
  public/data/<site_id>/terrain_mid.f32   320 m grid out to 80 km, exact scene x,y,z
  public/data/<site_id>/terrain_far.f32   640 m grid out to 200 km, exact scene x,y,z
  public/data/<site_id>/terrain.json      grid sizes, scene placement, provenance

Data: LOLA 20 m/pixel south pole DEM, LDEM_80S_20MPP_ADJ.TIF (PGDA product 90),
Barker et al. 2023, Planet. Sci. J. 4, 183, doi:10.3847/PSJ/acf3e1.
South polar stereographic, heights in meters above a 1737.4 km sphere,
MOON_ME frame of DE421. The file has overviews (40, 80, 160 m ...), used
for far terrain.

Method: march rays out from the observer, sample the terrain, convert every
sample to 3D Moon-fixed coordinates and compute its true azimuth and elevation
in the observer's local east-north-up frame. The horizon is the highest
elevation per azimuth bin. Curvature and the direction of north are exact.

Run from the project root (see scripts/requirements.txt):
    .venv/bin/python scripts/build_terrain.py [--site <id>]

If remote reads fail with an SSL error, see the note in fetch_horizons.py and
set CURL_CA_BUNDLE to the exported macOS certificate file.
"""

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyproj
import rasterio
from rasterio.windows import from_bounds

from sites import site_from_argv

DEM_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
DEM_SOURCE = (
    "LOLA LDEM_80S_20MPP_ADJ (PGDA product 90), Barker et al. 2023, "
    "Planet. Sci. J. 4, 183, doi:10.3847/PSJ/acf3e1"
)

# Site from scripts/sites.py (--site <id>, default shackleton-rim).
SITE_ID, _SITE = site_from_argv()
SITE_LON_DEG = _SITE["east_longitude_deg"]
SITE_LAT_DEG = _SITE["latitude_deg"]

MOON_RADIUS_M = 1_737_400.0  # Radius of the DEM reference sphere (from the file CRS).
OBSERVER_HEIGHT_M = 2.0  # Lander height, as in Glaser et al. 2018.

AZIMUTH_STEP_DEG = 0.25
MIN_DISTANCE_M = 20.0
MAX_DISTANCE_M = 200_000.0

# (overview level, resolution in m, max distance in m, ray step in m).
# Level None = full 20 m data; 1 = 4x (80 m); 2 = 8x (160 m).
LEVELS = [
    (None, 20.0, 20_000.0, 10.0),
    (1, 80.0, 60_000.0, 40.0),
    (2, 160.0, MAX_DISTANCE_M, 80.0),
]

# Height grids for the 3D view: (name, overview level, half size in m).
# Near: full 20 m data, 20 x 20 km. Mid: 16x overview (320 m), 160 x 160 km.
# Far: 32x overview (640 m), 400 x 400 km, so shadows see the same terrain
# (out to 200 km) as the horizon profile.
GRIDS = [
    ("near", None, 10_000.0),
    ("mid", 3, 80_000.0),
    ("far", 4, MAX_DISTANCE_M),
]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "public" / "data" / SITE_ID


def open_dem(overview_level: int | None):
    url = f"/vsicurl/{DEM_URL}"
    if overview_level is None:
        return rasterio.open(url)
    return rasterio.open(url, overview_level=overview_level)


class Geometry:
    """Projection helpers and the observer's local frame."""

    def __init__(self, crs_wkt: str):
        crs = pyproj.CRS.from_wkt(crs_wkt)
        geo = crs.geodetic_crs
        self.to_map = pyproj.Transformer.from_crs(geo, crs, always_xy=True)
        self.to_geo = pyproj.Transformer.from_crs(crs, geo, always_xy=True)

    def to_cartesian(self, x: np.ndarray, y: np.ndarray, height_m: np.ndarray) -> np.ndarray:
        lon, lat = self.to_geo.transform(x, y)
        lon_r = np.radians(lon)
        lat_r = np.radians(lat)
        r = MOON_RADIUS_M + height_m
        return np.stack(
            [r * np.cos(lat_r) * np.cos(lon_r), r * np.cos(lat_r) * np.sin(lon_r), r * np.sin(lat_r)],
            axis=-1,
        )


def local_frame(lon_deg: float, lat_deg: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """East, north and up unit vectors at a point on the sphere."""
    lon = math.radians(lon_deg)
    lat = math.radians(lat_deg)
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    north = np.array([-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)])
    up = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    return east, north, up


def read_window(ds, cx: float, cy: float, half_size: float) -> tuple[np.ndarray, rasterio.Affine]:
    window = from_bounds(cx - half_size, cy - half_size, cx + half_size, cy + half_size, ds.transform)
    window = window.round_offsets().round_lengths()
    data = ds.read(1, window=window).astype(np.float64)
    return data, ds.window_transform(window)


def bilinear(data: np.ndarray, transform: rasterio.Affine, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Bilinear interpolation of pixel-center values. NaN outside or on nodata."""
    res_x = transform.a
    res_y = -transform.e
    col = (x - transform.c) / res_x - 0.5
    row = (transform.f - y) / res_y - 0.5
    c0 = np.floor(col).astype(np.int64)
    r0 = np.floor(row).astype(np.int64)
    fc = col - c0
    fr = row - r0
    rows, cols = data.shape
    inside = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < cols) & (r0 + 1 < rows)
    out = np.full(x.shape, np.nan)
    c0i, r0i, fci, fri = c0[inside], r0[inside], fc[inside], fr[inside]
    v00 = data[r0i, c0i]
    v01 = data[r0i, c0i + 1]
    v10 = data[r0i + 1, c0i]
    v11 = data[r0i + 1, c0i + 1]
    out[inside] = (
        v00 * (1 - fci) * (1 - fri) + v01 * fci * (1 - fri) + v10 * (1 - fci) * fri + v11 * fci * fri
    )
    return out


def map_directions(geom: Geometry, x0: float, y0: float) -> tuple[np.ndarray, np.ndarray]:
    """Unit vectors in the map plane that point to local north and east at the site.

    The projection is conformal, so angles at the site are kept.
    """
    eps = 1e-5
    xn, yn = geom.to_map.transform(SITE_LON_DEG, SITE_LAT_DEG + eps)
    xe, ye = geom.to_map.transform(SITE_LON_DEG + eps / math.cos(math.radians(SITE_LAT_DEG)), SITE_LAT_DEG)
    north = np.array([xn - x0, yn - y0])
    east = np.array([xe - x0, ye - y0])
    return north / np.linalg.norm(north), east / np.linalg.norm(east)


def build_horizon(geom: Geometry, x0: float, y0: float, observer: np.ndarray) -> np.ndarray:
    east, north, up = local_frame(SITE_LON_DEG, SITE_LAT_DEG)
    map_north, map_east = map_directions(geom, x0, y0)

    bin_count = int(round(360 / AZIMUTH_STEP_DEG))
    horizon = np.full(bin_count, -np.inf)
    # Rays are 4x denser than the bins so every bin gets samples.
    ray_azimuths = np.radians(np.arange(0, 360, AZIMUTH_STEP_DEG / 4))
    ray_dirs = np.outer(np.cos(ray_azimuths), map_north) + np.outer(np.sin(ray_azimuths), map_east)

    start = MIN_DISTANCE_M
    for level, res, max_dist, step in LEVELS:
        with open_dem(level) as ds:
            data, transform = read_window(ds, x0, y0, max_dist + 4 * res)
        print(f"  level {res:.0f} m: window {data.shape}, distances {start:.0f}-{max_dist:.0f} m")
        distances = np.arange(start, max_dist, step)
        for chunk in np.array_split(np.arange(len(ray_dirs)), 16):
            dirs = ray_dirs[chunk]
            xs = x0 + dirs[:, 0:1] * distances[None, :]
            ys = y0 + dirs[:, 1:2] * distances[None, :]
            heights = bilinear(data, transform, xs, ys)
            valid = np.isfinite(heights)
            points = geom.to_cartesian(xs[valid], ys[valid], heights[valid])
            d = points - observer
            norm = np.linalg.norm(d, axis=1)
            elevation = np.degrees(np.arcsin((d @ up) / norm))
            azimuth = np.degrees(np.arctan2(d @ east, d @ north)) % 360
            bins = np.round(azimuth / AZIMUTH_STEP_DEG).astype(np.int64) % bin_count
            np.maximum.at(horizon, bins, elevation)
        start = max_dist
    return horizon


def build_grid(
    geom: Geometry, x0: float, y0: float, observer: np.ndarray, overview_level: int | None, half_size_m: float
) -> dict:
    """Height grid in the scene frame of the observer, for the 3D view.

    Scene axes: x = east, y = up, z = -north (meters), site ground at the origin.
    Every grid node is placed on the sphere first, so positions include curvature.
    Exact x, y, z are stored per node. An affine fit (col, row) -> scene (x, z) is
    also stored, only to look up heights from scene x, z in the shadow shader; its
    residual comes from curvature (deep terrain far away "leans") and is reported.
    """
    east, north, up = local_frame(SITE_LON_DEG, SITE_LAT_DEG)
    with open_dem(overview_level) as ds:
        data, transform = read_window(ds, x0, y0, half_size_m)
    size = min(data.shape)
    data = data[:size, :size]
    spacing = transform.a
    col_idx, row_idx = np.meshgrid(np.arange(size, dtype=np.float64), np.arange(size, dtype=np.float64))
    xs = transform.c + (col_idx + 0.5) * spacing
    ys = transform.f - (row_idx + 0.5) * spacing
    heights = data.copy()
    nan_count = int(np.isnan(heights).sum())
    if nan_count:
        heights[np.isnan(heights)] = np.nanmean(heights)
    points = geom.to_cartesian(xs.ravel(), ys.ravel(), heights.ravel())
    d = points - observer
    scene_x = d @ east
    scene_y = d @ up + OBSERVER_HEIGHT_M
    scene_z = -(d @ north)

    design = np.stack([col_idx.ravel(), row_idx.ravel(), np.ones(size * size)], axis=1)
    coef_x, *_ = np.linalg.lstsq(design, scene_x, rcond=None)
    coef_z, *_ = np.linalg.lstsq(design, scene_z, rcond=None)
    residual = np.hypot(design @ coef_x - scene_x, design @ coef_z - scene_z)
    print(
        f"  {size}x{size} at {spacing:.0f} m, NaN filled: {nan_count}, "
        f"affine fit max residual {residual.max():.2f} m"
    )
    return {
        "positions": np.stack([scene_x, scene_y, scene_z], axis=1).astype(np.float32),
        "size": size,
        "spacingM": spacing,
        # scene x = a*col + b*row + c ; scene z = d*col + e*row + f
        "affine": [float(v) for v in (*coef_x, *coef_z)],
        "maxResidualM": float(residual.max()),
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open_dem(None) as ds:
        geom = Geometry(ds.crs.to_wkt())
        x0, y0 = geom.to_map.transform(SITE_LON_DEG, SITE_LAT_DEG)
        site_data, site_transform = read_window(ds, x0, y0, 200.0)
    ground_m = float(bilinear(site_data, site_transform, np.array([x0]), np.array([y0]))[0])
    observer = geom.to_cartesian(np.array([x0]), np.array([y0]), np.array([ground_m + OBSERVER_HEIGHT_M]))[0]
    print(f"Site map xy = ({x0:.1f}, {y0:.1f}) m, ground height = {ground_m:.2f} m")

    print("Horizon:")
    horizon = build_horizon(geom, x0, y0, observer)
    missing = int(np.isinf(horizon).sum())
    if missing:
        raise RuntimeError(f"{missing} azimuth bins got no samples")
    print(f"  min {horizon.min():.3f} deg, max {horizon.max():.3f} deg at az {horizon.argmax() * AZIMUTH_STEP_DEG:.2f}")

    generated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    horizon_out = {
        "siteId": SITE_ID,
        "azimuthStepDeg": AZIMUTH_STEP_DEG,
        "elevationDeg": [round(float(v), 4) for v in horizon],
        "provenance": {
            "source": DEM_SOURCE,
            "url": DEM_URL,
            "generatedUtc": generated,
            "observerHeightM": OBSERVER_HEIGHT_M,
            "groundHeightM": round(ground_m, 2),
            "maxDistanceM": MAX_DISTANCE_M,
            "levels": [{"resolutionM": r, "maxDistanceM": d} for _, r, d, _ in LEVELS],
            "notes": "Highest terrain elevation per azimuth bin (bin centered on k*step). "
            "Azimuth clockwise from north, elevation above the local horizontal plane "
            "of the sphere, matching JPL Horizons.",
        },
    }
    (OUT_DIR / "horizon.json").write_text(json.dumps(horizon_out))

    grids_meta = {}
    for name, level, half_size in GRIDS:
        print(f"Grid {name}:")
        grid = build_grid(geom, x0, y0, observer, level, half_size)
        (OUT_DIR / f"terrain_{name}.f32").write_bytes(grid["positions"].tobytes())
        grids_meta[name] = {k: v for k, v in grid.items() if k != "positions"}
        grids_meta[name]["file"] = f"terrain_{name}.f32"
    old_mesh = OUT_DIR / "terrain.bin"
    if old_mesh.exists():
        old_mesh.unlink()

    terrain_meta = {
        "siteId": SITE_ID,
        "grids": grids_meta,
        "layout": "float32 x,y,z per grid node, row-major (row = map row). "
        "Scene axes: x = east, y = up, z = -north (meters); site ground at (0,0,0), "
        "observer eye at (0, observerHeightM, 0). Affine (col,row) -> scene x,z is "
        "approximate (see maxResidualM) and only used for shadow height lookups.",
        "observerHeightM": OBSERVER_HEIGHT_M,
        "provenance": {"source": DEM_SOURCE, "url": DEM_URL, "generatedUtc": generated},
    }
    (OUT_DIR / "terrain.json").write_text(json.dumps(terrain_meta, indent=1))
    print("Wrote horizon.json, terrain_*.f32, terrain.json")


if __name__ == "__main__":
    # The PGDA server sometimes answers 403 to bursts of range requests and
    # then accepts them again, so GDAL retries those too.
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        GDAL_HTTP_MAX_RETRY="8",
        GDAL_HTTP_RETRY_DELAY="3",
        GDAL_HTTP_RETRY_CODES="403,429,500,502,503,504",
    ):
        main()
