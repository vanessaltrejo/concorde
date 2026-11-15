// Small part of the app state kept in the address bar so a link reopens the
// same screen: ?view=orbital|horizon|dashboard&site=<id>&t=2026-11-17T00:00Z&stay=6.5

import { DEFAULT_STAY_DAYS, MAX_STAY_DAYS, MIN_STAY_DAYS } from '../scene/stay'

export type View = 'orbital' | 'horizon' | 'dashboard'

export type UrlState = {
  view: View | null
  siteId: string | null
  timeMs: number | null
  stayDays: number | null
}

const VIEWS: View[] = ['orbital', 'horizon', 'dashboard']

export function readUrlState(knownSiteIds: string[]): UrlState {
  try {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')
    const site = params.get('site')
    const t = params.get('t')
    const stay = Number(params.get('stay'))
    const parsed = t ? Date.parse(t) : NaN
    return {
      view: VIEWS.find((v) => v === view) ?? null,
      siteId: site !== null && knownSiteIds.includes(site) ? site : null,
      timeMs: Number.isNaN(parsed) ? null : parsed,
      stayDays: params.has('stay') && stay >= MIN_STAY_DAYS && stay <= MAX_STAY_DAYS ? stay : null,
    }
  } catch {
    return { view: null, siteId: null, timeMs: null, stayDays: null }
  }
}

export function writeUrlState(state: { view: View; siteId: string | null; timeMs: number | null; stayDays: number }): void {
  try {
    const params = new URLSearchParams()
    params.set('view', state.view)
    if (state.siteId) params.set('site', state.siteId)
    // Minute precision, UTC ("2026-11-17T00:00Z").
    if (state.timeMs !== null) params.set('t', `${new Date(state.timeMs).toISOString().slice(0, 16)}Z`)
    if (state.stayDays !== DEFAULT_STAY_DAYS) params.set('stay', String(state.stayDays))
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  } catch {
    // The address bar is a convenience; the app works without it.
  }
}
