import type { SkyBodyState, SkyData, SkySample } from '../types'

// Thin data layer: reads the static file made by scripts/fetch_horizons.py.

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSkyBodyState(value: unknown): value is SkyBodyState {
  if (typeof value !== 'object' || value === null) return false
  const body = value as Record<string, unknown>
  return isNumber(body.azimuthDeg) && isNumber(body.elevationDeg) && isNumber(body.angularDiameterDeg)
}

function isSkySample(value: unknown): value is SkySample {
  if (typeof value !== 'object' || value === null) return false
  const sample = value as Record<string, unknown>
  return (
    typeof sample.timeUtc === 'string' &&
    isSkyBodyState(sample.sun) &&
    isSkyBodyState(sample.earth) &&
    isNumber(sample.earthIlluminatedPct)
  )
}

function isSkyData(value: unknown): value is SkyData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  return (
    typeof data.site === 'object' &&
    data.site !== null &&
    typeof data.provenance === 'object' &&
    data.provenance !== null &&
    Array.isArray(data.samples) &&
    data.samples.length > 0 &&
    data.samples.every(isSkySample)
  )
}

export async function loadSkyData(siteId: string): Promise<SkyData> {
  const response = await fetch(`/data/${siteId}/sky.json`)
  if (!response.ok) throw new Error(`Could not load sky data for ${siteId} (${response.status})`)
  const json: unknown = await response.json()
  if (!isSkyData(json)) throw new Error(`Sky data for ${siteId} has an unexpected shape`)
  return json
}
