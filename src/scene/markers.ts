import type { SiteEntry } from '../data/sites'

// Which site markers the Orbital view shows (Layers panel > Markers).

export type MarkerFilter = { study: boolean; historic: boolean; future: boolean; pins: boolean }

export const DEFAULT_MARKER_FILTER: MarkerFilter = { study: true, historic: true, future: true, pins: true }

// Which marker groups a site belongs to. A site with both a past and a planned
// mission (e.g. Mons Mouton) counts as both.
export function siteCategories(site: SiteEntry): { study: boolean; historic: boolean; future: boolean } {
  const missions = site.missions ?? []
  return {
    study: site.group === 'South pole',
    historic: site.group === 'Apollo landing sites' || missions.some((m) => m.status === 'Completed'),
    future: missions.some((m) => m.status === 'Scheduled'),
  }
}

export function siteVisible(site: SiteEntry, filter: MarkerFilter): boolean {
  const c = siteCategories(site)
  return (c.study && filter.study) || (c.historic && filter.historic) || (c.future && filter.future)
}
