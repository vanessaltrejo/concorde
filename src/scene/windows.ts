import type { HorizonProfile, SkyBodyState, SkySample } from '../types'
import { horizonElevationAt } from './visibility'

export type SkyBodyKey = 'sun' | 'earth'

// How far the top edge of the disc is above the terrain horizon (degrees).
// > 0 means some part of the disc is visible (NASA PGDA rule for Earth).
function topEdgeMarginDeg(body: SkyBodyState, profile: HorizonProfile): number {
  return body.elevationDeg + body.angularDiameterDeg / 2 - horizonElevationAt(profile, body.azimuthDeg)
}

export type BodyTimeline = {
  timesMs: number[]
  marginsDeg: number[]
}

export function buildTimeline(samples: SkySample[], profile: HorizonProfile, key: SkyBodyKey): BodyTimeline {
  return {
    timesMs: samples.map((s) => Date.parse(s.timeUtc)),
    marginsDeg: samples.map((s) => topEdgeMarginDeg(s[key], profile)),
  }
}

export type NextTransition =
  | { found: true; kind: 'set' | 'rise'; timeMs: number; inMs: number }
  | { found: false; kind: 'set' | 'rise'; afterMs: number }

// Next moment the body sets (fully hidden) or rises (first part visible),
// starting from sample `index`. The crossing time is interpolated linearly
// between the two hourly samples around it.
export function nextTransition(timeline: BodyTimeline, index: number): NextTransition {
  const { timesMs, marginsDeg } = timeline
  const visibleNow = marginsDeg[index] > 0
  const kind = visibleNow ? 'set' : 'rise'
  const nowMs = timesMs[index]

  for (let j = index + 1; j < marginsDeg.length; j++) {
    if (marginsDeg[j] > 0 !== visibleNow) {
      const m0 = marginsDeg[j - 1]
      const m1 = marginsDeg[j]
      const t = m0 / (m0 - m1)
      const timeMs = timesMs[j - 1] + t * (timesMs[j] - timesMs[j - 1])
      return { found: true, kind, timeMs, inMs: timeMs - nowMs }
    }
  }
  return { found: false, kind, afterMs: timesMs[timesMs.length - 1] - nowMs }
}

// Percent of samples in the data period with some part of the disc visible.
export function visiblePercent(timeline: BodyTimeline): number {
  const visible = timeline.marginsDeg.filter((m) => m > 0).length
  return (100 * visible) / timeline.marginsDeg.length
}
