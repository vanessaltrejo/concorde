import { useEffect, useState, type ReactNode } from 'react'
import type { SiteLight } from '../data/loadSiteData'
import { indexForTime, timeOfIndex } from '../scene/timeSelection'
import { coverage, loadPointLight } from '../terrain/anywhere'
import { DateTimeControl } from './DateTimeControl'
import { HorizonPreview } from './HorizonPreview'
import { StayPanel } from './StayPanel'

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
  children,
}: PickedPointCardProps) {
  const cover = coverage(latDeg)
  const key = `${latDeg.toFixed(4)},${lonDeg.toFixed(4)}`
  const [state, setState] = useState<LightState | null>(null)

  // The horizon is computed in the browser (about 4 s the first time for a point).
  useEffect(() => {
    if (!cover.ok) return
    let cancelled = false
    loadPointLight({ latDeg, lonDeg })
      .then((light) => !cancelled && setState({ key, status: 'ready', light }))
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
        <div>
          <p className="flex items-center gap-2 text-xs text-gray-400">
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[#FFD400]" />
            Picked point
          </p>
          <p className="text-sm font-medium">
            {latDeg.toFixed(4)}°, {lonDeg.toFixed(2)}° E
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close picked point" className="rounded px-1.5 text-gray-400 hover:bg-[#444] hover:text-white">
          ×
        </button>
      </div>
      {children}
      {!cover.ok && <p className="text-[11px] text-gray-400">{cover.reason}</p>}
      {cover.ok && (
        <>
          <button
            type="button"
            onClick={onSave}
            disabled={current?.status === 'error'}
            className="flex items-center justify-center gap-2 rounded bg-[#FFD400] px-3 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            Save point
          </button>
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
              <section className="flex flex-col gap-1 border-t border-[#444] pt-2">
                <h3 className="text-sm font-medium">Horizon</h3>
                <HorizonPreview sky={ready.sky} horizon={ready.horizon} timeMs={timeMs} />
              </section>
            </>
          )}
          <button
            type="button"
            onClick={onOpenHorizon}
            className="rounded bg-[#FFD400] px-3 py-2 text-sm font-semibold text-black hover:brightness-110"
            title={`Computed in your browser from NASA ${cover.label}`}
          >
            Open Horizon view here
          </button>
        </>
      )}
    </>
  )
}
