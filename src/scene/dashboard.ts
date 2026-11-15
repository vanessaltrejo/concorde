import type { SiteLight } from '../data/loadSiteData'
import { buildTimeline } from './windows'

// Share of each UTC day (24 hourly samples) with part of the Sun above the
// terrain horizon. Used by the 90-day heatmap.
export function dailySunPercent(light: SiteLight): number[] {
  const margins = buildTimeline(light.sky.samples, light.horizon, 'sun').marginsDeg
  const days = Math.floor(margins.length / 24)
  const out: number[] = []
  for (let d = 0; d < days; d++) {
    let lit = 0
    for (let i = d * 24; i < (d + 1) * 24; i++) if (margins[i] > 0) lit += 1
    out.push((100 * lit) / 24)
  }
  return out
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => (typeof c === 'string' && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : String(c))).join(','))
    .join('\n')
}
