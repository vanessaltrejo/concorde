import type { SiteLight } from '../data/loadSiteData'
import { computeStay } from './stay'
import { evaluateSite, DEFAULT_CRITERIA, type SiteSlope } from './requirements'
import { indexForTime } from './timeSelection'
import { buildTimeline } from './windows'

// Compare tab: five measurable axes per scenario (site + arrival date + stay),
// and a transparent weighted score for a chosen goal. Screening only, not flight
// grade: no rocks, small craters, dust or thermal model.
// TODO (review with the stronger model): the normalisation caps and the goal
// weights below are first proposals, not validated mission numbers.

const HOUR_MS = 60 * 60 * 1000

export type AxisKey = 'sun' | 'continuity' | 'elevation' | 'earth' | 'flatness'

export const AXES: { key: AxisKey; label: string; short: string }[] = [
  { key: 'sun', label: 'Time with Sun', short: 'Sun' },
  { key: 'continuity', label: 'Sun continuity (shortest dark gap)', short: 'Continuity' },
  { key: 'elevation', label: 'Sun height (mean while visible)', short: 'Sun height' },
  { key: 'earth', label: 'Time with Earth link', short: 'Earth' },
  { key: 'flatness', label: 'Flatness (slope at ~100 m)', short: 'Flatness' },
]

export type Metrics = {
  sunPercent: number
  earthPercent: number
  longestDarkHours: number
  meanSunElevationDeg: number | null
  slopeDeg: number | null
  coveredDays: number
  truncated: boolean
  meetsDefaults: boolean
  // 0 to 100 per axis; null = no data for that axis.
  axes: Record<AxisKey, number | null>
}

const clamp = (v: number) => Math.max(0, Math.min(100, v))

export function computeMetrics(
  siteId: string,
  light: SiteLight,
  slope: SiteSlope | null,
  timeMs: number | null,
  stayDays: number,
): Metrics {
  const samples = light.sky.samples
  const start = indexForTime(samples, timeMs)
  const stay = computeStay(samples, light.horizon, start, stayDays)
  const sun = buildTimeline(samples, light.horizon, 'sun')
  const stepMs = sun.timesMs[1] - sun.timesMs[0]
  const end = Math.min(start + Math.max(1, Math.round((stayDays * 24 * HOUR_MS) / stepMs)), samples.length)

  let longestRun = 0
  let run = 0
  let elevSum = 0
  let elevN = 0
  for (let i = start; i < end; i++) {
    if (sun.marginsDeg[i] > 0) {
      run = 0
      elevSum += samples[i].sun.elevationDeg
      elevN += 1
    } else {
      run += 1
      longestRun = Math.max(longestRun, run)
    }
  }
  const longestDarkHours = (longestRun * stepMs) / HOUR_MS
  const meanSunElevationDeg = elevN ? elevSum / elevN : null
  const stayHours = ((end - start) * stepMs) / HOUR_MS

  const axes: Record<AxisKey, number | null> = {
    sun: clamp(stay.sunPercent),
    continuity: clamp(100 * (1 - longestDarkHours / Math.max(stayHours, 1))),
    // 30 degrees counts as full marks: above that, extra height adds little for this screening.
    elevation: meanSunElevationDeg === null ? 0 : clamp((meanSunElevationDeg / 30) * 100),
    earth: clamp(stay.earthPercent),
    // 10 degrees is the NASA HLS landing-slope limit used by the Requirements panel.
    flatness: slope ? clamp(100 * (1 - slope.slopeDeg / 10)) : null,
  }
  return {
    sunPercent: stay.sunPercent,
    earthPercent: stay.earthPercent,
    longestDarkHours,
    meanSunElevationDeg,
    slopeDeg: slope ? slope.slopeDeg : null,
    coveredDays: stay.coveredDays,
    truncated: stay.truncated,
    meetsDefaults: evaluateSite(siteId, light, slope, DEFAULT_CRITERIA, timeMs, stayDays).meets,
    axes,
  }
}

export type GoalId = 'power' | 'comms' | 'safe' | 'balanced'

export const GOALS: { id: GoalId; label: string; blurb: string; weights: Record<AxisKey, number> }[] = [
  { id: 'power', label: 'Power', blurb: 'Solar arrays: lots of Sun, few long dark gaps.', weights: { sun: 0.45, continuity: 0.35, elevation: 0.1, earth: 0, flatness: 0.1 } },
  { id: 'comms', label: 'Communications', blurb: 'Direct-to-Earth link as much of the stay as possible.', weights: { sun: 0.1, continuity: 0, elevation: 0, earth: 0.8, flatness: 0.1 } },
  { id: 'safe', label: 'Safe landing', blurb: 'Gentle slope first, then light and link.', weights: { sun: 0.2, continuity: 0.1, elevation: 0, earth: 0.2, flatness: 0.5 } },
  { id: 'balanced', label: 'Balanced', blurb: 'Every axis counts about the same.', weights: { sun: 0.2, continuity: 0.2, elevation: 0.1, earth: 0.3, flatness: 0.2 } },
]

// Weighted mean over the axes that have data (weights renormalised).
export function scoreFor(metrics: Metrics, weights: Record<AxisKey, number>): number {
  let total = 0
  let wSum = 0
  for (const { key } of AXES) {
    const v = metrics.axes[key]
    if (v === null) continue
    total += weights[key] * v
    wSum += weights[key]
  }
  return wSum ? total / wSum : 0
}

// The axes where the winner leads the runner-up the most, weighted by the goal.
export function whyWinner(winner: Metrics, runnerUp: Metrics | null, weights: Record<AxisKey, number>): AxisKey[] {
  if (!runnerUp) return []
  return AXES.map(({ key }) => ({
    key,
    gain: weights[key] * ((winner.axes[key] ?? 0) - (runnerUp.axes[key] ?? 0)),
  }))
    .filter((a) => a.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 2)
    .map((a) => a.key)
}
