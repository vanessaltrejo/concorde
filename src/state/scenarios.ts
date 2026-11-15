import { useSyncExternalStore } from 'react'
import { SITES } from '../data/sites'

// A scenario is one site at one arrival date. Flagged scenarios are compared on
// the Compare tab. The same site can appear twice with different dates (that is
// how "what if the launch slips" is checked). Kept in a tiny shared store so the
// flag buttons on every tab need no prop drilling, and mirrored in the URL as
// ?cmp=<siteId>@<2026-11-14T00:00Z>,...

export type Scenario = { id: string; siteId: string; timeMs: number | null }

export const MAX_SCENARIOS = 3
const DAY_MS = 24 * 60 * 60 * 1000

function formatTime(timeMs: number | null): string {
  return timeMs === null ? '' : `${new Date(timeMs).toISOString().slice(0, 16)}Z`
}

export function encodeScenarios(list: Scenario[]): string | null {
  return list.length ? list.map((s) => `${s.siteId}@${formatTime(s.timeMs)}`).join(',') : null
}

function decodeScenarios(text: string | null): Scenario[] {
  if (!text) return []
  const known = SITES.filter((s) => s.hasSkyData).map((s) => s.id)
  const out: Scenario[] = []
  text.split(',').forEach((part, i) => {
    const [siteId, t] = part.split('@')
    if (!known.includes(siteId) || out.length >= MAX_SCENARIOS) return
    const parsed = t ? Date.parse(t) : NaN
    out.push({ id: `s${i}`, siteId, timeMs: Number.isNaN(parsed) ? null : parsed })
  })
  return out
}

let counter = 100
let scenarios: Scenario[] = (() => {
  try {
    return decodeScenarios(new URLSearchParams(window.location.search).get('cmp'))
  } catch {
    return []
  }
})()
const listeners = new Set<() => void>()

function set(next: Scenario[]) {
  scenarios = next
  listeners.forEach((l) => l())
}

export function useScenarios(): Scenario[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => scenarios,
  )
}

export function isFlagged(list: Scenario[], siteId: string): boolean {
  return list.some((s) => s.siteId === siteId)
}

// Flag on: adds the site at the given date (if there is room). Flag off: removes every scenario of that site.
export function toggleFlag(siteId: string, timeMs: number | null): void {
  if (scenarios.some((s) => s.siteId === siteId)) set(scenarios.filter((s) => s.siteId !== siteId))
  else if (scenarios.length < MAX_SCENARIOS) set([...scenarios, { id: `s${counter++}`, siteId, timeMs }])
}

export function addScenario(siteId: string, timeMs: number | null): void {
  if (scenarios.length < MAX_SCENARIOS) set([...scenarios, { id: `s${counter++}`, siteId, timeMs }])
}

// Same site, one week later: the quick "what if it slips" scenario.
export function addDateVariant(source: Scenario, fallbackTimeMs: number): void {
  addScenario(source.siteId, (source.timeMs ?? fallbackTimeMs) + 7 * DAY_MS)
}

export function updateScenario(id: string, patch: Partial<Omit<Scenario, 'id'>>): void {
  set(scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)))
}

// Drag-and-drop ordering: the position in the list is the user's own ranking (1st, 2nd, 3rd).
export function moveScenario(id: string, toIndex: number): void {
  const from = scenarios.findIndex((s) => s.id === id)
  if (from < 0 || from === toIndex) return
  const next = [...scenarios]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, item)
  set(next)
}

export function setScenarioOrder(ids: string[]): void {
  const byId = new Map(scenarios.map((s) => [s.id, s]))
  set(ids.map((id) => byId.get(id)).filter((s): s is Scenario => !!s))
}

export function removeScenario(id: string): void {
  set(scenarios.filter((s) => s.id !== id))
}
