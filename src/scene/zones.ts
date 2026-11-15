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
// below the slope limit. Chosen by Vanessa (2026-11-14); not an official value.
export const MIN_SLOPE_AREA_PERCENT = 20

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

type SkyPoint = { azimuthDeg: number; elevationDeg: number; radiusDeg: number }

// Azimuth (clockwise from north), elevation and apparent radius of a body at
// `bodyKm` (Moon-fixed, from the Moon centre) seen from the point with this frame.
function lookAt(frame: Frame, bodyKm: Vec3, bodyRadiusKm: number): SkyPoint {
  const d: Vec3 = [
    bodyKm[0] - MOON_RADIUS_KM * frame.up[0],
    bodyKm[1] - MOON_RADIUS_KM * frame.up[1],
    bodyKm[2] - MOON_RADIUS_KM * frame.up[2],
  ]
  const length = Math.hypot(...d)
  const azimuthDeg = ((Math.atan2(dot(d, frame.east), dot(d, frame.north)) / RAD) % 360 + 360) % 360
  return {
    azimuthDeg,
    elevationDeg: Math.asin(dot(d, frame.up) / length) / RAD,
    radiusDeg: Math.asin(bodyRadiusKm / length) / RAD,
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

export function evaluateZones(
  grid: ZoneGrid,
  ephemeris: Ephemeris,
  criteria: ZoneCriteria,
  arrivalMs: number | null,
  stayDays: number,
): ZoneResult[] {
  const first = arrivalMs === null ? 0 : Math.round((arrivalMs - ephemeris.startMs) / ephemeris.stepMs)
  const start = Math.min(Math.max(first, 0), ephemeris.rows.length - 1)
  const count = Math.max(1, Math.round((stayDays * 24 * 3_600_000) / ephemeris.stepMs))
  const end = Math.min(start + count, ephemeris.rows.length)
  const steps = ephemeris.rows.slice(start, end).map(bodies)
  const slopeIndex = Math.min(Math.max(Math.round(criteria.slope.maxDeg), 1), SLOPE_STEPS) - 1

  const sunOk = (p: number) => !criteria.sun.on || p >= criteria.sun.minPercent
  const earthOk = (p: number) => !criteria.earth.on || p >= criteria.earth.minPercent

  // A cell meets the Sun and Earth requirements if any of its candidate spots does.
  return grid.cells.map((cell, i) => {
    let best = { sun: -1, earth: -1, point: 0, ok: false }
    cell.points.forEach(([lon, lat], k) => {
      const frame = localFrame(lon, lat)
      const row = i * grid.pointsPerCell + k
      let sunVisible = 0
      let earthVisible = 0
      for (const { sun, earth } of steps) {
        const s = lookAt(frame, sun, SUN_RADIUS_KM)
        if (s.elevationDeg + s.radiusDeg > horizonAt(grid.horizons, row, s.azimuthDeg)) sunVisible += 1
        const e = lookAt(frame, earth, EARTH_RADIUS_KM)
        if (e.elevationDeg + e.radiusDeg > horizonAt(grid.horizons, row, e.azimuthDeg)) earthVisible += 1
      }
      const sunP = (100 * sunVisible) / steps.length
      const earthP = (100 * earthVisible) / steps.length
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
