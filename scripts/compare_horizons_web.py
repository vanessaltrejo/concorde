"""Compare the app's sky.json with a table exported from the Horizons web app.

Validation: the web table was made by hand in https://ssd.jpl.nasa.gov/horizons/app.html
(Observer Table, target Earth, site 203.97 E, -89.7849, 0 km @301, hourly).
This script checks that our API-based data gives the same azimuth and elevation.

Run from the project root:
    python3 scripts/compare_horizons_web.py

Result on 2026-11-14: 25 rows compared, max difference 0.0 deg in both.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_FILE = PROJECT_ROOT / "data" / "validation" / "horizons_web_earth_2026-11-14.txt"
APP_FILE = PROJECT_ROOT / "public" / "data" / "shackleton-rim" / "sky.json"

# Row start: date, solar-presence mark, RA, DEC, azimuth, elevation.
ROW_PATTERN = re.compile(
    r"\s*(\d{4}-\w{3}-\d{2} \d{2}:\d{2})\s+\S*\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"
)


def read_web_table(path: Path) -> dict[str, tuple[float, float]]:
    text = path.read_text()
    block = text[text.index("$$SOE") + len("$$SOE") : text.index("$$EOE")]
    rows = {}
    for line in block.strip().splitlines():
        match = ROW_PATTERN.match(line)
        if match is None:
            raise ValueError(f"Unexpected row format: {line}")
        time_utc = datetime.strptime(match.group(1), "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        key = time_utc.isoformat().replace("+00:00", "Z")
        rows[key] = (float(match.group(4)), float(match.group(5)))
    return rows


def read_app_data(path: Path) -> dict[str, tuple[float, float]]:
    samples = json.loads(path.read_text())["samples"]
    return {s["timeUtc"]: (s["earth"]["azimuthDeg"], s["earth"]["elevationDeg"]) for s in samples}


def main() -> None:
    web = read_web_table(WEB_FILE)
    app = read_app_data(APP_FILE)
    common = sorted(set(web) & set(app))
    if not common:
        raise RuntimeError("No matching time stamps between the two files")

    max_az = max(abs(web[t][0] - app[t][0]) for t in common)
    max_el = max(abs(web[t][1] - app[t][1]) for t in common)
    print(f"Rows compared: {len(common)} ({common[0]} to {common[-1]})")
    print(f"Max |azimuth difference|:   {max_az} deg")
    print(f"Max |elevation difference|: {max_el} deg")


if __name__ == "__main__":
    main()
