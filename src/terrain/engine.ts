// Horizon and 3D terrain grids for ANY point on the Moon, computed from the
// terrain tiles. A line-for-line port of scripts/build_terrain.py (same
// levels, distances, ray steps, bins and grid sizes), so a point that has a
// curated folder must get the same numbers from both paths (validated in
// src/terrain/validate.test.ts against the 6 curated sites).
//
// Runs inside a Web Worker (src/terrain/worker.ts); pure functions here.
import {
  blockAverage,
  MOON_RADIUS_M,
  sampleWindow,
  TileLayer,
  type LayerMeta,
  type Manifest,
  type Window,
} from './tiles.ts'

const DEG = Math.PI / 180

export const OBSERVER_HEIGHT_M = 2.0
export const AZIMUTH_STEP_DEG = 0.25
const MIN_DISTANCE_M = 20.0
const POLAR_MAX_DISTANCE_M = 200_000.0
const GLOBAL_RADIUS_M = 50_000.0
// The 20 m polar file is used south of 86°S (build_terrain.py USE_POLAR_DEM).
export const POLAR_LAT_LIMIT_DEG = -86.0

type Level = { layerId: string; resM: number; maxDist: number; step: number }
type GridSpec = { name: 'near' | 'mid' | 'far'; layerId: string; factor: number; halfSize: number }

type Vec3 = [number, number, number]

export type TerrainGridOut = {
  size: number
  spacingM: number
  affine: [number, number, number, number, number, number]
  maxResidualM: number
  positions: Float32Array // x, y, z per node, row-major
}

export type AnywhereResult = {
  horizonDeg: Float64Array // 1440 bins, bin k centered on k * 0.25°
  groundHeightM: number
  near: TerrainGridOut
  mid: TerrainGridOut
  far: TerrainGridOut
  source: string
  nearResolutionM: number
  maxDistanceM: number
  tilesLoaded: number
}

export type FetchTile = (url: string) => Promise<ArrayBuffer | null>

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

// East, north, up unit vectors at a point on the sphere (local_frame).
function localFrame(lonDeg: number, latDeg: number): { east: Vec3; north: Vec3; up: Vec3 } {
  const lon = lonDeg * DEG
  const lat = latDeg * DEG
  return {
    east: [-Math.sin(lon), Math.cos(lon), 0],
    north: [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)],
    up: [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)],
  }
}

function toCartesian(layer: TileLayer, x: number, y: number, heightM: number): Vec3 {
  const [lonDeg, latDeg] = layer.proj.toGeo(x, y)
  const lon = lonDeg * DEG
  const lat = latDeg * DEG
  const r = MOON_RADIUS_M + heightM
  return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)]
}

// Unit vectors in the map plane pointing to local north and east (map_directions).
function mapDirections(layer: TileLayer, lonDeg: number, latDeg: number, x0: number, y0: number) {
  const eps = 1e-5
  const [xn, yn] = layer.proj.toMap(lonDeg, latDeg + eps)
  const [xe, ye] = layer.proj.toMap(lonDeg + eps / Math.cos(latDeg * DEG), latDeg)
  const nn = Math.hypot(xn - x0, yn - y0)
  const ne = Math.hypot(xe - x0, ye - y0)
  return { north: [(xn - x0) / nn, (yn - y0) / nn], east: [(xe - x0) / ne, (ye - y0) / ne] }
}

// Pixel box (inclusive) covering map square [cx ± half, cy ± half], like
// rasterio from_bounds(...).round_offsets().round_lengths(). rasterio 1.5.1
// source: offsets = floor(v + 0.1), lengths = floor(v + 0.5). Any other
// rounding shifts a grid by one pixel (seen at the 6 curated sites, 2026-11-15).
function pixelBox(layer: TileLayer, cx: number, cy: number, half: number) {
  const s = layer.meta.pixelSizeM
  const colOff = Math.floor((cx - half - layer.meta.originX) / s + 0.1)
  const rowOff = Math.floor((layer.meta.originY - (cy + half)) / s + 0.1)
  const size = Math.floor((2 * half) / s + 0.5)
  return { r0: rowOff, c0: colOff, r1: rowOff + size - 1, c1: colOff + size - 1 }
}

async function readWindow(layer: TileLayer, cx: number, cy: number, half: number, factor: number): Promise<Window> {
  const box = pixelBox(layer, cx, cy, half)
  const w = await layer.window(box.r0, box.c0, box.r1, box.c1)
  return factor > 1 ? blockAverage(w, factor) : w
}

