import type { SiteLight } from '../data/loadSiteData'
import { computeStay } from './stay'
import { indexForTime } from './timeSelection'

// Screening of the curated sites against the user's requirements. Green means
// "meets your requirements (screening only)", never "safe": rocks, small
// craters and dust are not in the data.

export type Criteria = {
  sun: { on: boolean; minPercent: number }
  earth: { on: boolean; minPercent: number }
  slope: { on: boolean; maxDeg: number }
}

export const DEFAULT_CRITERIA: Criteria = {
  // NASA Artemis HLS update 2024 (team plan): Sun for the whole stay.
  sun: { on: true, minPercent: 100 },
  // Team plan default; its NASA origin is not verified yet.
  earth: { on: true, minPercent: 25 },
  // NASA Artemis HLS update 2024 (team plan): landing slope below 10° (~100 m scale).
  slope: { on: true, maxDeg: 10 },
}

export type SiteSlope = { slopeDeg: number; baselineM: number }

export type SiteResult = {
  siteId: string
  sunPercent: number
  earthPercent: number
  slope: SiteSlope | null
  passes: { sun: boolean; earth: boolean; slope: boolean }
  meets: boolean
}

export function evaluateSite(
  siteId: string,
  light: SiteLight,
  slope: SiteSlope | null,
  criteria: Criteria,
  timeMs: number | null,
  stayDays: number,
): SiteResult {
  const samples = light.sky.samples
  const stay = computeStay(samples, light.horizon, indexForTime(samples, timeMs), stayDays)
  const passes = {
    sun: !criteria.sun.on || stay.sunPercent >= criteria.sun.minPercent,
    earth: !criteria.earth.on || stay.earthPercent >= criteria.earth.minPercent,
    // No slope value = cannot pass a slope requirement.
    slope: !criteria.slope.on || (slope !== null && slope.slopeDeg <= criteria.slope.maxDeg),
  }
  return {
    siteId,
    sunPercent: stay.sunPercent,
    earthPercent: stay.earthPercent,
    slope,
    passes,
    meets: passes.sun && passes.earth && passes.slope,
  }
}

let slopesPromise: Promise<Record<string, SiteSlope>> | null = null

// public/data/site_slopes.json, written by scripts/site_slopes.py.
export function loadSiteSlopes(): Promise<Record<string, SiteSlope>> {
  if (!slopesPromise) {
    slopesPromise = fetch('/data/site_slopes.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load site_slopes.json (${response.status})`)
        return response.json() as Promise<{ sites: Record<string, SiteSlope> }>
      })
      .then((json) => json.sites)
    slopesPromise.catch(() => {
      slopesPromise = null
    })
  }
  return slopesPromise
}
