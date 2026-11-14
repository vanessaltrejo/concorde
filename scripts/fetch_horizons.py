"""Fetch Sun and Earth positions seen from a lunar surface site (JPL Horizons).

Writes public/data/<site_id>/sky.json for the app, and saves the raw
Horizons replies in data/raw/ as evidence.

Run from the project root:
    python3 scripts/fetch_horizons.py

Only the Python standard library is used.

If you get "SSL: CERTIFICATE_VERIFY_FAILED" (common with the python.org
installer on macOS), export the macOS trusted certificates and point Python
to them for this run:
    security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain \
        /Library/Keychains/System.keychain > /tmp/macos-ca.pem
    SSL_CERT_FILE=/tmp/macos-ca.pem python3 scripts/fetch_horizons.py

API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
Manual:   https://ssd.jpl.nasa.gov/horizons/manual.html
"""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Site: Shackleton rim. Glaser et al. 2018, Planetary and Space Science 162,
# Table 1 (surface level, "this study"), doi:10.1016/j.pss.2017.07.006.
SITE = {
    "id": "shackleton-rim",
    "name": "Shackleton rim",
    "east_longitude_deg": 203.97,
    "latitude_deg": -89.7849,
    # Altitude above the 1737.4 km reference sphere. 0 km is an assumption:
    # a few km change the Sun/Earth direction by a negligible amount.
    "altitude_km": 0.0,
    "source": "Glaser et al. 2018, Planetary and Space Science 162, Table 1 "
    "(doi:10.1016/j.pss.2017.07.006)",
}

# One lunar day (about 29.5 Earth days), hourly, starting 2026-11-14 00:00 UTC.
START_UTC = datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc)
STOP_UTC = START_UTC + timedelta(days=29.5)
STEP_SIZE = "1 h"

# Horizons target codes: 10 = Sun, 399 = Earth.
TARGETS = {"sun": "10", "earth": "399"}

# QUANTITIES: 1 = astrometric RA & DEC (ICRF), 4 = apparent azimuth and
# elevation, 10 = illuminated fraction, 13 = target angular diameter,
# 14 = observer sub-longitude & sub-latitude (point of the target facing us).
# RA/DEC + az/el of two bodies give the sky-to-horizon rotation, used with 14
# to orient the Earth texture.
QUANTITIES = "1,4,10,13,14"

# Horizons column names (CSV header) we read.
COLUMNS = {
    "raDeg": "R.A._(ICRF)",
    "decDeg": "DEC_(ICRF)",
    "azimuthDeg": "Azi_(a-app)",
    "elevationDeg": "Elev_(a-app)",
    "illuminatedPct": "Illu%",
    "angularDiameterArcsec": "Ang-diam",
    "subLonDeg": "ObsSub-LON",
    "subLatDeg": "ObsSub-LAT",
}

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
OUT_FILE = PROJECT_ROOT / "public" / "data" / SITE["id"] / "sky.json"


def horizons_time(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M")


def build_params(target_code: str) -> dict[str, str]:
    site_coord = f"{SITE['east_longitude_deg']},{SITE['latitude_deg']},{SITE['altitude_km']}"
    # Horizons wants each value wrapped in single quotes.
    return {
        "format": "json",
        "COMMAND": f"'{target_code}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{site_coord}'",
        "START_TIME": f"'{horizons_time(START_UTC)}'",
        "STOP_TIME": f"'{horizons_time(STOP_UTC)}'",
        "STEP_SIZE": f"'{STEP_SIZE}'",
        "QUANTITIES": f"'{QUANTITIES}'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }


def fetch(target_code: str) -> tuple[str, str, dict]:
    params = build_params(target_code)
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=120) as response:
        payload = json.load(response)
    if "error" in payload:
        raise RuntimeError(f"Horizons error: {payload['error']}")
    return url, payload["result"], payload.get("signature", {})


def parse_rows(result: str) -> list[dict]:
    """Parse the CSV table between $$SOE and $$EOE, finding columns by name."""
    start = result.index("$$SOE")
    header_line = next(
        line for line in reversed(result[:start].splitlines()) if line.strip().startswith("Date__")
    )
    header = [cell.strip() for cell in header_line.split(",")]
    index = {key: header.index(name) for key, name in COLUMNS.items()}
    end = result.index("$$EOE")
    rows = []
    for line in result[start + len("$$SOE") : end].strip().splitlines():
        cells = [cell.strip() for cell in line.split(",")]
        time_utc = datetime.strptime(cells[0], "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        row = {key: float(cells[i]) for key, i in index.items()}
        row["angularDiameterDeg"] = row.pop("angularDiameterArcsec") / 3600
        row["timeUtc"] = time_utc.isoformat().replace("+00:00", "Z")
        rows.append(row)
    return rows


def body_state(row: dict) -> dict:
    return {
        "azimuthDeg": row["azimuthDeg"],
        "elevationDeg": row["elevationDeg"],
        "angularDiameterDeg": row["angularDiameterDeg"],
        "raDeg": row["raDeg"],
        "decDeg": row["decDeg"],
    }


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    rows_by_target: dict[str, list[dict]] = {}
    queries: dict[str, str] = {}
    signature: dict = {}
    for name, code in TARGETS.items():
        url, result, signature = fetch(code)
        (RAW_DIR / f"{SITE['id']}_{name}.txt").write_text(result)
        rows_by_target[name] = parse_rows(result)
        queries[name] = url
        print(f"{name}: {len(rows_by_target[name])} rows")

    sun_rows = rows_by_target["sun"]
    earth_rows = rows_by_target["earth"]
    if [r["timeUtc"] for r in sun_rows] != [r["timeUtc"] for r in earth_rows]:
        raise RuntimeError("Sun and Earth time stamps do not match")

    samples = []
    for sun, earth in zip(sun_rows, earth_rows):
        samples.append(
            {
                "timeUtc": sun["timeUtc"],
                "sun": body_state(sun),
                "earth": body_state(earth),
                "earthIlluminatedPct": earth["illuminatedPct"],
                # Point on Earth (east longitude, latitude) at the center of the
                # disc seen from the site.
                "earthSubObserverLonDeg": earth["subLonDeg"],
                "earthSubObserverLatDeg": earth["subLatDeg"],
            }
        )

    output = {
        "site": {
            "id": SITE["id"],
            "name": SITE["name"],
            "latitudeDeg": SITE["latitude_deg"],
            "longitudeDeg": SITE["east_longitude_deg"],
            "source": SITE["source"],
        },
        "provenance": {
            "source": "NASA/JPL Horizons API",
            "apiVersion": signature.get("version"),
            "generatedUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "observerAltitudeKm": SITE["altitude_km"],
            "notes": "Airless apparent azimuth and elevation of the target center. "
            "Azimuth clockwise from north. Elevation relative to the reference sphere "
            "(1737.4 km); terrain is not included. RA/DEC are astrometric ICRF.",
            "queries": queries,
        },
        "samples": samples,
    }
    OUT_FILE.write_text(json.dumps(output, indent=1))
    print(f"Wrote {OUT_FILE.relative_to(PROJECT_ROOT)} ({len(samples)} samples)")


if __name__ == "__main__":
    main()
