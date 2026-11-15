# Build plan: Moon map, overlays and sky view by zone

Written 2026-11-14. It compares two plans and gives one final plan in phases.

- **Plan A** (this repo, Vanessa + Claude): the chat decisions after the nav rail
  was built: hybrid approach, Moon Trek globe, per-zone data ("Minecraft"),
  Connecting Ridge and Apollo sites.
- **Plan B** (teammate): `landing_site_map_implementation_context.md` plus the
  team sketches (Main without criteria, Main with criteria, Main with selection
  of region, Horizon view, Topography view).

Neither plan is taken as true by default. Every claim below says whether it was
**checked** (with how) or is **not verified**.

Rules that still apply (from `docs/PROJECT_MEMORY.md`): no dummy data, every
number has a named source, "planning aid, not flight grade", no commits or
downloads without Vanessa's approval, one phase at a time.

---

## 0. How Vanessa wants us to work (read before every phase)

- **Do not assume. Ask.** If a fact, value, file name or decision is missing,
  ask Vanessa instead of guessing. Never invent numbers, coordinates or sources.
- **Question both plans, always.** Plan A, Plan B and this file can be wrong.
  Before each phase, check whether there is a better or simpler way and say so.
- **Act as a mentor.** Explain the why, ask questions that make her think, and
  say clearly when something is a guess.
- **Small steps.** One phase at a time: plan → wait for approval → build →
  checklist → wait for her confirmation. Nothing is done "just because".
- **No commit, push, merge or download** without her approval (state file,
  source and size for downloads).
- **Chat in Spanish.** Code, comments, docs and anything published in simple
  English.
- **Before each phase, tell her the suggested model and effort**, and say
  clearly when a phase should use **Fable** (she has it free this week).
- **Do not repeat old problems.** Read `docs/PROJECT_MEMORY.md` section 4 before
  touching the area it describes.

## 0.1 Guardrails: do not break what works

What works today and must keep working after **every** phase:

- The Shackleton Sky view: terrain, real shadows, Sun and Earth discs with real
  size and phase, labels, compass, zoom, "Look at Sun / Earth", date slider,
  metrics (status, set/rise times, elevation, azimuth, terrain horizon, lit
  fraction), period summary, credits.
- Its data files in `public/data/shackleton-rim/` and the validation scripts.

How we protect it:

1. **New features are added, not swapped in.** The validated path (Horizons +
   `build_terrain.py` files per site) stays the default. "Sky view anywhere"
   is a second data source that produces the **same data types**
   (`SiteData`); the view does not change.
2. **Existing files are not regenerated or moved** unless Vanessa approves it.
3. **Regression check at the end of every phase** (short, always the same):
   - `npm run build` and `npm run lint` pass with no new warnings.
   - Open Shackleton on 2026-11-17 00:00 UTC: Earth "Partly hidden", about 52%
     of the disc (README pitch story).
   - Earthset shown as 2026-12-01 02:34 UTC; Sun 100% and Earth about 50% of
     the period.
   - Shadows, zoom and "Look at" buttons work; no console errors.
4. If a phase cannot pass the check, it is not finished.

## 0.2 Performance: keep the app fast

Today: the JS bundle is about 1.17 MB (three.js; Vite warns above 500 kB) and
one site loads about 19 MB of terrain.

| Rule | Why |
|---|---|
| **Load Cesium only when the Moon map opens** (`import()` / lazy component) | Cesium is large; the Sky view must not pay for it. |
| **Only one 3D view mounted at a time** (unmount the globe when the Sky view is open, and the other way) | Two WebGL contexts cost memory and GPU (Plan B pitfall). |
| **Load one site's data at a time** and drop the previous one | The "Minecraft" rule; memory stays flat when switching sites. |
| **Cache what was loaded** (browser cache; do not refetch on tab switch) | Going back should be instant. |
| **Globe tiles: let Cesium load by zoom**; set each layer's coverage rectangle and max level | No requests outside the data, no 404 floods. |
| **Heavy math off the main thread** (Web Worker for the horizon in Phase 6) | The UI must not freeze. |
| **Keep "render on demand"** in the Sky view | Already there; do not turn on a continuous render loop. |
| **Measure, do not guess**: time to first globe, time to open a site, MB loaded, before and after each phase | So "faster" or "slower" is a number. |
| Smaller data where it does not lose accuracy (for example compressed hosting, or fewer far-grid nodes) only **after measuring and validating** | Speed must not cost validity. |

