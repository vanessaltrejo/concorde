import type { SkySample } from '../types'

// The selected date and time is kept as milliseconds since 1970 (UTC) so the
// Orbital view and the Horizon view of any site share it. null = not chosen yet (first sample).

export function timeOfIndex(samples: SkySample[], index: number): number {
  return Date.parse(samples[index].timeUtc)
}

// Index of the sample closest to the chosen time (the data is hourly).
export function indexForTime(samples: SkySample[], timeMs: number | null): number {
  if (timeMs === null || samples.length < 2) return 0
  // The data is hourly and evenly spaced: compute the index instead of scanning
  // every sample, then check the neighbours in case the spacing is not exact.
  const first = Date.parse(samples[0].timeUtc)
  const step = Date.parse(samples[1].timeUtc) - first
  let best = Math.max(0, Math.min(samples.length - 1, Math.round((timeMs - first) / step)))
  for (const i of [best - 1, best + 1]) {
    if (i >= 0 && i < samples.length && Math.abs(Date.parse(samples[i].timeUtc) - timeMs) < Math.abs(Date.parse(samples[best].timeUtc) - timeMs)) best = i
  }
  return best
}
