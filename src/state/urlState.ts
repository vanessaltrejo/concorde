// Small part of the app state kept in the address bar so a link reopens the
// same screen: ?view=orbital|horizon|dashboard&site=<id>&t=2026-11-17T00:00Z&stay=6.5
// A Horizon view of a point picked on the map adds &pt=<lat>,<lon east>.

import { DEFAULT_STAY_DAYS, MAX_STAY_DAYS, MIN_STAY_DAYS } from '../scene/stay'

export type View = 'orbital' | 'horizon' | 'dashboard' | 'compare'

type UrlState = {
  view: View | null
  siteId: string | null
  timeMs: number | null
  stayDays: number | null
  point: { latDeg: number; lonDeg: number } | null
}

const VIEWS: View[] = ['orbital', 'horizon', 'dashboard', 'compare']

export function readUrlState(knownSiteIds: string[]): UrlState {
  try {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')
    const site = params.get('site')
    const t = params.get('t')
    const stay = Number(params.get('stay'))
    const parsed = t ? Date.parse(t) : NaN
    const pt = (params.get('pt') ?? '').split(',').map(Number)
    const point =
      pt.length === 2 && pt.every(Number.isFinite) && Math.abs(pt[0]) <= 90 && pt[1] >= 0 && pt[1] < 360
        ? { latDeg: pt[0], lonDeg: pt[1] }
        : null
    return {
      view: VIEWS.find((v) => v === view) ?? null,
      siteId: site !== null && knownSiteIds.includes(site) ? site : null,
      timeMs: Number.isNaN(parsed) ? null : parsed,
      stayDays: params.has('stay') && stay >= MIN_STAY_DAYS && stay <= MAX_STAY_DAYS ? stay : null,
      point,
    }
  } catch {
    return { view: null, siteId: null, timeMs: null, stayDays: null, point: null }
  }
}

export function writeUrlState(
  state: {
    view: View
    siteId: string | null
    timeMs: number | null
    stayDays: number
    point?: { latDeg: number; lonDeg: number } | null
  } | null,
  compare: string | null = null,
): void {
  try {
    if (state === null && compare === null) {
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
    if (state === null) return writeUrlState({ view: 'orbital', siteId: null, timeMs: null, stayDays: DEFAULT_STAY_DAYS }, compare)
    const params = new URLSearchParams()
    params.set('view', state.view)
    if (state.siteId) params.set('site', state.siteId)
    // Minute precision, UTC ("2026-11-17T00:00Z").
    if (state.timeMs !== null) params.set('t', `${new Date(state.timeMs).toISOString().slice(0, 16)}Z`)
    if (state.stayDays !== DEFAULT_STAY_DAYS) params.set('stay', String(state.stayDays))
    if (state.point) params.set('pt', `${state.point.latDeg.toFixed(4)},${state.point.lonDeg.toFixed(4)}`)
    if (compare) params.set('cmp', compare)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  } catch {
    // The address bar is a convenience; the app works without it.
  }
}
