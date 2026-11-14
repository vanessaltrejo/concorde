# Project memory

Everything decided, built, broken and fixed while building the Lunar Landing
Site Simulator, in order. Read the [README](../README.md) first for what the app
is and how to run it. This file is for anyone who joins the team and needs the
*why* behind every choice.

Dates are UTC/Monterrey as noted. Work started 2026-11-14 (Saturday); the pitch
is 2026-11-15 13:00 Monterrey time and the final submission deadline is
2026-11-15 23:59.

---

## Contents

1. [Team, roles and working rules](#1-team-roles-and-working-rules)
2. [Timeline by step](#2-timeline-by-step)
3. [Key decisions and why](#3-key-decisions-and-why)
4. [Problems and how they were solved](#4-problems-and-how-they-were-solved)
5. [Dummy data: history and current state](#5-dummy-data-history-and-current-state)
6. [How each result was proven](#6-how-each-result-was-proven)
7. [Corrections to earlier assumptions](#7-corrections-to-earlier-assumptions)
8. [Discarded or postponed, and why](#8-discarded-or-postponed-and-why)
9. [Sources reviewed](#9-sources-reviewed)
10. [Open items](#10-open-items)
11. [Git history](#11-git-history)

---

## 1. Team, roles and working rules

- **Owner:** Vanessa (junior developer, wants to learn while building).
  Teammates may join later. One teammate wrote a research doc on data
  sources and APIs (reviewed in section 9).
- **AI assistant:** acts as senior developer and mentor.
- **Language:** chat in Spanish; code, comments, docs and anything published in
  simple English.
- **Step loop** (from the project brief): goal → proposal with one alternative →
  questions → wait for approval → implement only that step → verification
  checklist → wait for confirmation.
- **Never invent** numbers, coordinates, API parameters or file names. Every value
  must come from an official source, named next to it.
- **Git:** no commits, merges, pushes or branches without Vanessa's approval.
  Work on `stage`; `main` gets `stage` when she asks.
- **Downloads** need explicit approval (file name, source, size).
- **Hackathon rules** that replaced Vanessa's usual brief: working and verifiable
  first; static JSON/binary files instead of a database; no live API calls from
  the browser; Vite instead of Next.js; Python for data scripts.

## 2. Timeline by step

| Step | What was built | Key outcome |
|---|---|---|
| 0 | Decisions, Vite + React + TS + Tailwind + three.js setup on `stage` | Empty layout runs. Site = Shackleton rim (Gläser 2018). Period = one lunar day from 2026-11-14, hourly. |
| 1 | Sidebar with typed dummy data, UTC date field + slider, 4 metrics | Types compile with no `any`. |
| 2 | First-person camera on a **fake** procedural terrain with lunar curvature, drag to look, compass | A fake ridge at 120° appears at the expected ~2.8°. |
| 3 | Sun and Earth discs from dummy positions, light follows the Sun | Fake ridge hides the Earth; showed why a flat horizon is wrong. |
| 4 | `fetch_horizons.py` (standard library), real Sun/Earth for 709 hours | Matches the Horizons web app exactly (0.0°). |
| 5 | `build_terrain.py`: LOLA 20 m COG read by parts, horizon profile to 200 km, terrain mesh | Site sits on the rim (10.35 km from center vs 10.46 km radius). 20-year sunlight check vs Gläser: 79.1% vs 81.0%. |
| 6 | Real terrain in the app, horizon silhouette, visible/partial/hidden for Sun and Earth | Earth half hidden on Nov 17 00:00 (52% of disc), matches the 3D view. |
| 7 | Set/rise times (minute precision) and % of period visible | Matches independent Python (Earthset Dec 1 02:34 UTC). |
| 8 | Polish with real data: 3 terrain grids to 200 km, shadow shader, lunar-Lambert, Earth phase and Blue Marble texture, colorblind-safe status, credits, disclaimer, zoom, look-at buttons | Shadow method within 0.07° median of the horizon; Earth orientation within 0.26° of Horizons' subsolar point. |

## 3. Key decisions and why

- **Site: Shackleton rim** at -89.7849°, 203.97° E (Gläser et al. 2018, Table 1).
  Shackleton is near the pole, the challenge mentions south pole missions, and
  the rim has long sunlight. We first found only the crater **center** in the
  USGS Gazetteer (-89.67°, 129.78°), which is permanently shadowed, so it is not
  a landing site. NASA's Artemis III regions page gives region names but no
  coordinates. Gläser's Table 1 gives exact rim coordinates with a citation.
- **Period:** one lunar day (~29.5 days) from 2026-11-14 00:00 UTC, hourly.
  Enough to show a full cycle; small files.
- **Observer height 2 m:** same lander height as Gläser et al. 2018.
- **Horizons site altitude 0 km:** a few km change the Sun/Earth direction by a
  negligible amount.
- **Python standard library for Horizons**, `numpy` + `rasterio` + `pyproj` for
  terrain (pyproj instead of hand-written projection formulas, because it is
  well tested).
- **Visibility rule** "visible if any part of the disc is visible": same as the
  NASA PGDA Earth visibility maps, so our numbers can be compared with NASA's.
- **Horizon computed in true 3D**, not on the flat map: near the pole the map's
  "north" is not local north, and curvature matters (2.9 m drop at 10 km,
  72 m at 50 km, 6.5 km at 150 km). Search radius 200 km because south pole
  massifs are several km high.
- **Terrain in three grids** (20 m / 320 m / 640 m) so shadows see the same
  terrain (to 200 km) as the metrics.
- **Shadows in a custom shader** using the horizon method instead of three.js
  shadow maps (bad at 1–2° Sun elevation).
- **Lunar-Lambert** shading: pure Lommel-Seeliger blew out the brightness at
  grazing views.
- **Zoom instead of a bigger Earth:** the Earth is ~1.8° wide (about 3.6× the
  Moon seen from Earth); in a 60° view it is ~25–30 px. Enlarging it would lie
  about size and occlusion; zoom keeps the scale honest.
- **White Sun:** from the Moon there is no atmosphere to make it yellow.
- **Earth texture with bathymetry:** the base Blue Marble has near-black oceans;
  the topography + bathymetry version has real blue oceans.

## 4. Problems and how they were solved

| # | Problem | Cause | Fix |
|---|---|---|---|
| 1 | The first shared link (a Google Doc) was empty | Wrong document | Vanessa shared the GitHub repo instead. |
| 2 | The GitHub repo was empty; branches could not be created | Git needs at least one commit | Empty "Initial commit" on `main`, then `stage`, pushed with approval. |
| 3 | Could not read the PDFs | `pdftoppm` not installed | Extracted text with macOS PDFKit (a small Swift script). Tables came out with mixed columns, so values were flagged "to confirm in the PDF". |
| 4 | USGS Gazetteer search returned the whole Moon list or a wrong feature | URL filter ignored; a guessed feature ID was another body | Used the site's search box; found Shackleton = Feature 5450. |
| 5 | Black screen and "Invalid hook call" after adding three.js/drei | Vite re-bundled React mid-session, loading two copies | `optimizeDeps.include` for react, react-dom, three, fiber, drei in `vite.config.ts`; restart with a clean cache. |
| 6 | Terrain invisible when the Sun was at 0° | Light off and ambient 3% | Ambient light raised (then replaced by the shader floor, labeled as visual aid). |
| 7 | "The Sun sets in the simulator but you said it never sets" | The 3D view still used the **fake** terrain | Explained; fixed for real in Step 6 with LOLA terrain. |
| 8 | `CERTIFICATE_VERIFY_FAILED` in Python | python.org Python on macOS lacks certificates, and a certificate in the chain is only trusted by the macOS keychain | Export the macOS keychain certificates to a temp file and pass `SSL_CERT_FILE` / `CURL_CA_BUNDLE` for that run only. Nothing changed in the system. |
| 9 | Remote LOLA reads returned 0 bytes | PGDA server answers **403** to bursts of range requests, then accepts again | GDAL retries with `GDAL_HTTP_RETRY_CODES=403,...` inside the scripts. |
| 10 | Sun label missing, React errors | drei `Html` labels create separate React roots that break with React 19 in development | Own `ScreenLabels`: plain HTML moved to the projected position each frame. |
| 11 | Labels spilled over the sidebar | Off-screen projected positions | `overflow-hidden` on the 3D area. |
| 12 | Parts of the terrain looked flat and a straight edge appeared | Detailed mesh was only 20 × 20 km; the rest was a flat silhouette; grazing light | Mid and far grids out to 200 km; shadow shader; lunar-Lambert. |
| 13 | Affine fit of grid → scene had 15 m / 220 m / 1331 m residuals | Real geometry: with curvature, deep terrain far away "leans" | Store exact x, y, z per node; resample the shadow height texture so lookups land on the right surface. |
| 14 | Shader shadows disagreed with the horizon by up to 3.4° (around 153°, the Earth direction) | Grids stopped at 80 km; the horizon there comes from 80–200 km terrain | Added the far grid (640 m to 200 km). Then median 0.07°, max 0.34°. |
| 15 | Lit terrain looked white | Lommel-Seeliger gets very bright at grazing views | Lunar-Lambert (McEwen 1991) and lower intensity. |
| 16 | Shadowed ground looked like sky | Shadowed regolith almost black on a black sky | Dark gray floor + gray horizon line (visual aids, labeled). |
| 17 | Earth looked lit on the wrong side | Night side too visible next to a thin crescent | Checked with numbers that the lit side points to the Sun on screen; tuned day/night brightness. |
| 18 | Oceans looked black | The base Blue Marble image has near-black oceans | Switched to the topography + bathymetry version (approved download). |
| 19 | Dotted line across the Pacific on the Earth | Texture seam at 180° longitude breaks mipmap selection | `textureGrad` with continuous longitude derivatives. |
| 20 | Several fast zoom clicks counted as one | Each click used the old value | Functional state update (`previous * factor`). |
| 21 | Zoom buttons overlapped the compass / footer | Narrow layout | Buttons bottom-right, footer limited to half width. |
| 22 | Lint warnings about mutating hook values | three.js uniforms and cameras are mutable by design | Mutations moved into small helper functions. |
| 23 | Testing: background browser tabs rendered late | Browsers throttle hidden tabs | Not an app bug; wait or use the visible tab when testing. |

## 5. Dummy data: history and current state

- **Steps 1–3 used dummy data on purpose** (the brief: build the view first with
  the same types the real data will use):
  - `src/data/dummy.ts`: fake Sun/Earth positions (sine curves), marked `DUMMY`.
  - `src/scene/fakeTerrain.ts`: procedural hills and a 150 m ridge at 120°,
    marked `FAKE`.
- **Both were deleted.** Step 4 replaced the sky data with Horizons; Step 6
  replaced the terrain with LOLA.
- **Current state: no dummy data.** The visual aids that are *not* physical
  (boosted earthshine, gray shadow floor, horizon line, brighter Earth night
  side, Sun glow) are listed in the README and in the app credits.

## 6. How each result was proven

| Claim | Proof |
|---|---|
| Sun/Earth positions are right | Same values as the Horizons web app (filled in by Vanessa), 25 rows, 0.0° difference. |
| The site is on Shackleton's rim | Gläser coordinates are 10.35 km from the USGS crater center; USGS radius 10.46 km. |
| The map projection is right | Round trip returns the site; distance to pole 6522.56 m vs Horizons 6.52254 km. |
| The horizon is right | 20-year sunlight 79.1% / 83.9% vs Gläser 81.0% / 85.5% (different DEM and step, ~2 points apart). |
| 3D shadows match the numbers | CPU copy of the shader: median 0.07° from the horizon; same decision 709/709 (Sun), 706/709 (Earth). |
| Set/rise times are right | Independent Python gives the same minutes. |
| Earth phase is right | Geometry vs Horizons Illu%: ≤ 0.13 points. |
| Earth texture faces the right way | Our math reproduces Horizons' sub-observer latitude (≤ 0.25°) and subsolar point (≤ 0.19° lon, 0.26° lat, 60 times). |
| Near ground smoothness is a data limit | LOLA effective resolution map: median 16 m within 10 km of the site. |

**Known weaknesses of these proofs:** the Gläser comparison uses a different DEM
version, a 6 h step and values read from a text extraction of the PDF; the
horizon has not yet been compared with Quickmap or Moon Trek; the PGDA product 69
maps (surface level, 18.6-year averages) have not been compared yet.

## 7. Corrections to earlier assumptions

- "240 days of light" (from the first reading of the paper): the paper's "240" is
  **240 m/pixel** (Mazarico et al. 2011 resolution). The paper reports sites lit
  about 90% of the time.
- "4 landing sites": the paper discusses **6 sites** (3 per pole).
- "Analysis from the 17th to the 23rd": the simulation runs **2017 to 2037**,
  hourly.
- "LRO mapped only 10% of the south pole": not found in the sources read; not used.
- The Sun "never setting" this month is correct for this period (southern
  summer); over 20 years the site has no Sun about 16% of the time.
- Earth angular size: first estimated at 1.9°; Horizons gives 1.80°. All sizes
  now come from Horizons.
- The Earth looks "upside down" (south up) from the lunar south pole. Correct.

## 8. Discarded or postponed, and why

| Option | Status | Reason |
|---|---|---|
| Next.js | Discarded | No server rendering or API routes needed. |
| Live Horizons calls in the browser | Discarded | Offline demo; CORS not documented. |
| Cesium Moon 3D Tiles | Postponed | Different terrain (reported ~2.5 km offset vs LOLA, unverified), baked-in shadows, needs internet + token, rewrite risk. Maybe a separate globe view later. |
| 5 m mosaic full download (3.3 GB) | Discarded | 20 m COG read by parts is enough; a 5 m patch near the camera is possible (file is tiled). |
| 240 m only (Plan B) | Not needed | Overestimates sunlight; Plan A worked in ~30 min of a 2 h budget. |
| three.js shadow maps | Discarded | Unreliable at 1–2° Sun elevation. |
| lhorizon, astroquery, SpiceyPy | Not needed | Horizons API + standard library validated. |
| astronomy-engine | Postponed | Good for custom coordinates later; ~1 arcminute accuracy. |
| Moon Trek WMTS imagery | Postponed | No terms of use published; CORS unknown; baked shadows. |
| Bigger Earth | Discarded | Misleading; zoom instead. |
| Yellow Sun | Discarded | Not physical from the Moon. |
| 2D horizon chart | Postponed | Vanessa wants it; comes after the 3D MVP, from the same horizon profile. |
| Compare mode, timeline, educator mode, custom coordinates | Postponed | After the single view works (brief). |

## 9. Sources reviewed

- **Challenge text and resources** (Quickmap, Moon Trek, Horizons, CSA Moon Exploration).
- **Gläser et al. 2018**, *Illumination conditions at the lunar poles* (main
  scientific reference; site coordinates and sunlight check).
- **"Lunar Site Selection" PDF**: external source of the reference image only;
  not related to the challenge, not used as data.
- **Teammate's research doc** ("Building the 3D map MVP"): confirmed the plan,
  pointed to PGDA products 69/81/90, Cesium Moon, Moon Trek WMTS, astronomy-engine.
  Verified: product 90 files are COGs with range reads; product 69 has Earth
  visibility maps (definition "any part of the disc"). Some links were mirrors,
  not originals.
- **JPL Horizons API docs and manual** (parameters, lunar sites, quantities).
- **NASA PGDA** products 69, 81, 90; **USGS Gazetteer** (Shackleton 5450);
  **NASA SVS 5013** (Artemis III regions, no coordinates).
- **NASA Earth Observatory** Blue Marble Next Generation.

## 10. Open items

- [ ] Validate the horizon against **Quickmap / Moon Trek** (Vanessa).
- [ ] Confirm Gläser Table 1 values (81.0%, 85.5%) visually in the PDF.
- [ ] Record a **backup video** of the demo.
- [ ] Prepare pitch answers (data, accuracy, gaps, why better than Quickmap/Horizons).
- [ ] Optional: 5 m terrain patch near the camera (~8 MB more data).
- [ ] Optional: compare with PGDA product 69 maps.
- [ ] `public/icons.svg` is an unused Vite template file (not committed).

## 11. Git history

| Commit | Content |
|---|---|
| `f45ca4e` | Initial commit (empty) |
| `2d05b76` | Steps 0–4: app base, Horizons data, validation |
| `6bc24a5` | Steps 5–6: LOLA terrain, horizon, visibility, 20-year check |
| `3dcb71b` | Steps 7–8: timing metrics, shadows, Earth texture, credits (also on `main`) |
| next | Zoom, look-at buttons, Earth blue-ocean texture and fixes, README, this file |
