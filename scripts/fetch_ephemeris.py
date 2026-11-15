"""Sun and Earth seen from the Moon's centre, hourly, for any point on the Moon.

One JPL Horizons table (target Moon, observer Earth centre) gives, every hour:
  - the sub-Earth point on the Moon (ObsSub-LON/LAT) and the Earth-Moon distance (delta),
  - the sub-solar point on the Moon (SunSub-LON/LAT) and the Sun-Moon distance (r).
With these, src/scene/zones.ts places the Sun and the Earth in the local sky of
any point (including the Earth's parallax, up to about 0.26 degrees).

Checked on 2026-11-14 against Horizons' own per-site tables: azimuth and
elevation within 0.006 degrees at Shackleton rim, Connecting Ridge C1/C2 and
Apollo 11 (same period).

Writes public/data/ephemeris.json. Same period and step as fetch_horizons.py.
Run from the project root:
    python3 scripts/fetch_ephemeris.py
(If SSL fails, see the note in fetch_horizons.py.)
"""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
AU_KM = 149_597_870.7
START_UTC = datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc)
STOP_UTC = START_UTC + timedelta(days=90)  # same period as fetch_horizons.py
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = PROJECT_ROOT / "public" / "data" / "ephemeris.json"
RAW_FILE = PROJECT_ROOT / "data" / "raw" / "ephemeris_moon_from_earth.txt"


def main() -> None:
    params = {
        "format": "json",
        "COMMAND": "'301'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'500@399'",
        "START_TIME": f"'{START_UTC:%Y-%m-%d %H:%M}'",
        "STOP_TIME": f"'{STOP_UTC:%Y-%m-%d %H:%M}'",
        "STEP_SIZE": "'1 h'",
        # 14 = observer sub-point, 15 = sub-solar point, 19 = Sun distance r, 20 = observer distance delta
        "QUANTITIES": "'14,15,19,20'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }
    with urllib.request.urlopen(f"{API_URL}?{urllib.parse.urlencode(params)}", timeout=120) as response:
        result = json.load(response)["result"]
    RAW_FILE.write_text(result)
    start = result.index("$$SOE")
    header = next(l for l in reversed(result[:start].splitlines()) if l.strip().startswith("Date__"))
    names = [c.strip() for c in header.split(",")]
    col = {n: names.index(n) for n in ("ObsSub-LON", "ObsSub-LAT", "SunSub-LON", "SunSub-LAT", "r", "delta")}
    rows = []
    for line in result[start + 5 : result.index("$$EOE")].strip().splitlines():
        c = [x.strip() for x in line.split(",")]
        rows.append(
            [
                float(c[col["ObsSub-LON"]]),
                float(c[col["ObsSub-LAT"]]),
                round(float(c[col["delta"]]) * AU_KM, 1),
                float(c[col["SunSub-LON"]]),
                float(c[col["SunSub-LAT"]]),
                round(float(c[col["r"]]) * AU_KM, 0),
            ]
        )
    out = {
        "startUtc": START_UTC.isoformat().replace("+00:00", "Z"),
        "stepHours": 1,
        "columns": ["earthLonDeg", "earthLatDeg", "earthDistanceKm", "sunLonDeg", "sunLatDeg", "sunDistanceKm"],
        "rows": rows,
        "provenance": {
            "source": "NASA/JPL Horizons API, target Moon (301) from Earth centre (500@399), quantities 14,15,19,20",
            "notes": "Sub-Earth and sub-solar points on the Moon, planetocentric degrees (east longitude).",
        },
    }
    OUT_FILE.write_text(json.dumps(out))
    print(f"Wrote {OUT_FILE.relative_to(PROJECT_ROOT)} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
