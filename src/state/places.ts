import { useSyncExternalStore } from 'react'

// Saved places = pins the user drops on the Moon. Shown as pins on the Orbital
// view and listed under "Saved places" in the left rail (rename, remove).
// Kept in this browser only (localStorage): a per-viewer convenience, so the
// app works the same when storage is blocked (the list just starts empty).

// updatedUtc: last edit (created or renamed). Older saved places may lack it;
// lastEdited() falls back to createdUtc.
export type Place = { id: string; name: string; latDeg: number; lonDeg: number; createdUtc: string; updatedUtc?: string }

export function lastEdited(p: Place): string {
  return p.updatedUtc ?? p.createdUtc
}

const KEY = 'concorde.savedPlaces.v1'

function load(): Place[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (p): p is Place =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Number.isFinite(p.latDeg) &&
        Number.isFinite(p.lonDeg),
    )
  } catch {
    return []
  }
}

let places: Place[] = load()
const listeners = new Set<() => void>()

function set(next: Place[]) {
  places = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the pins still work for this visit.
  }
  listeners.forEach((l) => l())
}

export function usePlaces(): Place[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => places,
  )
}

export function getPlaces(): Place[] {
  return places
}

export function addPlace(latDeg: number, lonDeg: number): Place {
  const place: Place = {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: `Pin ${places.length + 1}`,
    latDeg,
    lonDeg: ((lonDeg % 360) + 360) % 360,
    createdUtc: new Date().toISOString(),
    updatedUtc: new Date().toISOString(),
  }
  set([place, ...places])
  return place
}

export function renamePlace(id: string, name: string): void {
  const clean = name.trim().slice(0, 60)
  if (!clean) return
  set(places.map((p) => (p.id === id && p.name !== clean ? { ...p, name: clean, updatedUtc: new Date().toISOString() } : p)))
}

export function removePlace(id: string): void {
  set(places.filter((p) => p.id !== id))
}

export function formatCoords(latDeg: number, lonDeg: number): string {
  return `${Math.abs(latDeg).toFixed(3)}° ${latDeg < 0 ? 'S' : 'N'}, ${lonDeg.toFixed(3)}° E`
}
