import { useEffect, useState, type ReactNode } from 'react'
import type { SiteLight } from '../data/loadSiteData'
import { indexForTime, timeOfIndex } from '../scene/timeSelection'
import { coverage, loadAnywhereLight } from '../terrain/anywhere'
import { DateTimeControl } from './DateTimeControl'
import { HorizonPreview } from './HorizonPreview'
import { StayPanel } from './StayPanel'
import { formatCoords, type Place } from '../state/places'

type PickedPointCardProps = {
  latDeg: number
  lonDeg: number
  timeMs: number | null
  onTimeChange: (timeMs: number) => void
  stayDays: number
  onStayDaysChange: (days: number) => void
  onClose: () => void
  onSave: () => void
  onOpenHorizon: () => void
  onCompare: () => void
  // Set when the point is a saved place: it can be renamed, compared and removed.
  place?: Place | null
  onRename: (name: string) => void
  onRemove: () => void
  // Requirement summary for the point, written by the map.
  children?: ReactNode
}

type LightState =
  | { key: string; status: 'ready'; light: SiteLight }
  | { key: string; status: 'error'; message: string }

// The whole right-hand panel for a point picked on the globe: the same
// information a registered site shows (date, stay, Sun and Earth, 2D horizon),
// a Save point button (the point becomes a site: marker, menu entry, Compare)
// and the way into the Horizon view. It replaces the site panel while the point
// is picked, so nothing is shown twice.
export function PickedPointCard({
  latDeg,
  lonDeg,
  timeMs,
  onTimeChange,
  stayDays,
  onStayDaysChange,
  onClose,
  onSave,
  onOpenHorizon,
  onCompare,
  place = null,
  onRename,
  onRemove,
  children,
}: PickedPointCardProps) {
  const cover = coverage(latDeg)
  const key = `${latDeg.toFixed(4)},${lonDeg.toFixed(4)}`
  const [state, setState] = useState<LightState | null>(null)

  // The horizon is computed in the browser (about 4 s the first time for a point).
  useEffect(() => {
    if (!cover.ok) return
    let cancelled = false
    loadAnywhereLight({ latDeg, lonDeg })
      .then(({ light }) => !cancelled && setState({ key, status: 'ready', light }))
      .catch((error: unknown) => !cancelled && setState({ key, status: 'error', message: error instanceof Error ? error.message : String(error) }))
    return () => {
      cancelled = true
    }
  }, [cover.ok, latDeg, lonDeg, key])

  const current = state && state.key === key ? state : null
  const ready = current?.status === 'ready' ? current.light : null

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-gray-400">
            <span aria-hidden className={'h-2 w-2 rounded-full ' + (place ? 'bg-[#56B4E9]' : 'animate-pulse bg-[#FFD400]')} />
            {place ? 'Saved place' : 'Picked point'}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{place ? place.name : `${latDeg.toFixed(4)}°, ${lonDeg.toFixed(2)}° E`}</span>
            {place && (
              <button
                type="button"
                aria-label={`Rename ${place.name}`}
                title="Rename"
                onClick={() => {
                  const name = window.prompt('Name for this place', place.name)
                  if (name) onRename(name)
                }}
                className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                </svg>
              </button>
            )}
          </p>
          {place && <p className="text-[11px] text-gray-400">{formatCoords(place.latDeg, place.lonDeg)}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded px-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
          ×
        </button>
      </div>
      {children}
      {!cover.ok && <p className="text-[11px] text-gray-400">{cover.reason}</p>}
      {cover.ok && (
        <>
          {!place && (
          <button
            type="button"
            onClick={onSave}
            disabled={current?.status === 'error'}
            className="btn-outline flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            Save point
          </button>
          )}
          {place && (
          <button
            type="button"
            onClick={onCompare}
            className="btn-outline flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium"
          >
            Compare
          </button>
          )}
          {current?.status === 'error' && <p className="text-xs text-[#E69F00]">Could not compute this point: {current.message}</p>}
          {!current && (
            <div className="flex aspect-[360/150] w-full items-center justify-center rounded bg-black text-xs text-gray-400">
              Computing the horizon from NASA tiles…
            </div>
          )}
          {ready && (
            <>
              <DateTimeControl
                samples={ready.sky.samples}
                index={indexForTime(ready.sky.samples, timeMs)}
                onIndexChange={(i) => onTimeChange(timeOfIndex(ready.sky.samples, i))}
              />
              <StayPanel samples={ready.sky.samples} horizon={ready.horizon} timeMs={timeMs} stayDays={stayDays} onStayDaysChange={onStayDaysChange} />
              <section className="flex flex-col gap-1 border-t border-white/[0.08] pt-2">
                <h3 className="text-sm font-medium">Horizon</h3>
                <HorizonPreview sky={ready.sky} horizon={ready.horizon} timeMs={timeMs} />
              </section>
            </>
          )}
          <button
            type="button"
            onClick={onOpenHorizon}
            className="btn-outline px-3 py-2 text-sm font-medium"
            title={`Computed in your browser from NASA ${cover.label}`}
          >
            Open Horizon view here
          </button>
          {place && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remove ${place.name}? It disappears from the map, the menu and Compare.`)) onRemove()
              }}
              className="flex items-center justify-center gap-1.5 rounded border border-[#E69F00]/60 px-3 py-1.5 text-xs text-[#f5b94d] hover:bg-[#E69F00]/15"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
              Remove this place
            </button>
          )}
        </>
      )}
    </>
  )
}
