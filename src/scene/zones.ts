// Requirements for every cell of the south pole zone grid, for any arrival
// date and stay, computed in the browser from:
//  - public/data/zones/south-pole-1km*.{json,bin} (scripts/build_zones.py):
//    horizon per cell (1 degree bins) and slope shares;
//  - public/data/ephemeris.json (scripts/fetch_ephemeris.py): sub-Earth and
//    sub-solar points on the Moon and their distances, hourly.
// Visibility rule as everywhere in the app: some part of the disc above the terrain.

// `points`: the cell's candidate spots (its highest points, scripts/build_zones.py).
export type ZoneCell = { lon: number; lat: number; corners: [number, number][]; points: [number, number][] }

export type ZoneGrid = {
  id: string
  cellSizeM: number
  pointsPerCell: number
  cells: ZoneCell[]
  horizons: Int16Array // cells x points x 360, degrees x 100
  slope: Uint8Array // cells x 30, % of area with slope <= 1..30 degrees
}

export type Ephemeris = { startMs: number; stepMs: number; rows: number[][] }

type Vec3 = [number, number, number]

const MOON_RADIUS_KM = 1737.4
const EARTH_RADIUS_KM = 6378.137
const SUN_RADIUS_KM = 695_700
const BINS = 360
const SLOPE_STEPS = 30
// A cell passes the slope requirement when at least this share of its area is
// below the slope limit. Chosen by Vanessa: 20 % on 2026-11-14, changed to 90 %
// the same day (stricter, fewer false greens). Not an official value.
// Used by the south pole zones and the whole-Moon cells (globalCells.ts).
export const MIN_SLOPE_AREA_PERCENT = 90

const RAD = Math.PI / 180

