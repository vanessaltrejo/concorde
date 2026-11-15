// Terrain tiles made by scripts/build_chunks.py, served by the gatekeeper
// Worker (workers/terrain-gatekeeper). This file knows the tile format and the
// two map projections; it computes nothing about the sky.
//
// A "layer" is one source at one resolution (global-118m, south-20m, ...).
// Map coordinates (x, y) are meters in the layer's projection. Pixel (row, col)
// centers sit at x = originX + (col + 0.5) * pixelSizeM,
// y = originY - (row + 0.5) * pixelSizeM (y grows north / up).

export const MOON_RADIUS_M = 1_737_400
const DEG = Math.PI / 180

export type LayerMeta = {
  id: string
  source: string
  sourceUrl: string
  crsWkt: string
  pixelSizeM: number
  originX: number
  originY: number
  width: number
  height: number
  tileSize: number
  rows: number
  cols: number
  dtype: 'int16' | 'float32'
  scale: number
  nodata: number | 'nan'
  encoding: string
  overviewFactor: number
  missing: string[]
}

export type Manifest = { version: number; createdUtc: string; test?: boolean; layers: LayerMeta[] }

// ---------- projections (sphere, radius MOON_RADIUS_M; exact closed forms) ----------

export type Projection = {
  kind: 'south-polar-stereographic' | 'equirectangular'
  toMap: (lonDeg: number, latDeg: number) => [number, number]
  toGeo: (x: number, y: number) => [number, number] // [lonDeg, latDeg]
}

// South polar stereographic, latitude of origin -90, central meridian 0,
// scale 1 at the pole (as in the LDEM_80S file: PROJ "+proj=stere +lat_0=-90").
// Checked against pyproj at Shackleton rim in scripts (see HORIZON_ANYWHERE_PLAN.md).
const southPolar: Projection = {
  kind: 'south-polar-stereographic',
  toMap(lonDeg, latDeg) {
    const lon = lonDeg * DEG
    const lat = latDeg * DEG
    const rho = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + lat / 2)
    return [rho * Math.sin(lon), rho * Math.cos(lon)]
  },
  toGeo(x, y) {
    const rho = Math.hypot(x, y)
    const lat = 2 * Math.atan(rho / (2 * MOON_RADIUS_M)) - Math.PI / 2
    const lon = rho === 0 ? 0 : Math.atan2(x, y)
    return [lon / DEG, lat / DEG]
  },
}

// Equirectangular with standard parallel 0: x = R * lon, y = R * lat.
const equirect: Projection = {
  kind: 'equirectangular',
  toMap(lonDeg, latDeg) {
    let lon = lonDeg
    if (lon > 180) lon -= 360 // the file spans -180..180
    return [MOON_RADIUS_M * lon * DEG, MOON_RADIUS_M * latDeg * DEG]
  },
  toGeo(x, y) {
    return [x / MOON_RADIUS_M / DEG, y / MOON_RADIUS_M / DEG]
  },
}

export function projectionOf(layer: LayerMeta): Projection {
  if (layer.crsWkt.includes('Polar_Stereographic')) {
    if (!layer.crsWkt.includes('"latitude_of_origin",-90')) throw new Error(`${layer.id}: unsupported polar projection`)
    return southPolar
  }
  if (layer.crsWkt.includes('Equirectangular')) return equirect
  throw new Error(`${layer.id}: unknown projection`)
}

// ---------- tile decoding (mirrors build_chunks.py exactly) ----------

async function inflate(data: ArrayBuffer): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// int16 "delta-row": value = left neighbour + stored delta (uint16 wrap).
export async function decodeInt16(data: ArrayBuffer, n: number): Promise<Int16Array> {
  const bytes = await inflate(data)
  const d = new Uint16Array(bytes.buffer, bytes.byteOffset, n * n) // little-endian platform assumed (all browsers)
  const out = new Uint16Array(n * n)
  for (let r = 0; r < n; r++) {
    let acc = 0
    const base = r * n
    for (let c = 0; c < n; c++) {
      acc = (acc + d[base + c]) & 0xffff
      out[base + c] = acc
    }
  }
  return new Int16Array(out.buffer)
}

// float32 "shuffle-delta-row": 4 byte planes, each row-delta coded (uint8 wrap).
export async function decodeFloat32(data: ArrayBuffer, n: number): Promise<Float32Array> {
  const bytes = await inflate(data)
  const count = n * n
  const out = new Uint8Array(count * 4)
  for (let plane = 0; plane < 4; plane++) {
    for (let r = 0; r < n; r++) {
      let acc = 0
      const base = plane * count + r * n
      for (let c = 0; c < n; c++) {
        acc = (acc + bytes[base + c]) & 0xff
        out[(r * n + c) * 4 + plane] = acc
      }
    }
  }
  return new Float32Array(out.buffer)
}

// ---------- a tiled layer with on-demand loading ----------

export type Tile = Float32Array // heights in meters, NaN = no data, tileSize x tileSize

export class TileLayer {
  readonly meta: LayerMeta
  readonly proj: Projection
  private readonly missing: Set<string>
  private readonly cache = new Map<string, Promise<Tile | null>>()
  private readonly baseUrl: string
  private readonly fetchTile: (url: string) => Promise<ArrayBuffer | null>

  constructor(meta: LayerMeta, baseUrl: string, fetchTile: (url: string) => Promise<ArrayBuffer | null>) {
    this.meta = meta
    this.proj = projectionOf(meta)
    this.missing = new Set(meta.missing)
    this.baseUrl = baseUrl
    this.fetchTile = fetchTile
  }

