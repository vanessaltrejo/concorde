import type { SkySample } from '../types'

// The selected date and time is kept as milliseconds since 1970 (UTC) so the
// Orbital view and the Horizon view of any site share it. null = not chosen yet (first sample).

export function timeOfIndex(samples: SkySample[], index: number): number {
  return Date.parse(samples[index].timeUtc)
}

// Index of the sample closest to the chosen time (the data is hourly).
export function indexForTime(samples: SkySample[], timeMs: number | null): number {
  if (timeMs === null) return 0
  let bestIndex = 0
  let bestDiff = Infinity
  samples.forEach((sample, i) => {
    const diff = Math.abs(Date.parse(sample.timeUtc) - timeMs)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = i
    }
  })
  return bestIndex
}