function plan(latDeg: number): { polar: boolean; levels: Level[]; grids: GridSpec[]; maxDistance: number; stretch: number } {
  if (latDeg <= POLAR_LAT_LIMIT_DEG) {
    return {
      polar: true,
      stretch: 1,
      maxDistance: POLAR_MAX_DISTANCE_M,
      levels: [
        { layerId: 'south-20m', resM: 20, maxDist: 20_000, step: 10 },
        { layerId: 'south-80m', resM: 80, maxDist: 60_000, step: 40 },
        { layerId: 'south-160m', resM: 160, maxDist: POLAR_MAX_DISTANCE_M, step: 80 },
      ],
      grids: [
        { name: 'near', layerId: 'south-20m', factor: 1, halfSize: 10_000 },
        { name: 'mid', layerId: 'south-320m', factor: 1, halfSize: 80_000 },
        { name: 'far', layerId: 'south-640m', factor: 1, halfSize: POLAR_MAX_DISTANCE_M },
      ],
    }
  }
  // Simple cylindrical map: east-west map meters are stretched by 1/cos(lat).
  const stretch = 1 / Math.cos(latDeg * DEG)
  return {
    polar: false,
    stretch,
    maxDistance: GLOBAL_RADIUS_M,
    levels: [{ layerId: 'global-118m', resM: 118.45, maxDist: GLOBAL_RADIUS_M * stretch, step: 60 }],
    grids: [
      { name: 'near', layerId: 'global-118m', factor: 1, halfSize: 10_000 },
      { name: 'mid', layerId: 'global-118m', factor: 4, halfSize: GLOBAL_RADIUS_M * stretch },
      { name: 'far', layerId: 'global-118m', factor: 8, halfSize: GLOBAL_RADIUS_M * stretch },
    ],
  }
}

export class TerrainEngine {
  private readonly layers = new Map<string, TileLayer>()
  private tilesLoaded = 0

  constructor(manifest: Manifest, baseUrl: string, fetchTile: FetchTile) {
    const counting: FetchTile = async (url) => {
      const data = await fetchTile(url)
      if (data) this.tilesLoaded++
      return data
    }
    for (const meta of manifest.layers) this.layers.set(meta.id, new TileLayer(meta, baseUrl, counting))
  }

  layer(id: string): TileLayer {
    const layer = this.layers.get(id)
    if (!layer) throw new Error(`Terrain layer ${id} is not in the manifest`)
    return layer
  }

  layerMeta(id: string): LayerMeta {
    return this.layer(id).meta
  }

  async compute(lonDeg: number, latDeg: number, onProgress?: (text: string) => void): Promise<AnywhereResult> {
    const p = plan(latDeg)
    const base = this.layer(p.levels[0].layerId)
    const [x0, y0] = base.proj.toMap(lonDeg, latDeg)
    const frame = localFrame(lonDeg, latDeg)

    // Start every download at once (all levels and grids); they are used in
    // order below. Same windows as before, only fetched in parallel.
    onProgress?.('Downloading the terrain tiles')
    const siteWinP = readWindow(base, x0, y0, 200, 1)
    const levelWinP = p.levels.map((level) => readWindow(this.layer(level.layerId), x0, y0, level.maxDist + 4 * level.resM, 1))
    const gridWinP = p.grids.map((g) => readWindow(this.layer(g.layerId), x0, y0, g.halfSize, g.factor))
    // A failed download is reported by the await that needs it, not as unhandled.
    for (const pr of [siteWinP, ...levelWinP, ...gridWinP]) pr.catch(() => {})

    // Ground height under the site (200 m window, bilinear), observer 2 m above.
    const siteWin = await siteWinP
    const ground = sampleWindow(siteWin, x0, y0)
    if (!Number.isFinite(ground)) throw new Error('No terrain data at this point')
    const observer = toCartesian(base, x0, y0, ground + OBSERVER_HEIGHT_M)

    // Horizon (build_horizon): rays 4x denser than bins, max elevation per bin.
    const binCount = Math.round(360 / AZIMUTH_STEP_DEG)
    const horizon = new Float64Array(binCount).fill(-Infinity)
    const rayStep = AZIMUTH_STEP_DEG / 4
    const rayCount = Math.round(360 / rayStep)
    const { north: mapN, east: mapE } = mapDirections(base, lonDeg, latDeg, x0, y0)
    let start = MIN_DISTANCE_M
    for (const [li, level] of p.levels.entries()) {
      const layer = this.layer(level.layerId)
      onProgress?.(`Loading ${Math.round(level.resM)} m terrain out to ${Math.round(level.maxDist / p.stretch / 1000)} km`)
      const win = await levelWinP[li]
      onProgress?.(`Tracing the horizon at ${Math.round(level.resM)} m`)
      for (let i = 0; i < rayCount; i++) {
        const az = i * rayStep * DEG
        const dx = Math.cos(az) * mapN[0] + Math.sin(az) * mapE[0]
        const dy = Math.cos(az) * mapN[1] + Math.sin(az) * mapE[1]
        for (let dist = start; dist < level.maxDist; dist += level.step) {
          const xs = x0 + dx * dist
          const ys = y0 + dy * dist
          const h = sampleWindow(win, xs, ys)
          if (!Number.isFinite(h)) continue
          const pt = toCartesian(layer, xs, ys, h)
          const d: Vec3 = [pt[0] - observer[0], pt[1] - observer[1], pt[2] - observer[2]]
          const norm = Math.hypot(d[0], d[1], d[2])
          const elevation = Math.asin(dot(d, frame.up) / norm) / DEG
          let azimuth = Math.atan2(dot(d, frame.east), dot(d, frame.north)) / DEG
          azimuth = ((azimuth % 360) + 360) % 360
          const bin = Math.round(azimuth / AZIMUTH_STEP_DEG) % binCount
          if (elevation > horizon[bin]) horizon[bin] = elevation
        }
      }
      start = level.maxDist
    }
    for (let k = 0; k < binCount; k++) if (horizon[k] === -Infinity) throw new Error(`Azimuth bin ${k} got no terrain samples`)

    // Grids (build_grid): nodes on the sphere, scene x = east, y = up, z = -north.
    const grids: Partial<Record<'near' | 'mid' | 'far', TerrainGridOut>> = {}
    for (const [gi, g] of p.grids.entries()) {
      onProgress?.(`Building the ${g.name} 3D grid`)
      const win = await gridWinP[gi]
      grids[g.name] = buildGrid(win, observer, frame)
    }
    const nearMeta = this.layerMeta(p.grids[0].layerId)
    return {
      horizonDeg: horizon,
      groundHeightM: ground,
      near: grids.near!,
      mid: grids.mid!,
      far: grids.far!,
      source: nearMeta.source,
      nearResolutionM: nearMeta.pixelSizeM,
      maxDistanceM: p.maxDistance,
      tilesLoaded: this.tilesLoaded,
    }
  }
}