---

## 1. What both plans agree on

| Topic | Plan A | Plan B | Note |
|---|---|---|---|
| Two views | Moon map tab + Sky view tab | Orbital view + sky view, "like Google Earth with Street View" (D1) | Same idea. |
| Sky view is the core | The existing Shackleton view | "The view that fits the pitch best" (D2) | It answers the challenge directly: Sun and Earth vs the horizon. |
| Load only one zone | "Minecraft": load the chunk of the picked zone | "Chunks" around the picked point (D3) | Same idea. |
| No live Horizons in the demo | Checked: Horizons sends no CORS header, so the browser cannot read it | "Do not call Horizons from the browser" | Plan A checked it with a request; Plan B assumed it. Both lead to precomputing. |
| Globe imagery from Moon Trek | Moon Trek tiles + one small credit line | Moon Trek WMTS tiles on a smooth sphere (D4) | Same source. |
| Honest interface | Credits, visual aids listed, no dummy data | "Screening only", never "safe", show resolution and source (D10) | Same spirit; Plan B adds good wording rules. |
| Reuse the repo | Keep the validated pipeline | "Read the repo first and reuse it. Do not rewrite it." | Same. |
| AI assistant | Not now | Postponed (D15, section 10) | The chatbot box in the sketches is **out of scope**. |
| Colour-blind safe colours | Okabe-Ito status colours in the app | Required for green/yellow classes | Same. |

## 2. What Plan B adds that is good (and why)

| Addition | Why it is good for the challenge |
|---|---|
| **Layer selector, one overlay at a time** (the "toggle box": a radio group "Map layer": None, Hillshade, Elevation, Slope, Temperature) | The challenge asks for "2D maps, 3D surface visualizations" and spatial understanding of terrain. One layer at a time keeps it readable for the public. Tiles are served by Moon Trek, so it is cheap. |
| **Layer registry** (one typed list: id, label, source, resolution, coverage, limits note, credit, legend) | The selector, legend, resolution label and credits are all built from one place. Fewer bugs, honest labels by default. |
| **Arrival date + stay length** (default 6.5 days) | The challenge asks for "date and time flexibility" and to "reconsider the landing date". A stay is what a mission planner actually asks: "lit during the whole stay?" |
| **Ephemeris for any point** (one small file of Sun direction and Earth position in the Moon-fixed frame, rotated to the local frame of the point) | Needed for "sky view anywhere" (custom coordinates are in the challenge). Correctly keeps Earth parallax (about 0.26°, 14% of the Earth disc). |
| **Two calculation regimes** (poles: terrain decides; elsewhere: geometry gives most of it) | Physically right and saves a lot of computing. |
| **Horizon for one point in a Web Worker** | One point is cheap; the UI does not freeze. |
| **Click a zone: details + picture** | Matches the sketch (Topography panel). |
| **Shared state in the URL** (`lat, lon, arrivalDate, stayDays, overlay, ...`) | Links can be shared; "Back to map" keeps the date. |
| **Requirements finder** (must-have / nice-to-have, presets) | Strong for "compare sites quickly". But it is the biggest cost (see 3). |
| **Test cases** (Shackleton stay results, Gläser 2014 spots, Blue Ghost, IM-2, QuickMap cross-checks) | Fits the "Validity" judging criterion. |
| **Known pitfalls** (illumination layer is really a PSR mask, slope tiles are pictures, QuickMap has no public API) | Saves time. |
| **Demo is a recorded video** | This changes risk: a live internet dependency matters less than Plan A assumed. |

## 3. Where I disagree with Plan B, or it needs a fix (and why)

