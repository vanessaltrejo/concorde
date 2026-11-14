import type { HorizonProfile, SiteData, SkyBodyState, SkyData, SkySample, TerrainGrid } from '../types'

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
    isNumber(value.angularDiameterDeg)
  )
}

function isSkySample(value: unknown): value is SkySample {
  return (
    isRecord(value) &&
    typeof value.timeUtc === 'string' &&
    isSkyBodyState(value.sun) &&
    isSkyBodyState(value.earth) &&
    isNumber(value.earthIlluminatedPct)
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

async function loadTerrain(siteId: string): Promise<TerrainGrid> {
  const meta = await fetchJson(`/data/${siteId}/terrain.json`)
  if (!isRecord(meta) || !isNumber(meta.gridSize) || !isNumber(meta.spacingM)) {
    throw new Error(`terrain.json for ${siteId} has an unexpected shape`)
  }
  const response = await fetch(`/data/${siteId}/terrain.bin`)
  if (!response.ok) throw new Error(`Could not load terrain.bin for ${siteId} (${response.status})`)
  const vertices = new Float32Array(await response.arrayBuffer())
  if (vertices.length !== meta.gridSize * meta.gridSize * 3) {
    throw new Error(`terrain.bin for ${siteId} does not match gridSize ${meta.gridSize}`)
  }
  return { gridSize: meta.gridSize, spacingM: meta.spacingM, vertices }
}

export async function loadSiteData(siteId: string): Promise<SiteData> {
  const [sky, horizon, terrain] = await Promise.all([
    loadSky(siteId),
    loadHorizon(siteId),
    loadTerrain(siteId),
  ])
  return { sky, horizon, terrain }
}
