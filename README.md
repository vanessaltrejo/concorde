# Lunar Landing Site Simulator

**English** · [Español](README.es.md)
(If the two versions ever differ, this English file is the reference.)

A first-person 3D view from a landing site at the Moon's south pole. It shows
where the **Sun** (power) and the **Earth** (direct communication) are in the
sky at any hour, and whether the **real terrain** hides them.

Built for **NASA Space Apps Challenge 2026**, challenge *"Lunar Landing Site
Simulator"*. Current site: **Shackleton crater rim**. Current period: one lunar
day, **2026-11-14 00:00 to 2026-12-13 12:00 UTC**, hourly.

> **Planning aid, not flight grade.** Every number comes from public NASA data
> and is checked against an independent source (see [Validation](#6-validation)),
> but this is a hackathon tool, not mission software.

The full history of the project (every decision, problem, fix, discarded idea
and correction) is in [`docs/PROJECT_MEMORY.md`](docs/PROJECT_MEMORY.md).

---

## Contents

1. [The challenge](#1-the-challenge)
2. [What the app does](#2-what-the-app-does)
3. [Run it](#3-run-it)
4. [How it works](#4-how-it-works)
5. [Data and sources](#5-data-and-sources)
6. [Validation](#6-validation)
7. [Real data vs visual aids](#7-real-data-vs-visual-aids)
8. [Known limits](#8-known-limits)
9. [Discarded options](#9-discarded-options)
10. [Next steps](#10-next-steps)
11. [Project structure](#11-project-structure)
12. [Regenerate the data](#12-regenerate-the-data)
13. [Credits](#13-credits)

---

## 1. The challenge

Missions to the lunar south pole face extreme light and communication limits.
The Sun stays within about 1.5° of the horizon, so a small ridge can cut solar
power; the Earth also sits low, so terrain can block direct radio contact.
Tools that compute this exist (NASA Quickmap, Moon Trek, JPL Horizons), but they
are built for experts and need several interfaces to answer one question.

The challenge asks for an intuitive tool to **compare landing sites and dates
quickly**, showing the Sun and Earth relative to the horizon to judge **power
generation** and **direct-to-Earth communication**. Most items in the challenge
are optional ("you may consider"). Judging criteria to keep in mind: Impact,
Creativity, **Validity**, Relevance, Presentation.

**Our focus:** one site done right. A first-person view where what you *see*
(terrain hiding the Earth) and what the numbers *say* come from the same NASA
data, and every number is validated.

## 2. What the app does

**Left sidebar (white)**

- **Site**: name and coordinates (Shackleton rim, -89.7849°, 203.97° E).
- **Date and time (UTC)**: date field plus a slider over 709 hourly samples.
- **Sun (power)** and **Earth (direct link)**, each with:
  - **Status**: ● Visible, ◐ Partly hidden (with % of the disc visible), ○ Hidden.
  - **Sunset/Earthset in** (or **rise in** when hidden): time left and exact UTC
    time, interpolated to the minute.
  - **Elevation**, **Azimuth**, and the **Terrain horizon there** (how high the
    terrain is in that direction, so the status is easy to understand).
  - Earth only: **Lit fraction** (Earth phase seen from the site).
- **Period summary**: % of the period with Sun and with Earth link.
- **Credits** and the "Planning aid, not flight grade" note.

**Main area (3D view)**

- First-person camera, 2 m above the ground (lander height). The camera never
  moves; you only look around.
- **Drag** to look around, **scroll / pinch** or **− / +** to zoom
  (field of view 60° down to 2°), **Look at Sun / Look at Earth** buttons.
- Real terrain from LOLA out to 200 km, with **real cast shadows**.
- The Sun disc and the Earth disc at their **real angular size** from Horizons.
  The Earth shows its **real phase** and the side of the Earth that really
  faces the Moon (NASA Blue Marble image).
- Compass (heading in degrees), labels "Sun"/"Earth" with "(partial)" or
  "(hidden)", a thin gray line on the computed horizon.

**Example (pitch story):** at Shackleton rim the Sun is visible 100% of this
period. The Earth is visible about 50% of it; on 2026-11-17 00:00 UTC it is
half hidden behind a ridge (52% of the disc visible), and the next loss of
direct link is on 2026-12-01 02:34 UTC. On 2026-11-17 12:00 the Earth is visible
even at -0.40° elevation, because from the high rim the terrain drops to about
-1.35° in that direction; a flat-horizon tool would call it hidden.

## 3. Run it

Requirements: **Node.js** (tested with v25.2.1, npm 11.9.0).

```bash
npm install
npm run dev
```

Open http://localhost:5173. All data is already in `public/data`, so the app
works **offline**. The first load reads about 19 MB of terrain data.

Other commands:

```bash
npm run build    # type check (no `any` allowed) + production build in dist/
npm run lint     # oxlint
npm run preview  # serve the production build
```

The Python scripts are only needed to **regenerate** data
(see [section 12](#12-regenerate-the-data)).

## 4. How it works

### 4.1 Architecture

```
NASA/JPL Horizons API ──► scripts/fetch_horizons.py ──► public/data/<site>/sky.json
NASA PGDA LOLA DEM (COG) ─► scripts/build_terrain.py ──► public/data/<site>/horizon.json
                                                     └─► public/data/<site>/terrain_*.f32 + terrain.json
                                    │
                         (everything precomputed, static files)
                                    ▼
          Vite + React + TypeScript app (src/) reads the files and renders
          the sidebar (metrics) and the 3D view (three.js / react-three-fiber)
```

**Everything heavy is precomputed in Python.** The browser never calls an API:
the demo must work on bad wifi, and Horizons does not document CORS (browser
access).

### 4.2 Scene frame (important)

All 3D geometry is in the **local frame of the site**:
`x = east`, `y = up`, `z = -north` (meters). The site ground is at the origin;
the eye is at `(0, 2, 0)`. **Azimuth** is measured clockwise from north
(0 = N, 90 = E), the same convention as JPL Horizons. **Elevation** is measured
from the local horizontal plane of the reference sphere (radius 1737.4 km),
also as in Horizons. Lunar curvature is included because every terrain point is
placed on the sphere first.

### 4.3 Sun and Earth positions

`scripts/fetch_horizons.py` asks Horizons for an **observer table** from a point
on the Moon (`CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`,
`SITE_COORD='203.97,-89.7849,0'`), targets Sun (`10`) and Earth (`399`), every
hour. Quantities:

| Code | Meaning | Used for |
|---|---|---|
| 1 | Astrometric RA/DEC (ICRF) | Earth orientation (texture) |
| 4 | Apparent azimuth and elevation (airless) | Positions in the sky |
| 10 | Illuminated fraction | Earth "Lit fraction" |
| 13 | Angular diameter | Real disc sizes (Earth ≈ 1.80°, Sun ≈ 0.54°) |
| 14 | Observer sub-longitude / sub-latitude | Which side of Earth faces the Moon |

Horizons applies no atmospheric refraction for non-Earth sites (the Moon has no
atmosphere) and its elevation ignores terrain. Terrain is our part.

### 4.4 Terrain

Source: **LOLA 20 m/pixel south pole DEM**, `LDEM_80S_20MPP_ADJ.TIF`
(NASA PGDA product 90, Barker et al. 2023). It is a 2.7 GB **Cloud-Optimized
GeoTIFF**: we read only the windows we need over HTTP range requests, so nothing
is downloaded in full. It covers ±304 km around the pole, in south polar
stereographic meters, MOON_ME frame of DE421 (the same frame Horizons uses for
lunar sites), heights in meters above a 1737.4 km sphere. It has built-in lower
resolution levels (40, 80, 160, 320, 640, 1280 m).

`scripts/build_terrain.py` writes:

- **Horizon profile** (`horizon.json`): for every azimuth (0.25° step, 1440
  values) the highest terrain angle seen from the eye (2 m above ground), out to
  **200 km**. Rays are marched with 20 m data to 20 km, 80 m data to 60 km and
  160 m data to 200 km. Each sample is converted to true 3D Moon coordinates and
  its azimuth/elevation is computed in the site's local frame, so curvature and
  the direction of north are exact. (Near the pole, map "north" is not local
  north; working in 3D avoids that trap.)
- **Three terrain grids** for the 3D view, with the exact 3D position of every
  node in the scene frame:

  | Grid | Resolution | Extent | Nodes | File |
  |---|---|---|---|---|
  | near | 20 m | ±10 km | 1000 × 1000 | `terrain_near.f32` (12 MB) |
  | mid | 320 m | ±80 km | 500 × 500 | `terrain_mid.f32` (3 MB) |
  | far | 640 m | ±200 km | 625 × 625 | `terrain_far.f32` (4.7 MB) |

  `terrain.json` stores sizes, provenance, and an approximate affine map
  (grid col/row → scene x/z) used only to look up heights in the shadow shader.

### 4.5 Visible, partly hidden, hidden

For the Sun or Earth at a given time we take the terrain horizon at its azimuth
(linear interpolation between bins) and compare it with the disc:

- **Visible**: the whole disc is above the terrain.
- **Partly hidden**: part of the disc is covered (we show the visible %, treating
  the horizon as a straight line across the small disc).
- **Hidden**: no part of the disc is visible.

**Partly hidden counts as visible for communication**, which is the rule of the
NASA PGDA Earth visibility maps ("visible if any part of its disc is not
obscured"). The same rule defines **set** and **rise** times: we find the first
hourly sample where the state changes and interpolate linearly the top edge of
the disc against the horizon to get the minute. If nothing changes before the
data ends, the app says "> X (end of data)".

### 4.6 3D rendering

- **Terrain shader** (`src/scene/terrainShader.ts`): for every pixel it marches
  over the three height grids **toward the Sun** (and toward the Earth for the
  earthshine light) and finds the highest terrain angle: the same horizon method
  as the metrics (Mazarico et al. 2011). That gives **real cast shadows**, soft at
  the edge of the solar disc. Surface brightness uses the **lunar-Lambert**
  reflectance (McEwen 1991), standard for lunar photometry.
- **Horizon silhouette** at 300 km plus a thin gray **horizon line**: they show
  the exact computed horizon behind all terrain.
- **Sun**: a white disc at its real size plus a soft glow. From the Moon the Sun
  is white (it looks yellow on Earth because of our atmosphere).
- **Earth**: a disc shaded as a sphere lit from the real Sun direction (so the
  phase comes from geometry), textured with NASA Blue Marble. The orientation
  uses the Sun and Earth directions in both frames (RA/DEC and az/el) to get the
  rotation between the sky and the site (TRIAD method), the Earth's pole, and
  the Horizons sub-observer longitude. Seen from the lunar south pole the Earth
  appears roughly **south-up** (Antarctica on top), which is correct.
- **Labels** are plain HTML moved to the projected 3D position every frame.
- The canvas renders **on demand** (only when something changes) and caps the
  pixel ratio at 1.5 for speed.

### 4.7 Stack and why

| Choice | Why |
|---|---|
| **Vite** (not Next.js) | Client-side 3D app reading static files: no server rendering or API routes needed. Next.js would only add client-only boundaries and hydration issues. Static deploy (Vercel/Netlify). |
| **React 19 + TypeScript** | Typed data contract, no `any` (enforced by `tsc`). |
| **Tailwind CSS 4** | Fast, consistent layout. |
| **three.js + react-three-fiber + drei** | Full control of the camera, custom shaders and offline data. |
| **Python** for data | numpy, rasterio (reads remote COGs by parts, includes GDAL), pyproj (well-tested map projection math). The Horizons script uses only the standard library. |
| **Static files, no database, no live API** | Works offline; all math is done before the demo. |

## 5. Data and sources

| Data | Source | Notes |
|---|---|---|
| Site coordinates | Gläser et al. 2018, *Planetary and Space Science* 162, 170–178, Table 1 (Shackleton, surface level, "this study"), doi:10.1016/j.pss.2017.07.006 | -89.7849°, 203.97° E (south latitude, confirmed by Vanessa in the PDF). |
| Crater reference | USGS Gazetteer of Planetary Nomenclature, Shackleton (Feature 5450) | Center -89.67°, 129.78° E, diameter 20.92 km. Used only as a check. |
| Sun and Earth | NASA/JPL Horizons API (`ssd.jpl.nasa.gov/api/horizons.api`) | Raw replies kept in `data/raw/`. |
| Terrain | LOLA LDEM_80S_20MPP_ADJ, NASA PGDA product 90, Barker et al. 2023, *Planet. Sci. J.* 4, 183, doi:10.3847/PSJ/acf3e1 | Read remotely by parts. |
| Effective resolution check | LDEM_80S_20MPP_ADJ_EFFRES (same product) | Median 16 m within 10 km of the site. |
| Earth image | NASA Blue Marble Next Generation with topography and bathymetry, December 2004 (`world.topo.bathy.200412.3x5400x2700.jpg`), public domain | Resized to 2048 × 1024. |
| Validation references | Gläser et al. 2018; Horizons web app; Mazarico et al. 2011 (*Icarus* 211, method); McEwen 1991 (lunar-Lambert) | See below. |

Observer height **2 m** (lander solar panel height, as in Gläser et al. 2018).
Horizons site altitude **0 km** above the sphere (assumption: a few km change the
Sun/Earth direction by a negligible amount).

## 6. Validation

All checks are scripts you can rerun.

| Check | Result | Script / file |
|---|---|---|
| Our Horizons data vs the **Horizons web app** (filled in by hand, same site and hours) | 25 rows, max difference **0.0°** in azimuth and elevation | `scripts/compare_horizons_web.py`, `data/validation/horizons_web_earth_2026-11-14.txt` |
| **20-year sunlight** at the site vs **Gläser et al. 2018 Table 1** (2017–2037, Horizons every 6 h + our horizon) | Surface: average illumination **79.1%** vs 81.0%, solar visibility **83.9%** vs 85.5%. At 2 m: 83.5% / 88.2% (higher, as the paper says) | `scripts/check_illumination.py`, `data/validation/illumination_check.json` |
| **3D shadow method** (shader algorithm on CPU) vs horizon profile | Median **0.07°**, p95 0.23°, max 0.34°. Same visible/hidden decision: Sun **709/709**, Earth **706/709** (3 edge cases) | `scripts/check_shadow_method.py` |
| Rise/set times in the app vs independent Python | Same times (e.g. Earthset Dec 1 02:34 UTC), Earth link 50% vs 49.8% | checked during development |
| Map projection | Site → map → site returns -89.7849°, 203.97°; distance to pole 6522.56 m vs Horizons 6.52254 km | checked during development |
| Site is on the rim | 10.35 km from the USGS crater center; USGS radius 10.46 km | checked during development |
| **Earth phase** from geometry vs Horizons Illu% | Max difference **0.13 points** over the period | checked during development |
| **Earth orientation** vs Horizons | Sub-observer latitude within 0.25°; **subsolar point** within 0.19° lon / 0.26° lat at 60 times | checked during development |

The Gläser values (81.0%, 85.5%) were read from the PDF text; check them against
Table 1 on page 4 of the paper.

## 7. Real data vs visual aids

**There is no dummy data in the app.** Dummy sky data and a fake terrain were
used only in the first build steps and have been deleted. Every number in the
sidebar comes from Horizons + LOLA.

Some things are drawn differently from reality **only so they can be seen**.
They are listed in the app credits too:

| Visual aid | Why |
|---|---|
| Earthshine on the terrain is boosted | Real earthshine is far too faint next to sunlight to see. It uses the real Earth direction and phase. |
| Shadowed ground lifted to dark gray (not black) | So terrain never blends with the black sky. |
| Thin gray line on the computed horizon | Marks where ground ends and sky begins. |
| Earth night side shows the continents at 45% brightness | The real night side is dark; this keeps the Earth readable while the phase is still visible. |
| Soft glow around the Sun | The disc itself has the real size. |
| Zoom | Only changes the field of view (like binoculars); the indicator shows FOV and magnification. Bodies are never enlarged. |

## 8. Known limits

- **One site and one lunar day** (2026-11-14 to 2026-12-13). No custom
  coordinates yet.
- **Data period is short.** In this period the Sun never sets at this site (it
  is southern summer); the 20-year check shows about 16% of the time with no Sun.
- **Near ground looks smooth.** LOLA's effective resolution near the site is
  about 16 m: it cannot show rocks or small craters. This is a data limit.
- **Terrain beyond 200 km is ignored** (horizon and shadows).
- **Straight-line disc rule**: partial visibility treats the horizon as straight
  across the disc.
- **"Any part visible" is slightly optimistic for radio links** (PGDA says the
  same); real link budgets, antenna masks and DSN station visibility are not
  modelled.
- **Hourly samples**; set/rise times are interpolated (minute precision, not exact).
- Horizons site altitude 0 km; observer 2 m; no thermal model; power is only
  "Sun visible", not watts.
- Earth orientation uses the ICRF z axis as Earth's pole (precession since
  J2000 ≈ 0.4°, invisible at this size); phase from geometry ignores the Sun's
  parallax (error ≤ 0.13 points).
- The 3D shadow lookup uses an affine map whose residual grows with distance
  (curvature makes deep terrain "lean"); the height texture is resampled to
  compensate, and the check above shows the effect is small.
- **Not yet validated against Quickmap / Moon Trek** (planned).
- Performance: ~19 MB of terrain data; JS bundle ~1.1 MB (three.js).
- Python on macOS from python.org may lack SSL certificates (see section 12).

## 9. Discarded options

| Option | Why not (for now) |
|---|---|
| **Cesium Moon 3D Tiles** | Looks great, but uses a different terrain (a reported ~2.5 km offset vs LOLA, unverified) so the view could contradict our validated numbers; imagery has baked-in shadows that do not move with the date; needs internet and a Cesium ion token at demo time; would mean rewriting the 3D view. Could become a separate globe view later. |
| **Next.js** | No server features needed (see 4.7). |
| **Live API calls from the browser** | Demo must work offline; Horizons CORS not documented. |
| **Downloading the 5 m mosaic (3.3 GB)** | Not needed: the 20 m COG is read by parts. A 5 m patch near the camera is possible later (that file is also tiled). |
| **240 m data only (old "Plan B")** | Coarse terrain overestimates sunlight (Gläser et al. 2018) and good spots are only 20–40 m wide. |
| **three.js shadow maps** | Unreliable with the Sun 1–2° above the horizon; our shader uses the horizon method instead. |
| **lhorizon / astroquery / SpiceyPy** | Not needed: the Horizons API with the standard library was enough and validated. |
| **astronomy-engine in the browser** | ~1 arcminute accuracy; useful later for custom coordinates, not for validated numbers. |
| **Moon Trek imagery tiles** | No published terms of use; CORS not confirmed. |
| **Drawing the Earth bigger than real** | Would misstate size and when it hides behind terrain; zoom is used instead. |
| **Yellow Sun** | From the Moon the Sun is white. |
| **drei `Html` labels** | Lost labels with React 19 in development; replaced by our own projected labels. |
| Some links in a teammate's research doc | Mirrors instead of originals (e.g. an `lhorizon` link on a redirect domain, a Mintlify copy of USGS, copies of astronomy-engine docs). Use the official sources. |

## 10. Next steps

Priority for the pitch:

1. Validate the horizon against **Quickmap / Moon Trek** at the same site.
2. Record a **backup video** of the demo.
3. Prepare answers: why this data, how accurate, what is missing, why better
   than Quickmap/Horizons (one view, same data for picture and numbers, validated).

After the MVP (from the challenge and the brief):

- **Compare mode**: two sites or two dates side by side, same camera direction.
- **More sites**: Connecting Ridge C1/C2 (Gläser et al. 2018 Table 1), Artemis
  III candidate regions, CLPS targets; custom coordinates.
- **Timeline** of a lunar day; longer periods (seasons, the 18.6-year cycle).
- **2D horizon chart** (terrain profile + Sun/Earth paths) from the same data.
- **5 m terrain patch** near the camera.
- Validation against the **PGDA Earth visibility and illumination maps**
  (product 69, Mazarico et al. 2011).
- Educator mode; deploy as a static site.

## 11. Project structure

```
concorde/
├── README.md                 this file (reference)
├── README.es.md              Spanish version of this file
├── docs/PROJECT_MEMORY.md    full project history and decisions
├── reference-image.jpeg      reference image from the idea (external paper, not used as data)
├── index.html, vite.config.ts, tsconfig*.json, package.json
├── public/
│   ├── data/shackleton-rim/  sky.json, horizon.json, terrain.json, terrain_*.f32
│   └── textures/             earth_bmng_topo_bathy_200412_2048.jpg
├── data/
│   ├── raw/                  raw Horizons replies (evidence)
│   └── validation/           Horizons web export, 20-year illumination check
├── scripts/                  Python: data generation and validation
│   ├── fetch_horizons.py     Sun/Earth from Horizons -> sky.json
│   ├── build_terrain.py      LOLA -> horizon.json + terrain grids
│   ├── compare_horizons_web.py
│   ├── check_illumination.py
│   ├── check_shadow_method.py
│   └── requirements.txt
└── src/
    ├── App.tsx               loads data, shows loading/error, renders SiteView
    ├── types.ts              data contract (all typed, no `any`)
    ├── data/loadSiteData.ts  thin data layer: fetch + validate static files
    ├── scene/                pure logic: geometry, visibility, timing, shaders
    │   ├── constants.ts      observer height, axes
    │   ├── skyMath.ts        az/el -> direction, disc size
    │   ├── visibility.ts     horizon lookup, disc fraction, state
    │   ├── windows.ts        rise/set times, % visible
    │   ├── timing.ts         timing metrics type
    │   ├── formatTime.ts     UTC and duration formatting
    │   ├── terrainGrid.ts    geometry + height textures from grids
    │   ├── terrainShader.ts  shadows + lunar-Lambert shading (GLSL)
    │   ├── earthOrientation.ts  Earth pole / sub-observer frame (TRIAD)
    │   └── viewLimits.ts     zoom limits
    └── components/           React components (one job each)
        ├── SiteView.tsx      shared time selection, sidebar + 3D view
        ├── Sidebar.tsx, DateTimeControl.tsx, MetricsPanel.tsx,
        │   StatusBadge.tsx, PeriodSummary.tsx, Credits.tsx
        └── MainView.tsx      Canvas: Terrain, HorizonSilhouette, SunDisc,
            EarthDisc, ScreenLabels, LookControls, CompassOverlay, ViewControls
```

Git: work happens on `stage`; `main` gets `stage` when it is ready.

## 12. Regenerate the data

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
```

```bash
python3 scripts/fetch_horizons.py
```

```bash
.venv/bin/python scripts/build_terrain.py
```

Validation:

```bash
python3 scripts/compare_horizons_web.py
```

```bash
.venv/bin/python scripts/check_illumination.py
```

```bash
.venv/bin/python scripts/check_shadow_method.py
```

To change the site or period, edit `SITE`, `START_UTC` and `STOP_UTC` in
`fetch_horizons.py` and the site constants in `build_terrain.py`, then run both.

**SSL error on macOS** (`CERTIFICATE_VERIFY_FAILED`, common with the python.org
installer): export the macOS trusted certificates and point Python/GDAL to them
for that run only.

```bash
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain /Library/Keychains/System.keychain > /tmp/macos-ca.pem
```

```bash
SSL_CERT_FILE=/tmp/macos-ca.pem CURL_CA_BUNDLE=/tmp/macos-ca.pem .venv/bin/python scripts/build_terrain.py
```

The PGDA server sometimes answers **403** to bursts of range requests; the
terrain scripts retry automatically.

## 13. Credits

- NASA/JPL Horizons (Solar System Dynamics Group).
- LOLA DEM: Barker et al. 2023, NASA Goddard PGDA.
- Site and sunlight reference: Gläser et al. 2018.
- Horizon method: Mazarico et al. 2011. Lunar-Lambert: McEwen 1991.
- Earth image: NASA Earth Observatory, Blue Marble Next Generation.
- USGS Gazetteer of Planetary Nomenclature.
- Reference image of the idea: an external paper Vanessa provided, used only as
  visual inspiration (not data, not part of this challenge).

NASA does not endorse this project. Respect each source's data use terms.