| Plan B says | Problem | What we do instead |
|---|---|---|
| Sky-view chunk radius **about 50 km** | In this repo, problem #14 (`PROJECT_MEMORY.md`): at Shackleton the horizon toward the Earth comes from terrain **80 to 200 km** away. With grids that stopped at 80 km the error was up to 3.4°. 50 km is too small at the poles. | Poles: keep **200 km**, as the validated pipeline does. Away from the poles: test the radius (Plan B's own suggestion) against a 200 km reference before choosing. |
| **118 m DEM** for sky-view chunks, including poles | Coarse terrain **overestimates sunlight** (Gläser et al. 2018, already in the README) and good polar spots are 20 to 40 m wide. | Poles: 20 m LOLA (already read by parts with range requests, no full download). 118 m only away from the poles, labelled with its resolution. |
| Download the **8 GB** 118 m GeoTIFF | Big for a hackathon laptop. Not verified whether the USGS file allows range reads (COG). | First check if a range read works (like the 20 m file). Only download in full if it does not, with Vanessa's approval. |
| Build the **SPICE ephemeris** (new kernels, new script) as the base | Our Horizons pipeline is already validated (0.0° vs the web app). SPICE is new work and needs its own validation. | Curated sites: keep **Horizons per site** (works now). SPICE only for "sky view anywhere", and validate it against our Horizons data at Shackleton. |
| **Global requirements grid** (0.25°, slope histograms, per-cell Sun/Earth) as step 5 | The largest cost; the repo's own strategy doc ranks it P4; global Sun/Earth without terrain is wrong near the poles (where the challenge focuses). | Do it **after** the core flow works, on a **limited area** first (Artemis III regions). |
| **CesiumJS** for the globe | Adds a large dependency (npm `cesium` 1.147.0, 80 MB unpacked, checked with `npm view`) and a second WebGL context next to the three.js sky view. | Still the best choice (see 5.1): it gives tiled loading, WMTS and lat/lon picking out of the box. Mitigate: a 30-minute spike first; unmount the globe when the sky view is open. |
| Earth visible **≥ 25%**, rover values, "8° tilt" | Plan B itself marks the origin as not verified. | Not shown as official numbers until a NASA source is read. |
| Temperature overlay | Display only, polar gap. Weakly tied to the challenge (it mentions thermal conditions). | Keep it (it is cheap), label "display only" and the gap. Lowest priority of the four overlays. |
| Elevation colour layer | No height legend found. | No legend numbers until found. Do not invent heights. |
| Zone pictures **pre-downloaded** and stitched (M7) | Extra script and files. | The globe can just **zoom into the zone** with live WAC tiles (the demo is recorded, so live tiles are fine). Pre-saved pictures only as a fallback. |

## 4. Corrections to Plan A (my earlier proposals)

| I said | Now | Why |
|---|---|---|
| CGI Moon Kit for the globe | **Moon Trek tiles** | Vanessa chose it; CORS checked; the demo is a recorded video, so internet at demo time is a small risk. |
| "Zones first, then the globe" | **Globe spike first** | The globe is the entry screen in every sketch, and Plan B's 30-minute test tells us early if Cesium works. |
| Earth tab in the nav rail | **Remove it** | Vanessa: only the Moon. |
| Tabs as the main navigation | **Keep the rail, but the main flow is in the views** | The sketches show a flow (Main → Horizon view / Topography view), not tabs. Rail: Moon map, Sky view, Dashboard (later). To confirm with Vanessa. |
| Apollo needs "another DEM, unknown" | **118 m global LOLA** (or SLDEM2015 59 m between 60°S and 60°N) | Plan B names the products; sizes and range reads still to check. |
| Offline is critical | **Less critical** | The demo is recorded. Still keep sky-view data static (fast and reliable). |
| Kept from Plan A, still valid | 200 km horizon at the poles; 20 m DEM at the poles; Horizons per curated site; no dummy data; minecraft loading; credits once, small | Validated in this repo. |

## 5. Final design

### 5.1 Stack and why

