import { useSyncExternalStore } from 'react'

// Tiny router for the three top-level screens:
//   /        launcher (video hero)
//   /home    projects home (saved places, Explore the Moon)
//   other    the tool itself (App: /dashboard, /orbital-view, ...)

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') window.addEventListener('popstate', notify)

export function usePath(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => window.location.pathname.replace(/\/+$/, '') || '/',
  )
}

export function navigate(to: string): void {
  window.history.pushState(null, '', to)
  window.scrollTo(0, 0)
  notify()
}
