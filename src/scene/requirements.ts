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

// Where a cell that meets the requirements sits between the user's Sun limit (0)
// and Sun during the whole stay (1). With the Sun limit at 100 % every green
// cell has 1, so there is no gradient; the lower the limit, the wider the range.
export function sunStrength(sunPercent: number, criteria: Criteria): number {
  const min = criteria.sun.on ? criteria.sun.minPercent : 0
  if (min >= 100) return 1
  return Math.min(Math.max((sunPercent - min) / (100 - min), 0), 1)
}

// Colour of a cell that meets the requirements: Okabe-Ito bluish green when the
// Sun is up the whole stay, shading to Okabe-Ito yellow at the user's Sun limit.
// Both colours stay apart from the gray "excluded" cells for colour-blind viewers.
export const GREEN_FULL = '#009E73'
export const GREEN_WEAK = '#F0E442'
const FULL_RGB = [0x00, 0x9e, 0x73]
const WEAK_RGB = [0xf0, 0xe4, 0x42]
// Opacity also falls towards yellow, so the Moon surface stays visible there.
export const GREEN_ALPHA_FULL = 0.6
export const GREEN_ALPHA_WEAK = 0.25

// [r, g, b] 0..255 and alpha 0..1.
export function greenRgba(sunPercent: number, criteria: Criteria): [number, number, number, number] {
  const t = sunStrength(sunPercent, criteria)
  const mix = (i: number) => Math.round(WEAK_RGB[i] + (FULL_RGB[i] - WEAK_RGB[i]) * t)
  return [mix(0), mix(1), mix(2), GREEN_ALPHA_WEAK + (GREEN_ALPHA_FULL - GREEN_ALPHA_WEAK) * t]
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
