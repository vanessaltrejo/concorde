# Horizon view anywhere: build plan (option A, terrain tiles)

Written 2026-11-15. Goal: the user clicks **any** point on the Moon and gets a
Horizon view with the **same terrain resolution as the curated sites**. Nothing
here is built yet. Steps marked **MANUAL** are done by a person; the others by
Claude. Each step stops for a check before the next one (team rule).

## What "same resolution" means (from `scripts/build_terrain.py`)

| Where the user clicks | Terrain | Horizon radius | Same as |
|---|---|---|---|
| South of 86°S | LOLA 20 m (`LDEM_80S_20MPP_ADJ`, PGDA) | 200 km | Shackleton, C1, C2 |
| Everywhere else | LOLA 118 m global (USGS) | 50 km | Apollo 11, 16, 17 |

No 20 m north pole file was found at the matching PGDA address (checked
2026-11-15: the request returns a 3.8 KB error page). The north pole gets
118 m unless a north polar product is found and approved.

## Source files (checked 2026-11-15 with header requests, nothing downloaded)

| File | Size | Layout inside |
|---|---|---|
| `https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif` | 8,494,203,833 bytes | BigTIFF, 92160 x 46080, int16, uncompressed, one row per strip |
| `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF` | 2,696,082,051 bytes | BigTIFF, 30400 x 30400, float32, deflate, 512 x 512 tiles, overviews 40 / 80 / 160 / 320 / 640 m |

**Changed 2026-11-15:** Emiliano downloads both files once into
`source\` (see below), so the build reads local files and can be re-run
without the network. The global file is cut into tiles band by band; the polar
file's tiles are copied byte for byte (lossless, no re-encoding).

Python setup done 2026-11-15: Python 3.13.17 (installed with winget, user
scope; numpy 2.5.4 and rasterio 1.5.1 need Python 3.12+), `.venv` with
rasterio 1.5.1, GDAL 3.12.4, numpy 2.5.4, pyproj 3.8.0.

## Local folder (on the machine that builds the tiles)

```
C:\Users\emili\concorde-terrain-tiles-2026\
  README.txt      what this is, sources, size, how to free the space by hand
  source\         the two NASA files (11.2 GB)
  global-118m\    tiles of the global file
  south-20m\      tiles of the polar file, all overview levels
  manifest.json   source, resolution, projection, tile grid, checksums
