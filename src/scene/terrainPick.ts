import type { TerrainData, TerrainGrid } from '../types'
import { observerHeightM } from './constants'
import { inverseAffine } from './terrainGrid'

// Picking a point on the Horizon view terrain, for "double-click to go there".
// Scene axes as everywhere in the Horizon view: +X = east, -Z = north, +Y = up,
// site ground at the origin, observer at y = observerHeightM (scene/constants.ts).

const MOON_RADIUS_M = 1_737_400 // same as src/terrain/tiles.ts
const DEG = Math.PI / 180
// Farthest terrain in any Horizon view (curated sites and points: 200 km).
const MAX_DISTANCE_M = 220_000

export type TerrainHit = { x: number; y: number; z: number; distanceM: number }

type GridLookup = { grid: TerrainGrid; columns: [number, number, number, number]; origin: [number, number] }

function lookup(grid: TerrainGrid): GridLookup {
  const { columns, origin } = inverseAffine(grid)
  return { grid, columns, origin }
}

// Terrain height at scene (x, z) from one grid (bilinear between nodes), or
// null outside it. Uses the grid's affine map (col, row) -> (x, z); its error
// from curvature is a few meters at most (engine.ts affineFit).
function heightIn({ grid, columns, origin }: GridLookup, x: number, z: number): number | null {
  const dx = x - origin[0]
  const dz = z - origin[1]
  const col = columns[0] * dx + columns[2] * dz
  const row = columns[1] * dx + columns[3] * dz
  const max = grid.size - 1
  if (col < 0 || row < 0 || col > max || row > max) return null
  const c0 = Math.min(Math.floor(col), max - 1)
  const r0 = Math.min(Math.floor(row), max - 1)
  const fc = col - c0
  const fr = row - r0
  const y = (c: number, r: number) => grid.positions[(r * grid.size + c) * 3 + 1]
  return (
    y(c0, r0) * (1 - fc) * (1 - fr) + y(c0 + 1, r0) * fc * (1 - fr) + y(c0, r0 + 1) * (1 - fc) * fr + y(c0 + 1, r0 + 1) * fc * fr
  )
}

// Finest grid that covers (x, z): near, then mid, then far.
export function makeHeightAt(terrain: TerrainData): (x: number, z: number) => number | null {
  const grids = [lookup(terrain.near), lookup(terrain.mid), lookup(terrain.far)]
  return (x, z) => {
    for (const g of grids) {
      const h = heightIn(g, x, z)
      if (h !== null) return h
    }
    return null
  }
}

// First point where a ray from `origin` along unit `dir` goes below the terrain.
// Steps grow with distance (0.5 % of it, at least 1 m), then the crossing is
// refined by bisection, so a hit 10 km away is placed within a few meters.
export function pickTerrain(
  heightAt: (x: number, z: number) => number | null,
  origin: [number, number, number],
  dir: [number, number, number],
): TerrainHit | null {
  const at = (t: number) => [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t] as const
  let prevT = 0
  let t = 1
  while (t < MAX_DISTANCE_M) {
    const [x, y, z] = at(t)
    const h = heightAt(x, z)
    if (h === null) return null // left the terrain
    if (y <= h) {
      let lo = prevT
      let hi = t
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        const [mx, my, mz] = at(mid)
        const mh = heightAt(mx, mz)
        if (mh !== null && my <= mh) hi = mid
        else lo = mid
      }
      const [hx, , hz] = at(hi)
      return { x: hx, y: heightAt(hx, hz) ?? at(hi)[1], z: hz, distanceM: Math.hypot(hx, hz) }
    }
    prevT = t
    t += Math.max(1, t * 0.005)
  }
  return null
}

// Scene x, z (meters) of a place given in degrees, seen from the site at
// (siteLatDeg, siteLonDeg). Inverse of sceneToLatLon on the sphere; the height
// is taken from the terrain afterwards (makeHeightAt).
export function latLonToScene(siteLatDeg: number, siteLonDeg: number, latDeg: number, lonDeg: number): { x: number; z: number } {
  const lat = siteLatDeg * DEG
  const lon = siteLonDeg * DEG
  const east = [-Math.sin(lon), Math.cos(lon), 0]
  const north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)]
  const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  const pl = latDeg * DEG
  const po = lonDeg * DEG
  const p = [Math.cos(pl) * Math.cos(po), Math.cos(pl) * Math.sin(po), Math.sin(pl)]
  const d = [0, 1, 2].map((k) => (p[k] - up[k]) * MOON_RADIUS_M)
  return { x: d[0] * east[0] + d[1] * east[1] + d[2] * east[2], z: -(d[0] * north[0] + d[1] * north[1] + d[2] * north[2]) }
}

// Latitude and longitude (east, 0..360) of a scene point seen from the site at
// (siteLatDeg, siteLonDeg). Same frame as src/terrain/engine.ts localFrame:
// world point = observer + east * x + north * (-z) + up * (y - observer height).
export function sceneToLatLon(siteLatDeg: number, siteLonDeg: number, x: number, y: number, z: number): { latDeg: number; lonDeg: number } {
  const lat = siteLatDeg * DEG
  const lon = siteLonDeg * DEG
  const east = [-Math.sin(lon), Math.cos(lon), 0]
  const north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)]
  const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  const r = MOON_RADIUS_M + observerHeightM
  const u = y - observerHeightM
  const p = [0, 1, 2].map((k) => up[k] * r + east[k] * x - north[k] * z + up[k] * u)
  const latDeg = Math.atan2(p[2], Math.hypot(p[0], p[1])) / DEG
  const lonDeg = ((Math.atan2(p[1], p[0]) / DEG) % 360 + 360) % 360
  return { latDeg, lonDeg }
}