function unit(lonDeg: number, latDeg: number): Vec3 {
  const lo = lonDeg * RAD
  const la = latDeg * RAD
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

type Frame = { up: Vec3; east: Vec3; north: Vec3 }

function localFrame(lonDeg: number, latDeg: number): Frame {
  const lo = lonDeg * RAD
  const la = latDeg * RAD
  return {
    up: unit(lonDeg, latDeg),
    east: [-Math.sin(lo), Math.cos(lo), 0],
    north: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
  }
}

function bodies(row: number[]): { earth: Vec3; sun: Vec3 } {
  const [earthLon, earthLat, earthKm, sunLon, sunLat, sunKm] = row
  const e = unit(earthLon, earthLat)
  const s = unit(sunLon, sunLat)
  return { earth: [e[0] * earthKm, e[1] * earthKm, e[2] * earthKm], sun: [s[0] * sunKm, s[1] * sunKm, s[2] * sunKm] }
}

function horizonAt(horizons: Int16Array, row: number, azimuthDeg: number): number {
  const x = azimuthDeg % BINS
  const k = Math.floor(x)
  const f = x - k
  const base = row * BINS
  return (horizons[base + k] * (1 - f) + horizons[base + ((k + 1) % BINS)] * f) / 100
}

type ZoneCriteria = {
  sun: { on: boolean; minPercent: number }
  earth: { on: boolean; minPercent: number }
  slope: { on: boolean; maxDeg: number }
}

export type ZoneResult = {
  sunPercent: number
  earthPercent: number
  slopeAreaPercent: number // share of the cell with slope <= the limit
  meets: boolean
  // Candidate spot used for the Sun/Earth values (the best one of the cell).
  bestPoint: number
}

// Sun and Earth share of the stay at every candidate spot (cells x points).
// This is the slow part; it depends only on the arrival and the stay, not on the
// thresholds, so moving a threshold only needs classifyZones().
export type ZoneShares = { sun: Float32Array; earth: Float32Array }

// Lowest and highest horizon of each spot: when a body is clearly above or below
// both, its azimuth (atan2) and the horizon lookup are not needed. Same result.
const horizonRange = new WeakMap<Int16Array, { min: Float64Array; max: Float64Array }>()

function rangeOf(horizons: Int16Array): { min: Float64Array; max: Float64Array } {
  let range = horizonRange.get(horizons)
  if (!range) {
    const rows = horizons.length / BINS
    const min = new Float64Array(rows)
    const max = new Float64Array(rows)
    for (let r = 0; r < rows; r++) {
      let lo = Infinity
      let hi = -Infinity
      for (let b = 0; b < BINS; b++) {
        const v = horizons[r * BINS + b]
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      min[r] = lo / 100
      max[r] = hi / 100
    }
    range = { min, max }
    horizonRange.set(horizons, range)
  }
  return range
}

export function computeZoneShares(
  grid: ZoneGrid,
  ephemeris: Ephemeris,
  arrivalMs: number | null,
  stayDays: number,
): ZoneShares {
  const first = arrivalMs === null ? 0 : Math.round((arrivalMs - ephemeris.startMs) / ephemeris.stepMs)
  const start = Math.min(Math.max(first, 0), ephemeris.rows.length - 1)
  const count = Math.max(1, Math.round((stayDays * 24 * 3_600_000) / ephemeris.stepMs))
  const end = Math.min(start + count, ephemeris.rows.length)
  const steps = ephemeris.rows.slice(start, end).map(bodies)
  const n = steps.length
  // Body positions as flat arrays, and |body|^2, for a tight loop.
  const sx = new Float64Array(n), sy = new Float64Array(n), sz = new Float64Array(n), s2 = new Float64Array(n)
  const ex = new Float64Array(n), ey = new Float64Array(n), ez = new Float64Array(n), e2 = new Float64Array(n)
  steps.forEach(({ sun, earth }, t) => {
    sx[t] = sun[0]; sy[t] = sun[1]; sz[t] = sun[2]; s2[t] = dot(sun, sun)
    ex[t] = earth[0]; ey[t] = earth[1]; ez[t] = earth[2]; e2[t] = dot(earth, earth)
  })
  const { min, max } = rangeOf(grid.horizons)
  const total = grid.cells.length * grid.pointsPerCell
  const sunShare = new Float32Array(total)
  const earthShare = new Float32Array(total)
  const R = MOON_RADIUS_KM

  const horizons = grid.horizons
  const R2 = R * R
  // Seen from a spot at R * up: d = body - R * up, elevation = asin(d.up / |d|),
  // apparent radius = asin(radius / |d|), azimuth clockwise from north from the
  // east and north parts (d.east = body.east and d.north = body.north, because
  // up is normal to both).
  const visible = (
    ux: number, uy: number, uz: number,
    exx: number, exy: number,
    nx: number, ny: number, nz: number,
    row: number,
    bx: number, by: number, bz: number, b2: number,
    radiusKm: number,
  ) => {
    const bu = bx * ux + by * uy + bz * uz
    const length = Math.sqrt(b2 - 2 * R * bu + R2)
    const top = (Math.asin((bu - R) / length) + Math.asin(radiusKm / length)) / RAD
    if (top > max[row]) return true
    if (top <= min[row]) return false
    const east = bx * exx + by * exy // east has no z part
    const north = bx * nx + by * ny + bz * nz
    let azimuth = Math.atan2(east, north) / RAD
    if (azimuth < 0) azimuth += 360
    return top > horizonAt(horizons, row, azimuth)
  }

  const pointsPerCell = grid.pointsPerCell
  for (let i = 0; i < grid.cells.length; i++) {
    const points = grid.cells[i].points
    for (let k = 0; k < points.length; k++) {
      const [lon, lat] = points[k]
      const { up, east, north } = localFrame(lon, lat)
      const row = i * pointsPerCell + k
      let sunVisible = 0
      let earthVisible = 0
      for (let t = 0; t < n; t++) {
        if (visible(up[0], up[1], up[2], east[0], east[1], north[0], north[1], north[2], row, sx[t], sy[t], sz[t], s2[t], SUN_RADIUS_KM)) sunVisible += 1
        if (visible(up[0], up[1], up[2], east[0], east[1], north[0], north[1], north[2], row, ex[t], ey[t], ez[t], e2[t], EARTH_RADIUS_KM)) earthVisible += 1
      }
      sunShare[row] = (100 * sunVisible) / n
      earthShare[row] = (100 * earthVisible) / n
    }
  }
  return { sun: sunShare, earth: earthShare }
}

// Fast part: thresholds applied to precomputed shares.
export function classifyZones(grid: ZoneGrid, shares: ZoneShares, criteria: ZoneCriteria): ZoneResult[] {
  const slopeIndex = Math.min(Math.max(Math.round(criteria.slope.maxDeg), 1), SLOPE_STEPS) - 1
  const sunOk = (p: number) => !criteria.sun.on || p >= criteria.sun.minPercent
  const earthOk = (p: number) => !criteria.earth.on || p >= criteria.earth.minPercent

  // A cell meets the Sun and Earth requirements if any of its candidate spots does.
  return grid.cells.map((cell, i) => {
    let best = { sun: -1, earth: -1, point: 0, ok: false }
    cell.points.forEach((_, k) => {
      const row = i * grid.pointsPerCell + k
      const sunP = shares.sun[row]
      const earthP = shares.earth[row]
      const ok = sunOk(sunP) && earthOk(earthP)
      // Prefer a spot that passes; then more Sun; then more Earth.
      if ((ok && !best.ok) || (ok === best.ok && (sunP > best.sun || (sunP === best.sun && earthP > best.earth)))) {
        best = { sun: sunP, earth: earthP, point: k, ok }
      }
    })
    const slopeAreaPercent = grid.slope[i * SLOPE_STEPS + slopeIndex]
    const meets = best.ok && (!criteria.slope.on || slopeAreaPercent >= MIN_SLOPE_AREA_PERCENT)
    return { sunPercent: best.sun, earthPercent: best.earth, slopeAreaPercent, meets, bestPoint: best.point }
  })
}

export function evaluateZones(
  grid: ZoneGrid,
  ephemeris: Ephemeris,
  criteria: ZoneCriteria,
  arrivalMs: number | null,
  stayDays: number,
): ZoneResult[] {
  return classifyZones(grid, computeZoneShares(grid, ephemeris, arrivalMs, stayDays), criteria)
}

let gridPromise: Promise<ZoneGrid> | null = null
let ephemerisPromise: Promise<Ephemeris> | null = null

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
  return response
}

export function loadZoneGrid(): Promise<ZoneGrid> {
  if (!gridPromise) {
    gridPromise = (async () => {
      const base = '/data/zones/'
      const meta = (await (await fetchOk(`${base}south-pole-1km.json`)).json()) as {
        id: string
        cellSizeM: number
        pointsPerCell?: number
        horizonFile: string
        slopeFile: string
        cells: (Omit<ZoneCell, 'points'> & { points?: [number, number][] })[]
      }
      const [h, s] = await Promise.all([
        fetchOk(base + meta.horizonFile).then((r) => r.arrayBuffer()),
        fetchOk(base + meta.slopeFile).then((r) => r.arrayBuffer()),
      ])
      const horizons = new Int16Array(h)
      const slope = new Uint8Array(s)
      const pointsPerCell = meta.pointsPerCell ?? 1
      if (
        horizons.length !== meta.cells.length * pointsPerCell * BINS ||
        slope.length !== meta.cells.length * SLOPE_STEPS
      ) {
        throw new Error('Zone files do not match the cell count')
      }
      // Older files have one point (the centre) and no `points` list.
      const cells = meta.cells.map((c) => ({ ...c, points: c.points ?? [[c.lon, c.lat]] }))
      return { id: meta.id, cellSizeM: meta.cellSizeM, pointsPerCell, cells, horizons, slope }
    })()
    gridPromise.catch(() => {
      gridPromise = null
    })
  }
  return gridPromise
}

export function loadEphemeris(): Promise<Ephemeris> {
  if (!ephemerisPromise) {
    ephemerisPromise = fetchOk('/data/ephemeris.json')
      .then((r) => r.json() as Promise<{ startUtc: string; stepHours: number; rows: number[][] }>)
      .then((json) => ({ startMs: Date.parse(json.startUtc), stepMs: json.stepHours * 3_600_000, rows: json.rows }))
    ephemerisPromise.catch(() => {
      ephemerisPromise = null
    })
  }
  return ephemerisPromise
}
