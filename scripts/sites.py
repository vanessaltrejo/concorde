"""Curated sites for the data scripts (same values as src/data/sites.ts).

Pick one with --site <id>. The default is shackleton-rim, so running a script
without arguments does exactly what it did before.
"""

import sys

GLASER_2018 = (
    "Glaser et al. 2018, Planetary and Space Science 162, Table 1 "
    "(surface level, \"this study\"), doi:10.1016/j.pss.2017.07.006"
)

GLASER_2018_2M = (
    "Glaser et al. 2018, Planetary and Space Science 162, Table 2 "
    "(2 m above ground), doi:10.1016/j.pss.2017.07.006"
)

NSSDC_APOLLO = (
    "NSSDC Apollo Landing Site Coordinates (Lunar Module), Wagner et al. 2017, "
    "Icarus 283, 92-103; https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"
)

SITES = {
    "shackleton-rim": {
        "name": "Shackleton rim",
        "latitude_deg": -89.7849,
        "east_longitude_deg": 203.97,
        "source": GLASER_2018,
    },
    # Connecting Ridge: Table 2 points (2 m above ground), the same height as
    # our observer. Read from the PDF text on 2026-11-14. Their illumination
    # values (88.0/92.1 and 78.1/82.0) match clusters C1-0 and C2-1 in Table 3;
    # that match is our inference, the paper does not state it.
    "connecting-ridge-c1": {
        "name": "Connecting Ridge C1",
        "latitude_deg": -89.4398,
        "east_longitude_deg": 222.83,
        "source": GLASER_2018_2M,
    },
    "connecting-ridge-c2": {
        "name": "Connecting Ridge C2",
        "latitude_deg": -89.3130,
        "east_longitude_deg": 245.98,
        "source": GLASER_2018_2M,
    },
    # Apollo Lunar Module positions, NSSDC "Apollo Landing Site Coordinates"
    # (planetocentric, Mean Earth/Polar Axis, DE421; from LRO images, Wagner et
    # al. 2017, Icarus 283, 92-103). Read 2026-11-14.
    "apollo-11": {
        "name": "Apollo 11",
        "latitude_deg": 0.67416,
        "east_longitude_deg": 23.47314,
        "source": NSSDC_APOLLO,
    },
    "apollo-16": {
        "name": "Apollo 16",
        "latitude_deg": -8.9734,
        "east_longitude_deg": 15.5011,
        "source": NSSDC_APOLLO,
    },
    "apollo-17": {
        "name": "Apollo 17",
        "latitude_deg": 20.1911,
        "east_longitude_deg": 30.7723,
        "source": NSSDC_APOLLO,
    },
}

DEFAULT_SITE_ID = "shackleton-rim"


def site_from_argv() -> tuple[str, dict]:
    """Return (site_id, site) from a --site <id> argument, or the default."""
    args = sys.argv[1:]
    site_id = DEFAULT_SITE_ID
    if "--site" in args:
        index = args.index("--site")
        if index + 1 >= len(args):
            raise SystemExit("--site needs a site id")
        site_id = args[index + 1]
    if site_id not in SITES:
        raise SystemExit(f"Unknown site {site_id!r}. Known: {', '.join(SITES)}")
    return site_id, SITES[site_id]