function buildGrid(win: Window, observer: Vec3, frame: ReturnType<typeof localFrame>): TerrainGridOut {
  const size = Math.min(win.rows, win.cols)
  const spacing = win.layer.meta.pixelSizeM
  const heights = new Float64Array(size * size)
  let sum = 0
  let count = 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = win.data[r * win.cols + c]
      heights[r * size + c] = v
      if (!Number.isNaN(v)) {
        sum += v
        count++
      }
    }
  }
  const mean = count ? sum / count : 0
  const positions = new Float32Array(size * size * 3)
  const sx = new Float64Array(size * size)
  const sz = new Float64Array(size * size)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c
      const h = Number.isNaN(heights[i]) ? mean : heights[i]
      const [x, y] = win.layer.mapOfPixel(win.col0 + c, win.row0 + r)
      const pt = toCartesian(win.layer, x, y, h)
      const d: Vec3 = [pt[0] - observer[0], pt[1] - observer[1], pt[2] - observer[2]]
      sx[i] = dot(d, frame.east)
      sz[i] = -dot(d, frame.north)
      positions[i * 3] = sx[i]
      positions[i * 3 + 1] = dot(d, frame.up) + OBSERVER_HEIGHT_M
      positions[i * 3 + 2] = sz[i]
    }
  }
  const { coef: cx, coefZ: cz, maxResidual } = affineFit(size, sx, sz)
  return { size, spacingM: spacing, affine: [...cx, ...cz], maxResidualM: maxResidual, positions }
}

// Least-squares fit scene x,z = a*col + b*row + c on a regular grid (closed form
// using the grid's symmetry: col and row are uncorrelated and have the same variance).
function affineFit(size: number, sx: Float64Array, sz: Float64Array) {
  const n = size * size
  const m = (size - 1) / 2 // mean of col and of row
  let varc = 0
  for (let c = 0; c < size; c++) varc += (c - m) * (c - m)
  varc *= size // sum over all nodes of (col - m)^2 (same for row)
  const fit = (v: Float64Array): [number, number, number] => {
    let mean = 0
    for (let i = 0; i < n; i++) mean += v[i]
    mean /= n
    let a = 0
    let b = 0
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        const dv = v[r * size + c] - mean
        a += (c - m) * dv
        b += (r - m) * dv
      }
    a /= varc
    b /= varc
    return [a, b, mean - a * m - b * m]
  }
  const coef = fit(sx)
  const coefZ = fit(sz)
  let maxResidual = 0
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const i = r * size + c
      const ex = coef[0] * c + coef[1] * r + coef[2] - sx[i]
      const ez = coefZ[0] * c + coefZ[1] * r + coefZ[2] - sz[i]
      maxResidual = Math.max(maxResidual, Math.hypot(ex, ez))
    }
  return { coef, coefZ, maxResidual }
}
