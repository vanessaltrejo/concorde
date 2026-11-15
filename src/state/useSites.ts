import { useSyncExternalStore } from 'react'
import { sitesSnapshot, subscribeSites } from '../data/sites'

// Re-renders the component when a point is saved or removed.
export function useSitesVersion(): number {
  return useSyncExternalStore(subscribeSites, sitesSnapshot)
}