| Part | Choice | Why | Checked? |
|---|---|---|---|
| App | Existing Vite + React 19 + TypeScript + Tailwind | Already works; no rewrite. | Yes |
| Globe | **CesiumJS** with the Moon ellipsoid, no terrain (smooth sphere) | Built-in tile loading by zoom (the "Minecraft" for imagery), WMTS provider, click → lat/lon. Doing this by hand in three.js is days of work. | Package exists (1.147.0). `Ellipsoid.default` for the Moon: **to check in the spike**. |
| Globe imagery | Moon Trek WMTS `LRO_WAC_Mosaic_Global_303ppd_v02` (JPEG) | Sharp, whole Moon, NASA. | CORS `*` checked on WAC and Shade tiles. Level 0 is 2×1 tiles (geographic scheme), checked in the capabilities file. **Terms of use: not found.** |
| Overlays | Moon Trek: `LRO_LOLA_Shade_Global_256ppd_v06`, `LRO_LOLA_ClrShade_Global_256ppd_v06`, slope (`LRO_LOLA_ClrSlope_Global_16ppd` + `LRO_LOLAKaguya_ClrSlope_60N60S_512ppd` + `LRO_LOLA_ClrSlope_SPole75S_120m_EQ` + north pole), temperature (`LRO_DIVINER_ClrRockFreeSurfaceTemp_Global_128ppd`, `diviner_Clrtbol_max/min`) | One radio group, no stacking. | All listed capabilities files answer 200 (PNG). Coverage boxes match Plan B (for example slope 60N60S: -60 to 60; Diviner night: -70 to 70). `diviner_Clrtbol_max` lists **1 level**. |
| Sky view | Existing three.js view (`MainView`, `Terrain`, `SunDisc`, `EarthDisc`) | Validated. | Yes |
| Sky view data, curated sites | Existing Python: `fetch_horizons.py` + `build_terrain.py`, one folder per site, loaded only when picked | Validated pipeline; no new math. | Yes for Shackleton |
| Sky view data, any point | SPICE ephemeris file + horizon in a Web Worker + DEM chunks | Needed for custom coordinates. | Not built; must match our Horizons data at Shackleton. |
| Hosting | Static (Vercel/Netlify), processed files only | No server needed. | Size limits **to check** before adding many sites (~19 MB per site). |

### 5.2 Screens (from the sketches)

1. **Main**: globe in the centre, layer selector and (later) criteria panel on the left.
2. **Main with selection**: click a site or point → right panel with a **Horizon preview** (small sky view or horizon line with Sun and Earth) and a **Topography preview** (the zone on the globe, zoomed).
3. **Horizon view**: the current Sky view (site, date, Sun, Earth, period summary). "Back to map" keeps the date.
4. **Topography view**: the globe zoomed to the zone with the chosen overlay.
5. Chatbot box: **not built**.

### 5.3 Data sources (all public NASA; credits shown once, small)

- Sun and Earth: JPL Horizons (curated sites), later NAIF SPICE (any point).
- Terrain: LOLA 20 m south pole (Barker et al. 2023, PGDA product 90); LOLA 118 m global or SLDEM2015 away from the poles.
- Globe and overlays: NASA Moon Trek (LRO WAC, LOLA, Kaguya, Diviner).
- Site coordinates: Gläser et al. 2018 (Shackleton, Connecting Ridge); NSSDC / Wagner et al. 2017 (Apollo).

---

## 6. Phases

Each phase ends with a checklist **plus the regression check in 0.1** and
**stops for Vanessa's approval** (no commit until she says so). Model and effort
are suggestions; change them before starting the phase. Before each phase:
re-read sections 0 to 0.2, question the phase, and ask what is missing.

### Phase 0. Setup and decisions (no code)
- **What:** copy the teammate's context docs into `docs/context/` (manual, Plan B
  M0). Answer the open questions in section 7.
- **Why:** later phases read those docs instead of repeating research.
- **Model:** Sonnet, low effort.

### Phase 1. Globe spike (about 30 to 60 min)
- **What:** add CesiumJS to the Moon map tab: Moon ellipsoid, smooth surface, WAC
  imagery, click → shows lat/lon. Nothing else. Cesium is loaded lazily (only
  when the tab opens) and unmounted when you leave it (section 0.2).
- **Measure:** bundle size and Sky view load time before and after; the Sky view
  must not get slower.
