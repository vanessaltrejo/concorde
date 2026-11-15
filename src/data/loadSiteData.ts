import type {
  HorizonProfile,
  SiteData,
  SkyBodyState,
  SkyData,
  SkySample,
  TerrainData,
  TerrainGrid,
} from '../types'

// Thin data layer: reads the static files made by the scripts in /scripts.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSkyBodyState(value: unknown): value is SkyBodyState {
  return (
    isRecord(value) &&
    isNumber(value.azimuthDeg) &&
    isNumber(value.elevationDeg) &&
    isNumber(value.angularDiameterDeg) &&
    isNumber(value.raDeg) &&
    isNumber(value.decDeg)
  )
}

function isSkySample(value: unknown): value is SkySample {
  return (
    isRecord(value) &&
    typeof value.timeUtc === 'string' &&
    isSkyBodyState(value.sun) &&
    isSkyBodyState(value.earth) &&
    isNumber(value.earthIlluminatedPct) &&
    isNumber(value.earthSubObserverLonDeg) &&
    isNumber(value.earthSubObserverLatDeg)
  )
}

function isSkyData(value: unknown): value is SkyData {
  return (
    isRecord(value) &&
    isRecord(value.site) &&
    isRecord(value.provenance) &&
    Array.isArray(value.samples) &&
    value.samples.length > 0 &&
    value.samples.every(isSkySample)
  )
}

function isHorizonProfile(value: unknown): value is HorizonProfile {
  return (
    isRecord(value) &&
    typeof value.siteId === 'string' &&
    isNumber(value.azimuthStepDeg) &&
    Array.isArray(value.elevationDeg) &&
    value.elevationDeg.length === Math.round(360 / value.azimuthStepDeg) &&
    value.elevationDeg.every(isNumber)
  )
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
  return response.json()
}

async function loadSky(siteId: string): Promise<SkyData> {
  const json = await fetchJson(`/data/${siteId}/sky.json`)
  if (!isSkyData(json)) throw new Error(`sky.json for ${siteId} has an unexpected shape`)
  return json
}

async function loadHorizon(siteId: string): Promise<HorizonProfile> {
  const json = await fetchJson(`/data/${siteId}/horizon.json`)
  if (!isHorizonProfile(json)) throw new Error(`horizon.json for ${siteId} has an unexpected shape`)
  return json
}

type GridMeta = {
  size: number
  spacingM: number
  affine: TerrainGrid['affine']
  file: string
}

function isGridMeta(value: unknown): value is GridMeta {
  return (
    isRecord(value) &&
    isNumber(value.size) &&
    isNumber(value.spacingM) &&
    typeof value.file === 'string' &&
    Array.isArray(value.affine) &&
    value.affine.length === 6 &&
    value.affine.every(isNumber)
  )
}

async function loadGrid(siteId: string, meta: GridMeta): Promise<TerrainGrid> {
  const response = await fetch(`/data/${siteId}/${meta.file}`)
  if (!response.ok) throw new Error(`Could not load ${meta.file} for ${siteId} (${response.status})`)
  const positions = new Float32Array(await response.arrayBuffer())
  if (positions.length !== meta.size * meta.size * 3) {
    throw new Error(`${meta.file} for ${siteId} does not match grid size ${meta.size}`)
  }
  return { size: meta.size, spacingM: meta.spacingM, affine: meta.affine, positions }
}

async function loadTerrain(siteId: string): Promise<TerrainData> {
  const meta = await fetchJson(`/data/${siteId}/terrain.json`)
  if (
    !isRecord(meta) ||
    !isRecord(meta.grids) ||
    !isGridMeta(meta.grids.near) ||
    !isGridMeta(meta.grids.mid) ||
    !isGridMeta(meta.grids.far)
  ) {
    throw new Error(`terrain.json for ${siteId} has an unexpected shape`)
  }
  const [near, mid, far] = await Promise.all([
    loadGrid(siteId, meta.grids.near),
    loadGrid(siteId, meta.grids.mid),
    loadGrid(siteId, meta.grids.far),
  ])
  const provenance = isRecord(meta.provenance) ? meta.provenance : {}
  const source = typeof provenance.source === 'string' ? provenance.source : 'LOLA (source not recorded)'
  return { source, near, mid, far }
}

export async function loadSiteData(siteId: string): Promise<SiteData> {
  const [sky, horizon, terrain] = await Promise.all([
    loadSky(siteId),
    loadHorizon(siteId),
    loadTerrain(siteId),
  ])
  return { sky, horizon, terrain }
}

// Light version for previews: only the Sun/Earth positions and the horizon
// (about 0.4 MB), not the 19 MB of terrain. Cached, because the Orbital view asks
// for it every time a site is selected.
export type SiteLight = { sky: SkyData; horizon: HorizonProfile }

const lightCache = new Map<string, Promise<SiteLight>>()

export function loadSiteLight(siteId: string): Promise<SiteLight> {
  let cached = lightCache.get(siteId)
  if (!cached) {
    cached = Promise.all([loadSky(siteId), loadHorizon(siteId)]).then(([sky, horizon]) => ({ sky, horizon }))
    // A failed load must not stay cached, so a later click can try again.
    cached.catch(() => lightCache.delete(siteId))
    lightCache.set(siteId, cached)
  }
  return cached
}
