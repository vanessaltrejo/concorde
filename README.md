# Lunar Landing Site Simulator

**English** · [Español](README.es.md)
(If the two versions ever differ, this English file is the reference.)

A web tool to **compare Moon landing sites and dates**. The **Orbital view**
is a 3D Moon globe with NASA maps where you pick a site or an area. The
**Horizon view** puts you on the surface of that site and shows where the
**Sun** (power) and the **Earth** (direct communication) are in the sky at any
hour, and whether the **real terrain** hides them. Web address:
**concordemoon.com**.

Built for **NASA Space Apps Challenge 2026**, challenge *"Lunar Landing Site
Simulator"*. Current sites: **Shackleton rim, Connecting Ridge C1 and C2** (south
pole), **Mons Mouton, Malapert A and Schrödinger Basin** (NASA CLPS landing
sites) and **Apollo 11, 16 and 17**. Current period: **90 days, 2026-11-14 to
2027-02-12 UTC**, hourly.

> **Planning aid, not flight grade.** Every number comes from public NASA data
> and is checked against an independent source (see [Validation](#6-validation)),
> but this is a hackathon tool, not mission software.

**Status (2026-11-15).** Working: **Dashboard**, **Orbital view** with 5 map
layers, **Horizon view** with real shadows and a real star sky, **Compare sites**
(up to 3 site-and-date scenarios with a goal score), 9 sites, arrival date and
stay length, requirements with a zone map around the south pole, and the CLPS
missions of each site. The AI assistant is built (it needs a model key, see
[`docs/AI_ASSISTANT_PLAN.md`](docs/AI_ASSISTANT_PLAN.md)) and knows all four
tabs. Not built yet: zones for the whole Moon, custom coordinates, the impact
KPIs of the Dashboard (placeholders only, no invented numbers), and the data of
three more CLPS sites (Mare Crisium, Reiner Gamma, Gruithuisen Domes). See
[Next steps](#10-next-steps).

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

**Our focus:** a few sites done right, and fast comparison. A first-person view
where what you *see* (terrain hiding the Earth) and what the numbers *say* come
from the same NASA data, with a map to pick and compare sites and dates, and
every number validated.

## 2. What the app does

A bar on the left switches between the **Dashboard**, the **Orbital view**, the
**Horizon view** and **Compare sites**; a chat button at the bottom opens the AI
assistant. The app opens on the Orbital view, with a clean address (`/`). Panels
are dark gray cards over the views, with NASA blue for buttons and selected
items and a little NASA red only for small accents. Toggles and sliders are
white.

The left bar shows each tab's name under its icon and can collapse to icons
only. Below the tabs, **Saved places** lists the pins you dropped on the Moon
(name and coordinates): click one to fly to it, the pencil (or a double-click)
renames it, the bin deletes it. Pins are kept in your browser only.

**Orbital view (the Moon globe)**

- Click any point: it blinks on the globe and the right panel shows it (date,
  stay, Sun and Earth, 2D horizon) with **Save point** (it becomes a pin) and
  **Open Horizon view here**. Hovering (or clicking) a pin shows its coordinates and
  two buttons: **Horizon view** and **Compare** (any point on the Moon can be
  compared, not only the curated sites).
- **Layers** (bottom left, a thumbnail of the active map): opens the map layers
  with a short description each, and **Markers** toggles for study sites,
  historic missions, future missions and your pins.
- **+ / −** buttons zoom the globe in and out.

- A smooth 3D Moon sphere (CesiumJS) with NASA Moon Trek imagery. It loads only
  the map tiles needed for the current zoom, so it needs internet. Click anywhere
  to read latitude and longitude (degrees east, 0 to 360).
- **Map layer**, one at a time: Image (LRO photo mosaic), Hillshade, Elevation,
  Slope and Temperature (night, max, min). Each layer card gives the source, the
  coverage and its limits. There are no value legends, because Moon Trek gives
  none for these tiles. Near the south pole, Hillshade and Elevation add the LOLA
  5 m south pole model.
- **Site** menu (South pole: Shackleton rim, Connecting Ridge C1, C2. CLPS
  missions: Mons Mouton, Malapert A, Schrödinger Basin. Apollo landing sites: 11,
  16, 17) or click a marker: the camera flies there. For the
  selected site you get the date and time, the **stay length**, the **CLPS
  missions** that land there (completed or scheduled, with year), a **Compare**
  flag button, the % of the
  stay with Sun and with Earth link, a **Horizon preview** (the real horizon
  with the Sun and Earth, which hide behind terrain), a **Topography** picture
  of the zone, and the buttons *Open Horizon view* and *Back to globe*.
- **Requirements** (Sun during the stay, Earth link during the stay, slope at
  the site). Each can be switched off. They mark the 9 sites (green ✓ meets,
  gray ✕ excluded) and, with **Show on map**, color **2,500 zone cells** of 1 km
  around the south pole (green meets, faint gray does not). Everything is
  recalculated when you change the arrival date, the stay length or a threshold.
  Click a cell for its values. Wording: *screening only, not "safe"*.

**Horizon view (first person, from the site)**

- **Left sidebar**: site name and coordinates, date and time (slider over 2,161
  hourly samples), **Sun (power)** and **Earth (direct link)** (status ●/◐/○,
  set or rise time to the minute, elevation, azimuth, terrain horizon there,
  Earth lit fraction), the **Stay** panel (% of the stay with Sun and Earth),
  the **period summary** and the credits.
- **Main area**: first-person camera 2 m above the ground (lander height), you
  only look around. Drag to look, scroll / pinch or **− / +** to zoom (field of
  view 60° down to 2°), **Look at Sun / Look at Earth**. Real LOLA terrain with
  **real cast shadows**, the Sun and Earth discs at their **real angular size**
  (the Earth with its real phase and the side that faces the Moon), a compass
  and a thin gray line on the computed horizon. **⌖ Center view** returns to the
  starting direction, level horizon and no zoom. **← Back to Orbital view** keeps
  the date. The sky is a real star map (Tycho-2) plus point stars. The sidebar
  floats over the view as a card and also shows the site's CLPS missions and a
  **Compare** flag button.

**Dashboard (first tab)**

- A **Welcome** hero with the site menu, the arrival date, the stay length, the
  buttons *Open Horizon view* and *Compare sites*, and a **Simple / Detailed**
  switch (Simple hides technical columns).
- **Key numbers**: ring gauges for the % of the stay with Sun and with Earth
  link (with the change against the previous stay of the same length), and two
  mission-control countdowns: *Sunset in / Sunrise in* and *Earthset in /
  Earthrise in*.
- **Your stay, hour by hour**: Sun and Earth elevation over the stay, with two
  bars: *Power* (Sun above the real terrain horizon) and *Link* (Earth above it).
- **Sky now**: the real 360° horizon with the Sun and the Earth, plus Sun and Earth
  height, the longest dark gap and the slope.
- **90 days of sunlight** for every site (share of each UTC day with Sun). Click a
  day to set the arrival date; the outline is your stay.
- **Best sites for your goal**: all sites ranked by goal (Power, Communications,
  Safe landing, Balanced), with *Export CSV*.
- **Impact**: KPIs such as planning hours saved. They are **placeholders** (`—`)
  until the team's research defines them; no numbers are invented
  (`src/data/kpis.ts`).

**Compare sites**

- Up to **3 scenarios**, each one a **site plus an arrival date**. Add them with
  the *Compare* flag button on any site, or from the empty slot. *Same site, 7
  days later* copies a card one week on (what if the launch slips).
- Cards are **draggable**: the position is your own order (**1st, 2nd, 3rd**).
  *Order by model suggestion* sorts them by score.
- Each card: arrival date, a 0 to 100 **goal score**, the horizon preview, five
  bars (time with Sun, Sun continuity = shortest dark gap, mean Sun height, time
  with Earth, flatness), a star on the best card for each bar, whether it meets
  the default requirements, and the CLPS missions. A radar overlays the cards.
- The highest score gets a separate **Model suggestion** tag. It does not change
  your 1st/2nd/3rd order. The score is a transparent weighted mean (see
  [4.13](#413-dashboard-and-compare-scoring)), not an AI.

**Shared by all views:** the date and time and the stay length. The address
bar keeps the screen
(`/dashboard`, `/orbital-view`, `/horizon-view`, `/compare` or `/references`). The
address shows only the screen, never the site, date or comparison, so it stays short.
The app opens on the Dashboard. Old links with `?view=&site=&t=` still open on that
state once, and the address is then cleaned.

**Examples (pitch story)**

- Shackleton rim, 2026-11-17 00:00 UTC: the Earth is half hidden behind a ridge
  (52% of the disc visible) and the next loss of direct link is on 2026-12-01
  02:34 UTC. At 11-17 12:00 it is visible even at -0.40° elevation, because from
  the high rim the terrain drops to about -1.35° there; a flat-horizon tool would
  call it hidden. Over the 90 days: Sun 99%, Earth link 55%.
- Small changes in place matter: 16 km from Shackleton, Connecting Ridge C2 loses
  the Sun on 2026-11-14 at 09:10 UTC behind terrain at 0.76°.
- Arrival 2026-11-28, 6.5 day stay: the three south pole sites keep the Sun 100%
  of the stay, while Apollo 11, 16 and 17 get only 28%, 40% and 17% (lunar
  night), but have the Earth 100% of the time.
- Same date and default requirements: 53 of the 2,500 south pole cells meet them.

## 3. Run it

Requirements: **Node.js** (tested with v25.2.1, npm 11.9.0).

```bash
npm install
npm run dev
```

Open the address Vite prints (http://localhost:5173). All site data is already
in `public/data`. The **Horizon view works offline**; the **Orbital view needs
internet** for the NASA Moon Trek map tiles. Loading is on demand: the first
download is small (about 0.3 MB of app code); CesiumJS (about 4 MB) loads only
for the Orbital view and the 3D Horizon code (about 1 MB) only when that tab
opens. The terrain of a site (about 19 MB for a south pole site, 30 MB for the
two CLPS sites near the pole, about 1.3 MB for an Apollo site) is loaded only
when its Horizon view opens; the previews and the Dashboard use only about 1 MB
per site.

Other commands:

```bash
npm run build    # strict type check (no `any` allowed) + production build in dist/
npm run lint     # oxlint
npm run preview  # serve the production build
```

The Python scripts are only needed to **regenerate** data
(see [section 12](#12-regenerate-the-data)).

**Deploy.** It is a static site (Vite): Vercel detects `npm run build` and the
output folder `dist`. Deploy only the `concorde` project (not the `scripts`
folder). `package.json` asks for Node 22 or newer. The canonical address and the
social preview (title, description, image) are in `index.html` for
`https://concordemoon.com`.

**AI assistant.** One serverless function, `api/chat.ts`, holds the model key
(Vercel runs it; `npm run dev` serves it through a plugin in `vite.config.ts`).
Copy `.env.example` to `.env.local` locally, and set the same names in Vercel's
environment variables. Never prefix the key with `VITE_`. Without a key the rest of the app
works and the assistant panel says it is not configured. Design, limits and the
test set: [`docs/AI_ASSISTANT_PLAN.md`](docs/AI_ASSISTANT_PLAN.md),
[`docs/AI_ASSISTANT_EVAL.md`](docs/AI_ASSISTANT_EVAL.md).

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
| **Vite** (not Next.js) | Client-side 3D app reading static files: no server rendering or API routes needed. Next.js would only add client-only boundaries and hydration issues. Static deploy (Vercel/Netlify); the AI assistant adds one serverless function (`api/chat.ts`). |
| **React 19 + TypeScript** | Typed data contract, no `any` (enforced by `tsc`). |
| **Tailwind CSS 4** | Fast, consistent layout. |
| **three.js + react-three-fiber + drei** | Full control of the camera, custom shaders and offline data (Horizon view). |
| **CesiumJS** | The Orbital view: Moon globe, tiled imagery loaded by zoom, picking. Loaded only for that view. |
| **Python** for data | numpy, rasterio (reads remote COGs by parts, includes GDAL), pyproj (well-tested map projection math). The Horizons script uses only the standard library. |
| **Static files, no database, no live API** | All site math is done before the demo (the Horizon view works offline; the Orbital view needs internet for its map tiles). |

### 4.8 Orbital view

- **CesiumJS** (loaded lazily, its own chunk of about 4 MB) with the Moon
  ellipsoid (radius 1737.4 km) and no terrain, so the globe is smooth. Relief is
  shown only through the map layers. Why Cesium: tile loading by zoom, WMTS and
  picking latitude / longitude without writing it by hand.
- **Imagery**: NASA Moon Trek tiles (equirectangular, 256 px, 2 × 1 tiles at level
  0). The LRO WAC photo mosaic is the base; one layer is drawn over it. The layer
  list is a registry (`src/data/layers.ts`) with, for every product, the real
  highest tile level and its coverage box, checked against its
  `WMTSCapabilities.xml` and with tile requests (the next level returns 404), so
  no tiles are requested outside the data.
- **Performance**: render on demand, one 3D view mounted at a time (the globe is
  removed when the Horizon view opens, and the other way round), only the open
  site's files in memory, previews from small files.
- The Topography picture of each curated site is a stored file
  (`public/topography/<id>.jpg`, 40 km wide, LOLA shaded relief from Moon Trek,
  north up), so it appears at once. Points saved by the user have none yet.

### 4.9 Sites and their data

- Sites are listed in `scripts/sites.py` (data) and `src/data/sites.ts` (app),
  with the source of each coordinate. Every site has a folder
  `public/data/<site>/` with `sky.json`, `horizon.json` and the terrain grids.
- **South pole sites** (Shackleton rim, Connecting Ridge C1, C2): LOLA 20 m
  polar DEM, horizon to **200 km**, three grids (20 m, 320 m, 640 m).
- **Other sites** (Apollo 11, 16, 17): the LOLA 118 m global DEM (USGS), read in
  chunks of rows, horizon to **50 km**, grids of 118 m, 474 m and 948 m. At Apollo
  11 a 50 km horizon equals the 200 km one (0 of 1440 bins differ). Near the pole
  200 km is needed (PROJECT_MEMORY problem #14), so the polar path keeps it.
- **CLPS sites** (Mons Mouton, Malapert A, Schrödinger Basin; more to come): same
  global 118 m path as Apollo, 50 km radius. Mons Mouton (-84.6°) and Malapert A
  (-84.1°) are not inside the 20 m polar file (it covers latitudes -86° and
  south), so they use the global model, stretched in the east-west direction,
  which makes their files larger (about 30 MB). Coordinates come from NASA's CLPS
  pages with one decimal (about 3 km), so they are marked *to confirm*. Near the
  pole terrain beyond 50 km can matter (PROJECT_MEMORY problem #14): their Sun
  percentages may be slightly optimistic until compared against a 200 km horizon.
- Sun and Earth: one Horizons request per site (`fetch_horizons.py --site <id>`),
  hourly for 90 days.
- A new site needs both scripts (`--site <id>`) and an entry in the two site
  lists.

### 4.10 Stay and arrival date

The arrival is the selected date and time; the stay has a length in days
(default 6.5, from NASA lunar site selection 2023; range 0.5 to 29.5). The app
counts the hourly samples in the range [arrival, arrival + stay) with the same
rule as everywhere (some part of the disc above the terrain). If the stay runs
past the end of the data it says how many days are really counted.

### 4.11 Requirements and the zone map

- **Sites**: Sun % and Earth link % of the stay, and the slope at the site (plane
  fit to the terrain nodes around it, `scripts/site_slopes.py`: 100 m baseline for
  polar sites, about 355 m for Apollo; the baseline is always shown). Defaults:
  Sun ≥ 100%, Earth ≥ 25% (the NASA origin of this value is not verified), slope
  ≤ 10° (NASA Artemis lander requirement, about 100 m scale).
- **Zone grid** (`scripts/build_zones.py`): a 50 × 50 km box centered on the south
  pole in **1 km cells** (2,500). Per cell it stores the slope share (% of the
  cell area with slope ≤ 1…30°, 100 m baseline, LOLA 20 m) and the horizon of its
  **4 highest 20 m spots** (at least 200 m apart; rims and ridges get the most
  light, Gläser et al. 2018), 360 azimuth bins, terrain 20 m to 2 km, 80 m to 20
  km, 160 m to 60 km and 320 m to 200 km. About 27 minutes, 7.6 MB.
- **In the browser** (`src/scene/zones.ts`): Sun and Earth for any point come
  from `public/data/ephemeris.json` (sub-solar and sub-Earth points and
  distances from Horizons, hourly), which includes the Earth's parallax (up to
  0.26°). A cell meets Sun and Earth if **any** of its spots does. It meets the
  slope requirement if at least **20% of its area** is under the limit (a value
  chosen by the team, not an official one).
- A cell is much wider than the best spots (20 to 40 m, Gläser et al. 2018), so
  this is screening, not site selection.

### 4.12 App state and robustness

The selected time and the stay length live in `App` and are shared by both views;
the address bar mirrors them. TypeScript is `strict`. An error boundary shows a
message instead of a blank page if a view fails (for example no WebGL).

### 4.13 Dashboard and Compare scoring

Both use the same numbers (`src/scene/compare.ts`), for the selected arrival and
stay, from the same horizon rule as the rest of the app. Five axes, each 0 to 100:

| Axis | How |
|---|---|
| Time with Sun | % of the stay with part of the Sun above the terrain |
| Sun continuity | 100 minus the longest Sun-less gap as a share of the stay |
| Sun height | mean Sun elevation while visible; 30° counts as 100 |
| Time with Earth | % of the stay with part of the Earth above the terrain |
| Flatness | 100 at 0°, 0 at 10° (the HLS slope limit); left out if the site has no slope |

A goal is a set of weights (Power: Sun .45, continuity .35, height .1, flatness
.1; Communications: Earth .8; Safe landing: flatness .5; Balanced: all axes). The
score is the weighted mean of the axes that have data. **The weights and the 30°
cap are a first proposal, not validated mission numbers.** Timelines are cached
per loaded site and the arrival time is found by index (the data is hourly), so
the Dashboard recomputes quickly. Scores are screening only.

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

**Added after the first version (2026-11-14)**

| Data | Source | Notes |
|---|---|---|
| Connecting Ridge C1 and C2 | Gläser et al. 2018, Table 2 (2 m above ground): C1 -89.4398°, 222.83° E; C2 -89.3130°, 245.98° E | Table 3 lists clusters C1-0, C1-1, C2-0, C2-1 without coordinates, so they are not used. Values read from the PDF text; confirm in the PDF. |
| Apollo 11, 16, 17 | NSSDC *Apollo Landing Site Coordinates* (Lunar Module), Wagner et al. 2017, Icarus 283, 92-103 | Planetocentric, Mean Earth/Polar Axis, DE421. |
| Terrain away from the pole | LOLA global DEM 118 m (USGS Astrogeology, `Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014`) | Read in chunks of rows, no full download. |
| Orbital view maps | NASA Moon Trek WMTS tiles: LRO WAC mosaic, LOLA hillshade and colour hillshade, LOLA/Kaguya slope, LOLA 5 m south pole shade, Diviner temperature | Terms of use for Moon Trek not found; shown with a credit. |
| Sun/Earth for any point | Horizons table of the Moon seen from Earth (`ephemeris.json`) | Sub-Earth and sub-solar points and distances. |
| Slope at the sites | Computed from our terrain files (`site_slopes.json`) | Baseline shown with each value. |

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

**Added after the first version (2026-11-14)**

| Check | Result | Script / file |
|---|---|---|
| Connecting Ridge, 20 years vs **Gläser Table 2** (2 m) | C1: illumination **87.56%** vs 88.0%, solar visibility **91.8%** vs 92.1%. C2: **77.87%** vs 78.1%, **81.82%** vs 82.0% | `check_illumination.py --site <id>`, `data/validation/` |
| Sun/Earth for **any point** vs Horizons' own per-site tables | Within **0.006°** at Shackleton, C1, C2, Apollo 11 and 17 | `fetch_ephemeris.py` |
| Stay percentages vs an independent count (Shackleton, 6.5 days) | Arrival Nov 14: 62.8%; Nov 28: 48.1%; Nov 30: 17.3%; Dec 2: 0% (Sun 100%) | checked with a separate Python count |
| Zone horizons vs the validated 20 m site horizons | Max **0.23°**, 95th percentile 0.10° (3 south pole sites) | `build_zones.py --check` |
| Zone cells vs the sites they contain | Shackleton rim cell Sun 100% / Earth 48.7% (site 100% / 48%); C1 and C2 cells same as the sites | checked in the browser |
| 50 km horizon vs 200 km away from the pole | 0 of 1,440 bins differ at Apollo 11 (a flat mare site; not tested in highlands) | measurement |
| 90-day data vs the first month | The first 709 samples are identical (0.0°) | checked when extended |

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

**Added after the first version (2026-11-14)**

| Visual aid | Why |
|---|---|
| Globe maps are photos and colour maps, not measurements | Their lighting is part of the picture and does not follow the date. Hillshade has a fixed light direction. |
| Zone cells drawn green / gray | A summary of the requirements for screening, not a safety map. |
| Horizon preview draws the Sun and Earth as small dots | It is a quick look, not to scale (the Sun is 0.5° wide, the Earth 1.8°). |
| Map layer colours have no value scale | Moon Trek gives none for these tiles, so none is invented. |

## 8. Known limits

- **Sites and period.** Nine curated sites and 90 days (2026-11-14 to
  2027-02-12). Missions without a landing point (Peregrine, which did not land;
  Blue Moon Pathfinder, "south polar region"; Blue Ghost 2, farside and orbit)
  are listed in a note, not on the map. Mare Crisium, Reiner Gamma and
  Gruithuisen Domes have coordinates but their data is not generated yet. No custom coordinates yet: a new site needs the Python scripts,
  because browsers cannot read LOLA or Horizons directly (no CORS).
- **Zone map.** Only the south pole, in a 50 × 50 km box, 1 km cells, judged at
  the 4 highest spots of each cell. Slope uses a 100 m baseline from LOLA 20 m.
  The 20% area rule and the 25% Earth threshold are team values, not official.
  Away from the pole there is no zone map.
- **Apollo sites** use 118 m terrain and a 50 km radius, tested against 200 km
  at Apollo 11 only. Their horizons are not compared with an independent source
  yet (Quickmap).
- **Orbital view** needs internet for the map tiles and its terms of use could
  not be found (credit shown). The photo layer looks poor at the south pole
  (equirectangular tiles stretch there); Hillshade and Elevation use the 5 m
  polar model instead. There are no value legends, and the night temperature map
  has a coarse look and a seam.
- **Slope** depends on the scale of measurement; values with different baselines
  are not comparable.

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
| **Live API calls from the browser** | Not possible: Horizons and LOLA send no CORS header (checked 2026-11-14). The demo also needs to be reliable. |
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

**Added later (2026-11-14)**

| Option | Status |
|---|---|
| Browser calls to Horizons / LOLA for custom coordinates | Not possible without CORS. A small server would be needed (postponed until after the pitch). |
| SPICE kernels for the ephemeris | Not needed: one Horizons table plus geometry matches Horizons within 0.006°. |
| Cesium Moon 3D tiles | Still discarded. The globe uses the CesiumJS library with Moon Trek tiles on a smooth sphere. |
| CGI Moon Kit images for the globe | Moon Trek tiles were chosen (sharper, whole Moon, same NASA source). |

## 10. Next steps

Priority for the pitch:

1. Validate the horizons (including Apollo) against **Quickmap / Moon Trek** at the
   same sites.
2. Record a **backup video** of the demo (Orbital view → site → Horizon view → change
   the date → requirements and zones).
3. Check the thresholds with their NASA documents (Earth ≥ 25%, slope 10°) and the
   Moon Trek terms of use.
4. Prepare answers: why this data, how accurate, what is missing, why better than
   Quickmap/Horizons (one place, same data for picture and numbers, validated).

After that:

- **Zones for the whole Moon**: cells of 1° with Sun and Earth from geometry (no
  terrain shadows, labelled as such). A global slope would need a global DEM
  (decision pending: skip slope or use a coarse one).
- **Custom coordinates** with a small server that runs the Python pipeline.
- **Requirement scores** (nice-to-have with weights, presets for lander types).
- **Impact KPIs** on the Dashboard (hours or money saved) from the team's research of
  today's process; the Dashboard is built, the KPI cards stay `—` until then.
- **AI assistant**: built (tools over the app's data, strict number check, voice
  input), not yet tested with a live model; run the test set once the key exists.
- **Compare**: review the goal weights and the 30° Sun height cap with the team;
  compare the new CLPS horizons (50 km) against a 200 km horizon; confirm the CLPS
  coordinates on NASA's pages; generate Mare Crisium, Reiner Gamma and Gruithuisen
  Domes; a smaller terrain format (store heights only, about 3 to 6 times smaller).
- A timeline of the lunar day, a 2D horizon chart, finer zone cells (500 m, about
  4 times slower).
- The full plan by phases and its results are in [`docs/PLAN.md`](docs/PLAN.md).

## 11. Project structure

```
concorde/
├── README.md                 this file (reference)
├── README.es.md              Spanish version of this file
├── docs/PROJECT_MEMORY.md    full project history and decisions
├── docs/PLAN.md              build plan by phases, with each phase's result
├── reference-image.jpeg      reference image from the idea (external paper, not used as data)
├── index.html                page head: title, description, social preview, structured data
├── api/                      serverless function for the AI assistant (chat.ts, _lib/)
├── vite.config.ts, tsconfig*.json, package.json
├── public/
│   ├── data/<site>/          sky.json, horizon.json, terrain.json, terrain_*.f32 (9 sites)
│   ├── data/zones/           south-pole-1km*.{json,bin}: zone cells, horizons, slope
│   ├── data/ephemeris.json   Sun/Earth for any point, hourly
│   ├── data/site_slopes.json slope at each site
│   ├── textures/             Earth map, stars/ and stars-h/ (Tycho-2 star map), moon-hero.png
│   └── og-image.jpg, favicon.svg, apple-touch-icon.png, robots.txt, sitemap.xml
├── data/
│   ├── raw/                  raw Horizons replies (evidence)
│   └── validation/           Horizons web export, 20-year illumination checks
├── scripts/                  Python: data generation and validation
│   ├── sites.py              curated sites (use --site <id>)
│   ├── fetch_horizons.py     Sun/Earth from Horizons -> sky.json
│   ├── build_terrain.py      LOLA -> horizon.json + terrain grids
│   ├── build_zones.py        zone cells around the south pole
│   ├── fetch_ephemeris.py    Sun/Earth for any point -> ephemeris.json
│   ├── site_slopes.py        slope at each site -> site_slopes.json
│   ├── compare_horizons_web.py, check_illumination.py, check_shadow_method.py
│   └── requirements.txt
└── src/
    ├── App.tsx               views, shared time and stay, address bar state, lazy loading
    ├── types.ts              data contract (all typed, no `any`)
    ├── data/                 loadSiteData.ts (static files), sites.ts (sites and CLPS missions), kpis.ts (impact KPI placeholders), layers.ts (map layers)
    ├── state/                urlState.ts (?view=&site=&t=&stay=&cmp=), scenarios.ts (Compare scenarios)
    ├── assistant/            AI assistant panel, tools, number check (see docs/AI_ASSISTANT_PLAN.md)
    ├── scene/                pure logic
    │   ├── visibility.ts, windows.ts, timing.ts   horizon lookup, rise/set, %
    │   ├── stay.ts           stay percentages
    │   ├── compare.ts, dashboard.ts   five axes and goal score; daily Sun for the heatmap
    │   ├── requirements.ts   site requirements
    │   ├── zones.ts          zone cells: Sun/Earth for any point, requirements
    │   ├── timeSelection.ts, terrainInfo.ts, formatTime.ts, skyMath.ts, constants.ts, viewLimits.ts
    │   └── terrainGrid.ts, terrainShader.ts, earthOrientation.ts   Horizon view 3D
    └── components/           React components (one job each)
        ├── NavRail, ErrorBoundary, FlagButton, MissionList
        ├── Dashboard: DashboardTab. Compare: CompareTab (cards, radar)
        ├── Orbital view: MoonGlobe, LayerSelector, SitePanel, HorizonPreview,
        │   StayPanel, RequirementsPanel, zoneLayer
        └── Horizon view: SiteView, Sidebar, MetricsPanel, DateTimeControl, StatusBadge,
            PeriodSummary, Credits, MainView (Terrain, SunDisc, EarthDisc, ...)
```

Git: work happens on `stage`; `main` gets `stage` when it is ready.

## 12. Regenerate the data

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
```

For a site (default `shackleton-rim`; ids are in `scripts/sites.py`, e.g.
`connecting-ridge-c1`, `apollo-17`):

```bash
python3 scripts/fetch_horizons.py --site apollo-17
```

```bash
.venv/bin/python scripts/build_terrain.py --site apollo-17
```

Shared data and the zone map:

```bash
python3 scripts/fetch_ephemeris.py
```

```bash
.venv/bin/python scripts/build_zones.py
```

```bash
.venv/bin/python scripts/site_slopes.py
```

Validation:

```bash
python3 scripts/compare_horizons_web.py
```

```bash
.venv/bin/python scripts/check_illumination.py --site connecting-ridge-c1
```

```bash
.venv/bin/python scripts/check_shadow_method.py
```

To change the period, edit `START_UTC` and `STOP_UTC` in `fetch_horizons.py` and
`fetch_ephemeris.py`, then run them for every site. To add a site, add it to
`scripts/sites.py` and `src/data/sites.ts`, then run the two site commands.
`build_zones.py` takes about 27 minutes (add `--cells 20` to time it,
`--check` to compare it with the site horizons).

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
- Orbital view maps: NASA Moon Trek (LRO WAC mosaic; LOLA hillshade, colour
  hillshade and slope with Kaguya; LOLA 5 m south pole model; Diviner
  temperature). CesiumJS (Apache 2.0).
- LOLA global DEM 118 m: USGS Astrogeology. Apollo coordinates: NASA NSSDC, Wagner
  et al. 2017.
- Reference image of the idea: an external paper Vanessa provided, used only as
  visual inspiration (not data, not part of this challenge).

NASA does not endorse this project. Respect each source's data use terms.
