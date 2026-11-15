// "Horizon view anywhere": turns a point picked on the globe into the same
// SiteData the Horizon view uses for curated sites.
//  - Terrain and horizon: the Web Worker (worker.ts -> engine.ts), from the
//    LOLA tiles behind the gatekeeper Worker. Same method as build_terrain.py
//    (validated at the 6 curated sites, docs/HORIZON_ANYWHERE_PLAN.md step 8).
//  - Sun and Earth: geometry from one Horizons table for the whole Moon
//    (public/data/ephemeris.json, zones.ts skyAtPoint), checked against the
//    per-site Horizons tables in src/terrain/validate.test.ts.
//  - Earth picture orientation only (RA/DEC, sub-observer point): taken from
//    Shackleton rim's Horizons table at the same hour. From any other point the
//    difference is parallax, at most about 0.3°; it never changes a number.
import { loadSiteLight } from '../data/loadSiteData'
import { loadEphemeris, skyAtPoint } from '../scene/zones'
import type { HorizonProfile, SiteData, SkyData, SkySample, TerrainGrid } from '../types'
import { POLAR_LAT_LIMIT_DEG } from './engine'
import type { WorkerMessage, WorkerRequest } from './worker'

export type AnywherePoint = { latDeg: number; lonDeg: number } // lon east, 0..360

export type AnywhereInfo = {
  terrain: string // "LOLA 20 m out to 200 km" / "LOLA 118 m out to 50 km"
  terrainSource: string
  tilesLoaded: number
  seconds: number
}

export type AnywhereSiteData = SiteData & { anywhere: AnywhereInfo }

// Public address of the tiles (the gatekeeper Worker). VITE_TERRAIN_URL can
// point elsewhere, e.g. "/terrain-local" to use local tiles in development.
export const TERRAIN_URL =
  (import.meta.env.VITE_TERRAIN_URL as string | undefined) || 'https://concorde-terrain.emiliano-bucam.workers.dev'

const REFERENCE_SITE = 'shackleton-rim'
// The global 118 m map is equirectangular: its east-west stretch (1/cos lat)
// makes the validated method too heavy and too distorted near the poles, and
// the 20 m polar file only serves the 200 km horizon south of 86°S.
const GLOBAL_LAT_LIMIT_DEG = 80

export type Coverage = { ok: true; kind: 'polar' | 'global'; label: string } | { ok: false; reason: string }

export function coverage(latDeg: number): Coverage {
  if (latDeg <= POLAR_LAT_LIMIT_DEG) return { ok: true, kind: 'polar', label: 'LOLA 20 m terrain out to 200 km' }
  if (Math.abs(latDeg) <= GLOBAL_LAT_LIMIT_DEG) return { ok: true, kind: 'global', label: 'LOLA 118 m terrain out to 50 km' }
  return {
    ok: false,
    reason:
      latDeg > 0
        ? 'Not available north of 80°N yet: the north pole needs its own polar terrain tiles.'
        : 'Not available between 80°S and 86°S yet: too far from the pole for the 20 m polar map, too close for the global map.',
  }
}

export function pointId(p: AnywherePoint): string {
  return `point:${p.latDeg.toFixed(4)},${p.lonDeg.toFixed(4)}`
}

export function pointName(p: AnywherePoint): string {
  return `Point ${p.latDeg.toFixed(4)}°, ${p.lonDeg.toFixed(2)}° E`
}

function computeTerrain(p: AnywherePoint, onProgress: (text: string) => void) {
  return new Promise<Extract<WorkerMessage, { type: 'done' }>['result']>((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const m = event.data
      if (m.type === 'progress') return onProgress(m.text)
      worker.terminate()
      if (m.type === 'done') resolve(m.result)
      else reject(new Error(m.message))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'The terrain worker failed'))
    }
    const request: WorkerRequest = { baseUrl: TERRAIN_URL, lonDeg: p.lonDeg, latDeg: p.latDeg }
    worker.postMessage(request)
  })
}

function grid(g: { size: number; spacingM: number; affine: TerrainGrid['affine']; positions: Float32Array }): TerrainGrid {
  return { size: g.size, spacingM: g.spacingM, affine: g.affine, positions: g.positions }
}

export async function loadAnywhereSite(p: AnywherePoint, onProgress: (text: string) => void): Promise<AnywhereSiteData> {
  const cover = coverage(p.latDeg)
  if (!cover.ok) throw new Error(cover.reason)
  const started = performance.now()
  const [terrain, ephemeris, reference] = await Promise.all([
    computeTerrain(p, onProgress),
    loadEphemeris(),
    loadSiteLight(REFERENCE_SITE),
  ])
  const refSamples = reference.sky.samples
  const samples: SkySample[] = ephemeris.rows.map((_, i) => {
    const ref = refSamples[i]
    const timeMs = ephemeris.startMs + i * ephemeris.stepMs
    if (!ref || Date.parse(ref.timeUtc) !== timeMs) throw new Error('The ephemeris and the reference table do not line up')
    const sky = skyAtPoint(ephemeris, i, p.lonDeg, p.latDeg)
    return {
      timeUtc: ref.timeUtc,
      sun: { ...sky.sun, raDeg: ref.sun.raDeg, decDeg: ref.sun.decDeg },
      earth: { ...sky.earth, raDeg: ref.earth.raDeg, decDeg: ref.earth.decDeg },
      earthIlluminatedPct: sky.earthIlluminatedPct,
      earthSubObserverLonDeg: ref.earthSubObserverLonDeg,
      earthSubObserverLatDeg: ref.earthSubObserverLatDeg,
    }
  })
  const id = pointId(p)
  const sky: SkyData = {
    site: {
      id,
      name: pointName(p),
      latitudeDeg: p.latDeg,
      longitudeDeg: p.lonDeg,
      source: 'Point picked on the Orbital view',
    },
    provenance: {
      source: 'Geometry from one NASA/JPL Horizons table for the whole Moon (public/data/ephemeris.json)',
      apiVersion: null,
      generatedUtc: new Date().toISOString(),
      observerAltitudeKm: 0,
      notes:
        "Sun and Earth computed for this point from the Moon-fixed positions of the Sun and Earth. Earth's picture orientation comes from Shackleton rim's Horizons table at the same hour (parallax up to about 0.3°, visual only).",
      queries: {},
    },
    samples,
  }
  const horizon: HorizonProfile = { siteId: id, azimuthStepDeg: 0.25, elevationDeg: Array.from(terrain.horizonDeg) }
  return {
    sky,
    horizon,
    terrain: { source: terrain.source, near: grid(terrain.near), mid: grid(terrain.mid), far: grid(terrain.far) },
    anywhere: {
      terrain: cover.label,
      terrainSource: terrain.source,
      tilesLoaded: terrain.tilesLoaded,
      seconds: (performance.now() - started) / 1000,
    },
  }
}

// Sky and horizon of a point, for the 2D preview and Compare. Cached by
// position, so a picked point that is then saved is not computed twice.
const lightCache = new Map<string, Promise<{ sky: SkyData; horizon: HorizonProfile }>>()

export function loadPointLight(p: AnywherePoint): Promise<{ sky: SkyData; horizon: HorizonProfile }> {
  const key = pointId(p)
  let cached = lightCache.get(key)
  if (!cached) {
    cached = loadAnywhereSite(p, () => {}).then(({ sky, horizon }) => ({ sky, horizon }))
    cached.catch(() => lightCache.delete(key))
    lightCache.set(key, cached)
  }
  return cached
}