```

- Outside the repo: never committed, and removing it cannot affect the app.
- The name is neutral on purpose (no words such as "temp" or "cache").
- **No script removes it.** After the hackathon, once the tiles are confirmed
  on Cloudflare R2, a person removes the folder by hand in File Explorer.
- Expected size: about 6 to 8 GB (estimate; the script prints the real size).
  This machine has 232 GB free.

## Steps

| # | Step | Who | Model |
|---|---|---|---|
| 0 | **Approvals:** Vanessa approves reading the two files above (11.2 GB through the network once) and creating the Cloudflare R2 bucket. | **MANUAL** (Emiliano asks Vanessa) | none |
| 1 | **Python setup:** create `.venv`, `pip install -r scripts/requirements.txt` (rasterio is not installed on this laptop yet). Claude gives the exact commands. | **MANUAL** (run commands) | current |
| 2 | **Probe (done 2026-11-15):** global = int16 x 0.5 m, nodata -32768, equirectangular, 118.450588 m pixels. South = float32 m, nodata NaN, polar stereographic, 20 m, +/-304 km, deflate with TIFF predictor 3, overviews 2x to 64x. | Claude | current |
| 3 | **`scripts/build_chunks.py` (written 2026-11-15):** 512 x 512 tiles, lossless (int16 row-delta, float32 byte-shuffle + row-delta, then zlib). The polar tiles are re-encoded, not copied: browsers cannot undo TIFF predictor 3. Polar levels 20 / 80 / 160 / 320 / 640 m (the levels `build_terrain.py` reads). Empty tiles are skipped and listed in `manifest.json`. `verify` compares tiles bit-for-bit with the source; `check` refuses an upload over 95% of the free tier. Test around Shackleton: 40 tiles, all bit-for-bit identical; about 0.6 MB per tile. Global test band (Apollo 11 row): 180 tiles, bit-for-bit identical, about 201 KB per tile, so about 3.3 GB for all 16,200; one band takes about 1.5 min, so about 2.3 h for the full global build. Expected total about 5 GB. | Claude | current |
| 4 | **Cloudflare (changed 2026-11-15):** bucket `concorde-terrain` (Standard) stays **private** (Public Development URL disabled). A gatekeeper Worker on the **Workers Free plan** (`workers/terrain-gatekeeper/`) is the only way in: 100,000 requests/day hard limit (Error 1027, not billed), so at most 3.1 M R2 reads a month, about 31% of the free 10 M. It accepts only GET of known tile paths from the app's origins and caches answers. $1 budget alert. **Deployed 2026-11-15:** `https://concorde-terrain.emiliano-bucam.workers.dev` (bucket r2.dev access confirmed disabled; tested: allowed origin 404 while empty, no or unknown origin 403, bad path 404, PUT 405). Upload token goes in `.env.local`, never in chat. Never upgrade Workers to Paid. | **MANUAL** (account, `npx wrangler login`, token) | none |
| 5 | **Full build (done 2026-11-15, run by Claude):** downloads complete with exact sizes; global 16,200 tiles in about 40 min; polar 3,909 tiles (20 / 80 / 160 / 320 / 640 m) in about 40 min, every tile has data. Total 20,110 files, 5.04 GB; upload needs about 20,131 Class A operations (2% of the free 1 M). `verify`: 384 random tiles across all 6 layers bit-for-bit identical to the sources. | Claude | none |
| 6 | **Upload** with `scripts/upload_tiles.py` (rclone 1.76.0, installed 2026-11-15): refuses a test build and anything over 95% of the free tier, uploads tiles then `manifest.json` last, no HEAD reads, then reads random tiles back through the Worker byte-for-byte. Needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in `.env.local` (token: Object Read & Write, scoped to `concorde-terrain`). The app's tile address is the Worker URL (public, safe in the browser). | **MANUAL** (create the token), Claude runs it | none |
| 7 | **Browser terrain engine (built 2026-11-15, on Fable at the user's choice):** `src/terrain/tiles.ts` (tile decoders, the two projections in closed form, on-demand tile windows) and `src/terrain/engine.ts` (a port of `build_terrain.py`: same levels, distances, ray steps, bins, grid sizes). Found while validating: rasterio rounds window offsets as `floor(v + 0.1)` and lengths as `floor(v + 0.5)`; any other rounding shifts a grid by one pixel. Not yet wired into the app (Worker wrapper and UI are step 9). | Claude | current |
| 8 | **Validation (done 2026-11-15, `src/terrain/validate.test.ts`, run with `node --experimental-strip-types`):** at all 6 curated sites the engine reproduces the validated files exactly: horizon max difference 0.000° in every bin, Sun/Earth visible-or-hidden agreement 100% over all hourly samples, every near/mid/far grid node within 0.01 m. Speed on the local tiles: 0.6 s away from the pole (6 to 9 tiles), about 4.2 s at the south pole (79 to 85 tiles, about 48 MB on first load). Pass mark (median < 0.1°, agreement >= 99%) exceeded. | Claude | current |
| 9 | **App UI (built 2026-11-15, on top of the teammates' 4 new `stage` commits):** the globe's "Picked point" box has **Open Horizon view here**; a Web Worker (`src/terrain/worker.ts`) computes the point and `src/terrain/anywhere.ts` builds the same `SiteData` the Horizon view uses. Sun and Earth come from `ephemeris.json` geometry (`zones.ts` `skyAtPoint`), checked against each curated site's own Horizons table: positions within 0.006°, Earth lit fraction within 0.005 points, same visible/hidden decision in 99.98-100% of hours. Earth's picture orientation is taken from Shackleton's table (parallax up to about 0.3°, visual only). The sidebar labels these points ("Point picked on the map", resolution, radius, "not a curated site"); shareable links `?view=horizon&pt=lat,lon`; assistant tool `openHorizonViewAtPoint`. Tiles are downloaded in parallel. Browser checks (live, through the Worker): Tycho rim 8.4 s first time (9 tiles), a point at 12.2°N 1.5 s (6 tiles), south pole points 42.5 s before / 8.8 s after parallel downloads (85 tiles); no console errors; Shackleton regression unchanged (Earth 52%, Earthset Dec 1 02:34 UTC). | Claude | current |
| 10 | **Docs + regression check** (PLAN.md 0.1), commit on `stage` after approval. | Claude, approval **MANUAL** | current |
| 11 | **After the hackathon:** remove `C:\Users\emili\concorde-terrain-tiles-2026\` by hand; optionally remove the R2 bucket (then "anywhere" stops working; curated sites keep working). | **MANUAL** | none |

## Why these choices

- **Real data, not generated terrain:** the horizon must match the real Moon
  (no dummy data rule, Validity criterion). Procedural detail could only ever be
  a labelled visual aid.
- **Pre-built tiles instead of reading NASA live:** browsers cannot read the
  NASA servers (no CORS), and the global file is stored row by row, so reading
  one region live takes about 17 s (PLAN.md Phase 6). Pre-built tiles load in
  seconds and do not depend on NASA servers during the demo.
- **Users download only what they need:** about 1.5 MB per point away from the
  poles, about 25 MB near the south pole (estimates, measured in step 8).
- **Cloudflare R2:** 10 GB free storage and no download fees; the tiles are
  expected to fit.

## Known limits (2026-11-15)

- **Not covered yet: north of 80°N, and between 80°S and 86°S.** The global
  118 m map is equirectangular; near the poles its east-west stretch makes the
  validated method too heavy and too distorted, and the 20 m polar file only
  serves the 200 km horizon south of 86°S. Fix: cut north-polar and
  80-86°S tiles in a polar projection from the global file (same script,
  new layers), then validate the same way. The app says so when a point there
  is picked.
- First load of a south-pole point downloads about 85 tiles (about 50 MB);
  later loads of nearby points come from the browser cache.
- Site metrics tools in the assistant cover curated sites only; for a picked
  point the assistant can open the view and read what is on screen.

## Open questions

- Pass mark in step 8: confirm or change before step 7.
- North pole at 20 m: look for a product, or accept 118 m.
- If the south pole is too slow in the browser (step 8), offer "anywhere"
  away from the pole first and keep the pole curated-only (PLAN.md Phase 6).
