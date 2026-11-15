import type { Criteria } from './requirements'
import type { Ephemeris } from './zones'
import { MIN_SLOPE_AREA_PERCENT } from './zones'

// Requirements for every 0.5° cell of the whole Moon (720 x 360 = 259,200 cells),
// for any arrival date and stay, computed in the browser from:
//  - public/data/ephemeris.json (scripts/fetch_ephemeris.py): Sun and Earth, hourly;
//  - public/data/global/slope_fraction.{json,bin} (scripts/build_slope_grid.py):
//    share of each cell's area with slope <= 1..30° (SLDEM2015, about 118 m pixels).
//
// Limit: there is no terrain horizon here. Each cell is judged at its centre on a
// smooth Moon sphere, so hills and crater walls that hide the Sun or the Earth are
// not counted. The south pole zone grid (zones.ts) has a real terrain horizon and
// is drawn on top of this map.
//
// Visibility rule as everywhere in the app: some part of the disc above the horizon.
// With a flat horizon this is exact and needs no square root:
//   elevation + apparent radius > 0  <=>  dot(body, up) > R_moon - R_body
// (both sides of "sin(elevation) > -sin(radius)" have the same distance in the denominator).

const MOON_RADIUS_KM = 1737.4
const EARTH_RADIUS_KM = 6378.137
const SUN_RADIUS_KM = 695_700
const SLOPE_STEPS = 30
const RAD = Math.PI / 180

export type GlobalSlope = {
  cellDeg: number
  cellsLat: number
  cellsLon: number
  // cellsLat x cellsLon x 31: % of area with slope <= 1..30°, then % of the cell with data.
  table: Uint8Array
  baselineNote: string
}

// Fine slope (scripts/build_slope_grid.py --fine): 1/16° cells (about 2 km), one
// byte each = slope under which `areaPercent` % of the cell lies, x 8, rounded up.
// A cell passes a whole-degree limit L when value <= 8 * L.
export type FineSlope = {
  cellDeg: number
  cellsLat: number
  cellsLon: number
  p90: Uint8Array
  areaPercent: number
}

export type GlobalResult = {
  cellDeg: number
  cellsLat: number
  cellsLon: number
  // Row 0 = north edge (+90°), column 0 starts at longitude 0° E (same as the slope file).
  sunPercent: Float32Array
  earthPercent: Float32Array
  sunEarthOk: Uint8Array // 1 = meets the Sun and Earth requirements
  meets: Uint8Array // 1 = meets every active requirement (0.5° slope); not used when `fine` is set
  // Set when the slope requirement is on and the 2 km table is loaded: slope is
  // then judged per 2 km cell (value <= slopeByte).
  fine: FineSlope | null
  slopeByte: number
  meetsCount: number // cells that meet, counted at the finest cell size in use
  totalCells: number
  hasSlope: boolean
  stepsCounted: number
  computeMs: number // measured time of this computation
}

export const GLOBAL_CELL_DEG = 0.5

// Sun and Earth position (km, Moon-fixed, from the Moon centre) at one ephemeris row.
function bodyVectors(row: number[]): { earth: [number, number, number]; sun: [number, number, number] } {
  const [earthLon, earthLat, earthKm, sunLon, sunLat, sunKm] = row
  const vec = (lon: number, lat: number, km: number): [number, number, number] => [
    km * Math.cos(lat * RAD) * Math.cos(lon * RAD),
    km * Math.cos(lat * RAD) * Math.sin(lon * RAD),
    km * Math.sin(lat * RAD),
  ]
  return { earth: vec(earthLon, earthLat, earthKm), sun: vec(sunLon, sunLat, sunKm) }
}

// Sun and Earth share of the stay for every cell. Depends only on the arrival
// and the stay, so moving a threshold only needs classifyGlobal().
export type GlobalShares = {
  cellDeg: number
  cellsLat: number
  cellsLon: number
  sunPercent: Float32Array
  earthPercent: Float32Array
  steps: number
}

