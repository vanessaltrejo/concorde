import type { HorizonProfile, SkySample } from '../types'
import { buildTimeline, type BodyTimeline } from './windows'

// A stay starts at the selected date and time (the arrival) and lasts `stayDays`.
// The summary says how much of the stay the Sun and the Earth are visible,
// with the same rule as the rest of the app: some part of the disc above the
// terrain horizon (NASA PGDA rule for Earth).

export const DEFAULT_STAY_DAYS = 6.5 // early Artemis sites: about 6 to 6.5 days sunlit (NASA lunar site selection, 2023)
export const MIN_STAY_DAYS = 0.5
export const MAX_STAY_DAYS = 29.5 // one lunar day (the data covers 90 days)

const DAY_MS = 24 * 60 * 60 * 1000

export type StaySummary = {
  arrivalMs: number
  // Last moment covered by data (may be earlier than arrival + stay).
  coveredEndMs: number
  requestedDays: number
  coveredDays: number
  sunPercent: number
  earthPercent: number
  // True when the stay runs past the end of the data.
  truncated: boolean
}

function percentVisible(timeline: BodyTimeline, from: number, to: number): number {
  let visible = 0
  for (let i = from; i < to; i++) if (timeline.marginsDeg[i] > 0) visible += 1
  return (100 * visible) / (to - from)
}

// Samples counted: the half-open range [arrival, arrival + stay), one per hour.
export function computeStay(
  samples: SkySample[],
  horizon: HorizonProfile,
  arrivalIndex: number,
  stayDays: number,
): StaySummary {
  const sun = buildTimeline(samples, horizon, 'sun')
  const earth = buildTimeline(samples, horizon, 'earth')
  const stepMs = sun.timesMs[1] - sun.timesMs[0]
  const wanted = Math.max(1, Math.round((stayDays * DAY_MS) / stepMs))
  const end = Math.min(arrivalIndex + wanted, samples.length)
  const arrivalMs = sun.timesMs[arrivalIndex]
  const coveredEndMs = sun.timesMs[end - 1] + stepMs
  return {
    arrivalMs,
    coveredEndMs,
    requestedDays: stayDays,
    coveredDays: (coveredEndMs - arrivalMs) / DAY_MS,
    sunPercent: percentVisible(sun, arrivalIndex, end),
    earthPercent: percentVisible(earth, arrivalIndex, end),
    truncated: arrivalIndex + wanted > samples.length,
  }
}