- **With:** `cesium` npm package, Vite static asset setup, Moon Trek WMTS.
- **Why first:** it is the biggest technical unknown and the entry screen.
- **Check:** tiles load with no CORS errors; pole view looks right; clicking
  Shackleton gives about -89.78°, 203.97° E (compare with the Gläser value);
  the sky view still works after switching tabs (repeat problem #5: React
  loaded twice if Vite re-bundles; keep `optimizeDeps`).
- **If it fails:** fallback is a three.js sphere with one WAC texture.
- **Model:** Opus, medium effort.

**Phase 1 result (2026-11-14, built, waiting for Vanessa's approval to commit):**
- Done: Earth tab removed; `MoonGlobe` (lazy loaded) with CesiumJS 1.147.0,
  Moon ellipsoid, smooth sphere, WAC tiles from Moon Trek (levels 0 to 8; level 9
  returns 404), click shows lat/lon (degrees east, 0 to 360), small credit line.
- Measured: main JS bundle 1,173 kB before and 1,175 kB after (+2 kB). Cesium is
  a separate lazy chunk of 4.18 MB (1.12 MB gzip) that loads only when the Moon
  map opens. Cesium static files in `dist/cesium`: 8.8 MB.
- Checked: tiles load with no CORS errors from localhost; near side looks right
  (north up); a click near the south pole gives -87.19°; centre click gives
  2.36°, 358.58° E (about 0, 0 as expected). Not yet checked: a click exactly on
  Shackleton (needs a marker, Phase 3).
- Regression check passed: Earth "Partly hidden (52% of disc)" on 17 Nov 00:00,
  Earthset Dec 1 02:34 UTC, Sun 100%, Earth link 50%.
- Notes: Cesium requires its own logo credit (it shows bottom-left; we keep it).
  Dev preview needs the Vite cache cleared the first time (Cesium added to
  `optimizeDeps.include`, problem #5). `vite-plugin-static-copy` copies Cesium
  workers and assets.

### Phase 2. Layer selector (one overlay at a time)
- **What:** layer registry + radio group: None, Hillshade, Elevation, Slope,
  Temperature. Legend, resolution label, coverage and limits note per layer;
  one small credit line.
- **Why:** challenge asks for 2D/3D terrain views; cheap with tiles.
- **Check:** selecting a layer removes the previous one; no floods of 404 in the
  network tab (rectangles set); slope shows the right product at 0°, 65° and
  85° latitude; levels read from each capabilities file.
- **Model:** Sonnet, medium effort.

### Phase 3. Sites on the globe → Sky view, loading one zone at a time
- **What:** `sites.json` (id, name, lat, lon, source of coordinates). Markers on
  the globe. Click → side panel → "Open sky view". `loadSiteData(siteId)` loads
  only that site's folder and releases the previous one ("Minecraft").
- **New sites (data with existing Python):** Connecting Ridge (same 20 m polar
  file, read by parts). Apollo sites need the 118 m or 59 m DEM (Phase 3b).
- **Why:** the full challenge flow (pick a site, see Sun/Earth vs horizon) with
  validated data and no new math.
- **Manual:** Vanessa approves each data download (file, source, size) and runs
  the Python scripts.
- **Check:** switching sites loads only that site (network tab); Connecting
  Ridge numbers compared with Gläser et al. 2018 Table 1; no dummy data.
- **Model:** Opus, medium effort.

### Phase 3b. Apollo sites
- **What:** adapt `build_terrain.py` to a non-polar DEM (118 m global or SLDEM2015
  59 m). First check whether the file allows range reads.
- **Why:** past landings are in the challenge's "curated list" example; they are
  a good contrast with the pole (Sun high, Earth almost fixed).
- **Check:** coordinates from NSSDC / Wagner et al. 2017 with the source next to
  them; one Apollo site against Horizons web app at 3 times.
- **Model:** Opus, high effort.

### Phase 4. Selection panel and flow from the sketches
- **What:** right panel with Horizon preview + Topography preview; clicking them
  opens the Horizon view (Sky view) or zooms the globe (Topography view);
  "Back to map"; shared state in the URL.
- **Why:** this is the flow the team drew.
- **Model:** Sonnet, medium effort.

### Phase 5. Arrival date + stay length
- **What:** pick arrival date and stay (default 6.5 days, source in Plan B); show
  % of the stay with Sun and with Earth; time left before sunset / Earthset is
  already in the app.
- **Check:** Shackleton results match Plan B's test table (14 Nov 62.8%, 18 to
  22 Nov 100%, 30 Nov 17.3%, from 2 Dec 0%).
- **Model:** Sonnet, medium effort.

### Phase 6. Sky view anywhere (custom coordinates)  ← **use Fable here**
- **What:** SPICE ephemeris file (Sun direction, Earth position in km, hourly,
  `MOON_ME`); horizon for one point in a Web Worker in true 3D (same method as
  `build_terrain.py`); DEM chunks (20 m at the poles, 118/59 m elsewhere).
- **Does not break the existing view:** the new path writes the same `SiteData`
  types as the Python pipeline. Curated sites keep their validated files; the
  new path is used only for points that have no curated folder. A point picked
  "anywhere" shows its data quality in the UI (DEM resolution, radius, source),
  so it is never confused with a validated site.
- **Question before building:** is the in-browser horizon fast enough at 200 km
  near the poles? If not, poles stay curated-only and "anywhere" is offered
  away from the poles first. Measure, then decide with Vanessa.
- **Why Fable:** this is the hardest phase: frames, libration, Earth parallax,
  curvature, a horizon method that must give the same answer as the Python one,
  and validation. A wrong sign or frame gives numbers that look fine but are
  wrong. The most capable model with high effort pays off here.
- **Manual:** Vanessa downloads SPICE kernels and DEM chunks (approval first).
- **Check:** Shackleton from the new path vs our validated Horizons + horizon
  data (same visible/hidden decisions; tolerance written down first); one
  equatorial point vs the Horizons web app at 3 times.
- **Model:** **Fable**, high effort.

### Phase 7. Requirements finder (if time allows)
- **What:** criteria panel (sketch: Illumination, Earth connection, Terrain
  incline), must-have / nice-to-have, presets. **Limited area first** (Artemis
  III regions), then a global 0.25° grid. Green = "meets your requirements
  (screening only)", gray = excluded.
- **Why later:** biggest cost; analysis data (slope numbers, not tile colours)
  must be downloaded and processed.
- **Check:** Plan B section 8 tests; colour-blind check.
- **Model:** Fable or Opus, high effort (scoring + data processing).

### Phase 8. Polish and video
- **What:** larger text for the video, honest labels, credits, record the full
  path: overlay → site → sky view → date change.
- **Model:** Sonnet, low effort.

### Later (not in this plan)
- **Dashboard with impact KPIs** (hours or money saved vs today's process), based
  on the teammate's research of the current process. No numbers until that
  research is read.
- **Chatbot / AI assistant.**
- Compare mode (two sites or dates side by side).

---

## 7. Open questions for Vanessa / the team

1. Nav rail: keep Moon map, Sky view, Dashboard (later) and remove Earth? Or drop
   the rail and use only the sketch flow?
2. Which Apollo sites first (all six, or 11 and 17)?
3. Requirements finder: in scope for the video, or only if time is left?
4. Stay length default 6.5 days: OK?
5. Who on the team runs the downloads and Python scripts?

## 8. Not verified yet

- Moon Trek terms of use (not found on the Trek site).
- Cesium Moon ellipsoid setting in the installed version; Cesium + Vite setup.
- Exact number of zoom levels per product (counts may include commented entries).
- Range reads for the 118 m global DEM; sizes of SLDEM2015 files.
- Hosting size limits for many sites.
- Origin of the 25% Earth visibility, 8° tilt and rover thresholds.

## 9. Sources

- Repo: `README.md`, `docs/PROJECT_MEMORY.md` (problems #5, #9, #13, #14).
- Teammate: `landing_site_map_implementation_context.md` and the team sketches.
- Checked in this session (2026-11-14): Moon Trek capabilities files and tile
  CORS headers; Horizons and PGDA responses (no CORS header); `npm view cesium`.
- Moon Trek WMTS: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon
- LOLA 118 m DEM: https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m
- Apollo coordinates: https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html
- Gläser et al. 2018, doi:10.1016/j.pss.2017.07.006