  // Map x,y -> fractional pixel coordinates (col, row) of pixel centers.
  pixelOf(x: number, y: number): [number, number] {
    const s = this.meta.pixelSizeM
    return [(x - this.meta.originX) / s - 0.5, (this.meta.originY - y) / s - 0.5]
  }

  mapOfPixel(col: number, row: number): [number, number] {
    const s = this.meta.pixelSizeM
    return [this.meta.originX + (col + 0.5) * s, this.meta.originY - (row + 0.5) * s]
  }

  tile(tr: number, tc: number): Promise<Tile | null> {
    if (tr < 0 || tc < 0 || tr >= this.meta.rows || tc >= this.meta.cols || this.missing.has(`${tr},${tc}`)) {
      return Promise.resolve(null)
    }
    const key = `${tr},${tc}`
    let p = this.cache.get(key)
    if (!p) {
      p = this.load(tr, tc)
      p.catch(() => this.cache.delete(key))
      this.cache.set(key, p)
    }
    return p
  }

  private async load(tr: number, tc: number): Promise<Tile | null> {
    const n = this.meta.tileSize
    const data = await this.fetchTile(`${this.baseUrl}/${this.meta.id}/${tr}/${tc}.bin`)
    if (!data) return null
    if (this.meta.dtype === 'int16') {
      const raw = await decodeInt16(data, n)
      const out = new Float32Array(n * n)
      const nodata = this.meta.nodata as number
      for (let i = 0; i < raw.length; i++) out[i] = raw[i] === nodata ? NaN : raw[i] * this.meta.scale
      return out
    }
    const out = await decodeFloat32(data, n)
    if (this.meta.scale !== 1) for (let i = 0; i < out.length; i++) out[i] *= this.meta.scale
    return out
  }

  // Loads every tile touching the pixel box [r0, r1] x [c0, c1] (inclusive)
  // and returns a dense window with NaN where there is no data.
  async window(r0: number, c0: number, r1: number, c1: number): Promise<Window> {
    const n = this.meta.tileSize
    const rows = r1 - r0 + 1
    const cols = c1 - c0 + 1
    const data = new Float32Array(rows * cols).fill(NaN)
    const jobs: Promise<void>[] = []
    for (let tr = Math.floor(r0 / n); tr <= Math.floor(r1 / n); tr++) {
      for (let tc = Math.floor(c0 / n); tc <= Math.floor(c1 / n); tc++) {
        jobs.push(
          this.tile(tr, tc).then((tile) => {
            if (!tile) return
            const rStart = Math.max(r0, tr * n)
            const rEnd = Math.min(r1, tr * n + n - 1)
            const cStart = Math.max(c0, tc * n)
            const cEnd = Math.min(c1, tc * n + n - 1)
            for (let r = rStart; r <= rEnd; r++) {
              const src = (r - tr * n) * n + (cStart - tc * n)
              data.set(tile.subarray(src, src + cEnd - cStart + 1), (r - r0) * cols + (cStart - c0))
            }
          }),
        )
      }
    }
    await Promise.all(jobs)
    return { data, rows, cols, row0: r0, col0: c0, layer: this }
  }
}

// A dense height window in pixel space of one layer.
export type Window = { data: Float32Array; rows: number; cols: number; row0: number; col0: number; layer: TileLayer }

// Bilinear interpolation of pixel-center values at map (x, y). NaN outside or on nodata
// (same rule as `bilinear` in scripts/build_terrain.py).
export function sampleWindow(w: Window, x: number, y: number): number {
  const [col, row] = w.layer.pixelOf(x, y)
  const c0 = Math.floor(col) - w.col0
  const r0 = Math.floor(row) - w.row0
  if (c0 < 0 || r0 < 0 || c0 + 1 >= w.cols || r0 + 1 >= w.rows) return NaN
  const fc = col - Math.floor(col)
  const fr = row - Math.floor(row)
  const i = r0 * w.cols + c0
  const v00 = w.data[i]
  const v01 = w.data[i + 1]
  const v10 = w.data[i + w.cols]
  const v11 = w.data[i + w.cols + 1]
  return v00 * (1 - fc) * (1 - fr) + v01 * fc * (1 - fr) + v10 * (1 - fc) * fr + v11 * fc * fr
}

// Average factor x factor blocks (NaN ignored), like read_global_window(..., factor).
export function blockAverage(w: Window, factor: number): Window {
  const rows = Math.floor(w.rows / factor)
  const cols = Math.floor(w.cols / factor)
  const data = new Float32Array(rows * cols)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0
      let count = 0
      for (let dr = 0; dr < factor; dr++) {
        const base = (r * factor + dr) * w.cols + c * factor
        for (let dc = 0; dc < factor; dc++) {
          const v = w.data[base + dc]
          if (!Number.isNaN(v)) {
            sum += v
            count++
          }
        }
      }
      data[r * cols + c] = count ? sum / count : NaN
    }
  }
  // The averaged window is a coarser layer view: wrap it with scaled pixel geometry.
  const coarse = Object.create(w.layer) as TileLayer
  const meta = { ...w.layer.meta, pixelSizeM: w.layer.meta.pixelSizeM * factor }
  Object.defineProperty(coarse, 'meta', { value: meta })
  return { data, rows, cols, row0: w.row0 / factor, col0: w.col0 / factor, layer: coarse }
}