// Adds 1 to every cell of one latitude row that sees the body at one hour.
// On a smooth sphere those cells form one arc of longitude: with the body at
// (x, y, z), a cell at (lat, lon) sees it when
//   cos(lat) * rho * cos(lon - phi) + z * sin(lat) > limit,  rho = |(x, y)|, phi = atan2(y, x),
// so the arc is centred on phi with half width acos(q). The arc is written
// into a difference row (+1 at its start, -1 after its end) and summed at the end.
function addArc(
  diff: Int32Array,
  all: Int32Array,
  row: number,
  cellsLon: number,
  cellRad: number,
  cosLat: number,
  sinLat: number,
  body: [number, number, number],
  limit: number,
) {
  const rho = Math.hypot(body[0], body[1])
  const z = body[2] * sinLat
  const reach = cosLat * rho
  if (reach < 1e-9) {
    if (z > limit) all[row] += 1
    return
  }
  const q = (limit - z) / reach
  if (q >= 1) return
  if (q < -1) {
    all[row] += 1
    return
  }
  const phi = Math.atan2(body[1], body[0])
  const halfWidth = Math.acos(q)
  // Cell j has its centre at (j + 0.5) * cellRad; keep centres strictly inside the arc.
  const first = Math.floor((phi - halfWidth) / cellRad - 0.5) + 1
  const last = Math.ceil((phi + halfWidth) / cellRad - 0.5) - 1
  const count = last - first + 1
  if (count <= 0) return
  if (count >= cellsLon) {
    all[row] += 1
    return
  }
  const start = ((first % cellsLon) + cellsLon) % cellsLon
  const base = row * (cellsLon + 1)
  diff[base + start] += 1
  if (start + count <= cellsLon) {
    diff[base + start + count] -= 1
  } else {
    diff[base + cellsLon] -= 1
    diff[base] += 1
    diff[base + start + count - cellsLon] -= 1
  }
}

export function computeGlobalShares(
  ephemeris: Ephemeris,
  arrivalMs: number | null,
  stayDays: number,
  cellDeg = GLOBAL_CELL_DEG,
): GlobalShares {
  const cellsLat = Math.round(180 / cellDeg)
  const cellsLon = Math.round(360 / cellDeg)
  const total = cellsLat * cellsLon
  const cellRad = cellDeg * RAD

  // Same stay window as zones.ts: hourly rows in [arrival, arrival + stay).
  const first = arrivalMs === null ? 0 : Math.round((arrivalMs - ephemeris.startMs) / ephemeris.stepMs)
  const start = Math.min(Math.max(first, 0), ephemeris.rows.length - 1)
  const count = Math.max(1, Math.round((stayDays * 24 * 3_600_000) / ephemeris.stepMs))
  const end = Math.min(start + count, ephemeris.rows.length)
  const steps = end - start

  const cosLat = new Float64Array(cellsLat)
  const sinLat = new Float64Array(cellsLat)
  for (let i = 0; i < cellsLat; i++) {
    const lat = (90 - (i + 0.5) * cellDeg) * RAD
    cosLat[i] = Math.cos(lat)
    sinLat[i] = Math.sin(lat)
  }

  const sunDiff = new Int32Array(cellsLat * (cellsLon + 1))
  const earthDiff = new Int32Array(cellsLat * (cellsLon + 1))
  const sunAll = new Int32Array(cellsLat)
  const earthAll = new Int32Array(cellsLat)
  const sunLimit = MOON_RADIUS_KM - SUN_RADIUS_KM
  const earthLimit = MOON_RADIUS_KM - EARTH_RADIUS_KM

  for (let s = start; s < end; s++) {
    const { sun, earth } = bodyVectors(ephemeris.rows[s])
    for (let i = 0; i < cellsLat; i++) {
      addArc(sunDiff, sunAll, i, cellsLon, cellRad, cosLat[i], sinLat[i], sun, sunLimit)
      addArc(earthDiff, earthAll, i, cellsLon, cellRad, cosLat[i], sinLat[i], earth, earthLimit)
    }
  }

  const sunPercent = new Float32Array(total)
  const earthPercent = new Float32Array(total)
  for (let i = 0; i < cellsLat; i++) {
    let sunRun = 0
    let earthRun = 0
    const base = i * (cellsLon + 1)
    for (let j = 0; j < cellsLon; j++) {
      sunRun += sunDiff[base + j]
      earthRun += earthDiff[base + j]
      sunPercent[i * cellsLon + j] = (100 * (sunRun + sunAll[i])) / steps
      earthPercent[i * cellsLon + j] = (100 * (earthRun + earthAll[i])) / steps
    }
  }
  return { cellDeg, cellsLat, cellsLon, sunPercent, earthPercent, steps }
}

