// Small part of the app state kept in the address bar so a link reopens the
// screen: /dashboard, /orbital-view, /horizon-view, /compare, /educational, /references or /profile.
// Old links with ?view=&site=&t= still open on that state, then the address is cleaned.
// A Horizon view of a point picked on the map adds &pt=<lat>,<lon east>.

import { MAX_STAY_DAYS, MIN_STAY_DAYS } from '../scene/stay'

export type View = 'orbital' | 'horizon' | 'dashboard' | 'compare' | 'educational' | 'references' | 'profile'

type UrlState = {
  view: View | null
  siteId: string | null
  timeMs: number | null
  stayDays: number | null
  point: { latDeg: number; lonDeg: number } | null
}

const VIEWS: View[] = ['orbital', 'horizon', 'dashboard', 'compare', 'educational', 'references', 'profile']

const PATHS: Record<View, string> = {
  dashboard: '/dashboard',
  orbital: '/orbital-view',
  horizon: '/horizon-view',
  compare: '/compare',
  educational: '/educational',
  references: '/references',
  profile: '/profile',
}

export function readUrlState(knownSiteIds: string[]): UrlState {
  try {
    const params = new URLSearchParams(window.location.search)
    const fromPath = VIEWS.find((v) => PATHS[v] === window.location.pathname.replace(/\/+$/, ''))
    const view = fromPath ?? params.get('view')
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

// The address bar shows only the screen (/dashboard, /orbital-view, ...). Site,
// date, stay and comparison are never written to it. Old links that carry them
// are still read once on load (readUrlState) and then cleaned.
export function writeUrlState(state: { view: View } | null): void {
  try {
    window.history.replaceState(null, '', PATHS[state?.view ?? 'dashboard'])
  } catch {
    // The address bar is a convenience; the app works without it.
  }
}