// Fast part: thresholds applied to precomputed shares.
export function classifyGlobal(
  shares: GlobalShares,
  criteria: Criteria,
  slope: GlobalSlope | null,
  fineSlope: FineSlope | null = null,
): GlobalResult {
  const startedMs = performance.now()
  const { cellDeg, cellsLat, cellsLon, sunPercent, earthPercent, steps } = shares
  const total = cellsLat * cellsLon
  const sunEarthOk = new Uint8Array(total)
  const meets = new Uint8Array(total)
  const limitDeg = Math.min(Math.max(Math.round(criteria.slope.maxDeg), 1), SLOPE_STEPS)
  const slopeIndex = limitDeg - 1
  const channels = SLOPE_STEPS + 1
  let meetsCount = 0
  for (let k = 0; k < total; k++) {
    const sunOk = !criteria.sun.on || sunPercent[k] >= criteria.sun.minPercent
    const earthOk = !criteria.earth.on || earthPercent[k] >= criteria.earth.minPercent
    if (!sunOk || !earthOk) continue
    sunEarthOk[k] = 1
    // No slope data = cannot pass a slope requirement (same rule as the sites).
    let slopeOk = !criteria.slope.on
    if (criteria.slope.on && slope) {
      const hasData = slope.table[k * channels + SLOPE_STEPS] > 0
      slopeOk = hasData && slope.table[k * channels + slopeIndex] >= MIN_SLOPE_AREA_PERCENT
    }
    if (slopeOk) {
      meets[k] = 1
      meetsCount += 1
    }
  }

  // With the 2 km table, slope is judged per 2 km cell inside each 0.5° cell.
  const ratio = fineSlope ? Math.round(cellDeg / fineSlope.cellDeg) : 0
  const fine = criteria.slope.on && fineSlope && ratio * fineSlope.cellDeg === cellDeg ? fineSlope : null
  const slopeByte = limitDeg * 8
  let totalCells = total
  if (fine) {
    meetsCount = 0
    totalCells = fine.cellsLat * fine.cellsLon
    for (let i = 0; i < cellsLat; i++) {
      for (let j = 0; j < cellsLon; j++) {
        if (!sunEarthOk[i * cellsLon + j]) continue
        for (let fi = i * ratio; fi < (i + 1) * ratio; fi++) {
          const base = fi * fine.cellsLon
          for (let fj = j * ratio; fj < (j + 1) * ratio; fj++) if (fine.p90[base + fj] <= slopeByte) meetsCount += 1
        }
      }
    }
  }

  return {
    cellDeg,
    cellsLat,
    cellsLon,
    sunPercent,
    earthPercent,
    sunEarthOk,
    meets,
    fine,
    slopeByte,
    meetsCount,
    totalCells,
    hasSlope: slope !== null || fineSlope !== null,
    stepsCounted: steps,
    computeMs: performance.now() - startedMs,
  }
}

export function evaluateGlobal(
  ephemeris: Ephemeris,
  criteria: Criteria,
  arrivalMs: number | null,
  stayDays: number,
  slope: GlobalSlope | null,
  fineSlope: FineSlope | null = null,
): GlobalResult {
  return classifyGlobal(computeGlobalShares(ephemeris, arrivalMs, stayDays, slope?.cellDeg), criteria, slope, fineSlope)
}

// Does the point meet every requirement? Uses the 2 km slope when available.
export function meetsAt(result: GlobalResult, latDeg: number, lonDeg: number): boolean {
  const k = globalCellIndex(result, latDeg, lonDeg)
  if (!result.fine) return result.meets[k] === 1
  return result.sunEarthOk[k] === 1 && result.fine.p90[fineCellIndex(result.fine, latDeg, lonDeg)] <= result.slopeByte
}

export function fineCellIndex(fine: FineSlope, latDeg: number, lonDeg: number): number {
  const i = Math.min(Math.max(Math.floor((90 - latDeg) / fine.cellDeg), 0), fine.cellsLat - 1)
  const lon = ((lonDeg % 360) + 360) % 360
  const j = Math.min(Math.floor(lon / fine.cellDeg), fine.cellsLon - 1)
  return i * fine.cellsLon + j
}

// Slope (degrees) under which 90 % of the 2 km cell lies, or null when steeper
// than the table covers.
export function fineSlopeAt(fine: FineSlope, latDeg: number, lonDeg: number): number | null {
  const value = fine.p90[fineCellIndex(fine, latDeg, lonDeg)]
  return value === 255 ? null : value / 8
}

let finePromise: Promise<FineSlope | null> | null = null

// public/data/global/slope_p90.{json,bin}. Null when not built yet, or when it
// was built for another area rule than the app uses (then the 0.5° table is used).
export function loadFineSlope(): Promise<FineSlope | null> {
  if (!finePromise) {
    finePromise = (async () => {
      const metaResponse = await fetch('/data/global/slope_p90.json')
      const type = metaResponse.headers.get('content-type') ?? ''
      if (!metaResponse.ok || !type.includes('json')) return null
      const meta = (await metaResponse.json()) as { cell_deg: number; cells_lat: number; cells_lon: number; area_percent: number }
      if (meta.area_percent !== MIN_SLOPE_AREA_PERCENT) return null
      const binResponse = await fetch('/data/global/slope_p90.bin')
      if (!binResponse.ok) return null
      const p90 = new Uint8Array(await binResponse.arrayBuffer())
      if (p90.length !== meta.cells_lat * meta.cells_lon) throw new Error('2 km slope file does not match its .json')
      return { cellDeg: meta.cell_deg, cellsLat: meta.cells_lat, cellsLon: meta.cells_lon, p90, areaPercent: meta.area_percent }
    })()
    finePromise.catch(() => {
      finePromise = null
    })
  }
  return finePromise
}

// Index of the cell holding a point (longitude in degrees east, any range).
export function globalCellIndex(result: GlobalResult, latDeg: number, lonDeg: number): number {
  const i = Math.min(Math.max(Math.floor((90 - latDeg) / result.cellDeg), 0), result.cellsLat - 1)
  const lon = ((lonDeg % 360) + 360) % 360
  const j = Math.min(Math.floor(lon / result.cellDeg), result.cellsLon - 1)
  return i * result.cellsLon + j
}

let slopePromise: Promise<GlobalSlope | null> | null = null

// public/data/global/slope_fraction.{json,bin}. Resolves to null when the files
// are not built yet (the dev server answers unknown paths with index.html).
export function loadGlobalSlope(): Promise<GlobalSlope | null> {
  if (!slopePromise) {
    slopePromise = (async () => {
      const metaResponse = await fetch('/data/global/slope_fraction.json')
      const type = metaResponse.headers.get('content-type') ?? ''
      if (!metaResponse.ok || !type.includes('json')) return null
      const meta = (await metaResponse.json()) as {
        cell_deg: number
        cells_lat: number
        cells_lon: number
        channels: string[]
        baseline_note?: string
      }
      const binResponse = await fetch('/data/global/slope_fraction.bin')
      if (!binResponse.ok) return null
      const table = new Uint8Array(await binResponse.arrayBuffer())
      if (meta.channels.length !== SLOPE_STEPS + 1 || table.length !== meta.cells_lat * meta.cells_lon * (SLOPE_STEPS + 1)) {
        throw new Error('Global slope files do not match (expected 1..30° plus a data share per cell)')
      }
      return {
        cellDeg: meta.cell_deg,
        cellsLat: meta.cells_lat,
        cellsLon: meta.cells_lon,
        table,
        baselineNote: meta.baseline_note ?? '',
      }
    })()
    slopePromise.catch(() => {
      slopePromise = null
    })
  }
  return slopePromise
}

// Slope share of one cell under a limit, or null without data.
export function globalSlopeShare(slope: GlobalSlope | null, cell: number, maxDeg: number): number | null {
  if (!slope) return null
  const channels = SLOPE_STEPS + 1
  if (slope.table[cell * channels + SLOPE_STEPS] === 0) return null
  const index = Math.min(Math.max(Math.round(maxDeg), 1), SLOPE_STEPS) - 1
  return slope.table[cell * channels + index]
}
