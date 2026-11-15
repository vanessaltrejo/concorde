import { useEffect, useState } from 'react'
import { loadSiteLight, type SiteLight } from '../data/loadSiteData'
import { SITES, type SiteEntry } from '../data/sites'
import { indexForTime, timeOfIndex } from '../scene/timeSelection'
import { DateTimeControl } from './DateTimeControl'
import { HorizonPreview } from './HorizonPreview'
import { StayPanel } from './StayPanel'

type SitePanelProps = {
  selected: SiteEntry | null
  timeMs: number | null
  onTimeChange: (timeMs: number) => void
  stayDays: number
  onStayDaysChange: (days: number) => void
  // Snapshot of the zone taken from the globe, or null while it is being made.
  zoneImageUrl: string | null
  zonePending: boolean
  onSelect: (siteId: string) => void
  onOpenSkyView: (siteId: string) => void
  onOpenTopography: (siteId: string) => void
  onZoomOut: () => void
}

type LightState =
  | { siteId: string; status: 'ready'; light: SiteLight }
  | { siteId: string; status: 'error'; message: string }

// Right-hand column on the Orbital view: the curated site list, then for the
// selected site the date, a Horizon preview and a Topography preview.
export function SitePanel({
  selected,
  timeMs,
  onTimeChange,
  stayDays,
  onStayDaysChange,
  zoneImageUrl,
  zonePending,
  onSelect,
  onOpenSkyView,
  onOpenTopography,
  onZoomOut,
}: SitePanelProps) {
  const [lightState, setLightState] = useState<LightState | null>(null)
  const selectedId = selected?.id ?? null
  const hasSkyData = selected?.hasSkyData ?? false

  // Only the small files (Sun/Earth + horizon) are loaded for the preview, not the terrain.
  useEffect(() => {
    if (!selectedId || !hasSkyData) return
    let cancelled = false
    loadSiteLight(selectedId)
      .then((light) => {
        if (!cancelled) setLightState({ siteId: selectedId, status: 'ready', light })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLightState({
            siteId: selectedId,
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, hasSkyData])

  const current = lightState && lightState.siteId === selectedId ? lightState : null

  return (
    <div className="absolute right-4 top-4 flex max-h-[calc(100%-2rem)] w-72 flex-col gap-3 overflow-y-auto rounded-lg border border-[#444] bg-[#303030]/95 p-3 text-gray-100">
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Sites</h2>
        {SITES.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => onSelect(site.id)}
            className={
              'rounded px-2 py-1 text-left text-sm transition-colors ' +
              (selected?.id === site.id ? 'bg-[#444] text-white' : 'text-gray-300 hover:bg-[#3a3a3a]')
            }
          >
            {site.name}
            {!site.hasSkyData && <span className="ml-1 text-xs text-gray-500">(no Horizon view data yet)</span>}
          </button>
        ))}
      </section>

      {selected && (
        <>
          <section className="flex flex-col gap-1 border-t border-[#444] pt-2">
            <p className="text-sm font-medium">{selected.name}</p>
            <p className="text-xs text-gray-400">
              {selected.latitudeDeg.toFixed(4)}°, {selected.longitudeDeg.toFixed(2)}° E
            </p>
            <p className="text-[11px] text-gray-500">{selected.source}</p>
          </section>

          {!selected.hasSkyData && (
            <p className="text-xs text-gray-400">
              Horizon view data for this site is not generated yet (Horizons + LOLA scripts).
            </p>
          )}
          {current?.status === 'error' && <p className="text-xs text-gray-400">{current.message}</p>}
          {selected.hasSkyData && !current && <p className="text-xs text-gray-400">Loading preview…</p>}

          {current?.status === 'ready' && (
            <>
              <DateTimeControl
                samples={current.light.sky.samples}
                index={indexForTime(current.light.sky.samples, timeMs)}
                onIndexChange={(i) => onTimeChange(timeOfIndex(current.light.sky.samples, i))}
              />

              <StayPanel
                samples={current.light.sky.samples}
                horizon={current.light.horizon}
                timeMs={timeMs}
                stayDays={stayDays}
                onStayDaysChange={onStayDaysChange}
              />

              <section className="flex flex-col gap-1 border-t border-[#444] pt-2">
                <h3 className="text-sm font-medium">Horizon</h3>
                <HorizonPreview sky={current.light.sky} horizon={current.light.horizon} timeMs={timeMs} />
                <button
                  type="button"
                  onClick={() => onOpenSkyView(selected.id)}
                  className="mt-1 rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-950 hover:bg-white"
                >
                  Open Horizon view
                </button>
              </section>
            </>
          )}

          <section className="flex flex-col gap-1 border-t border-[#444] pt-2">
            <h3 className="text-sm font-medium">Topography</h3>
            {zoneImageUrl ? (
              <img
                src={zoneImageUrl}
                alt={`Map of the zone around ${selected.name}, as currently shown on the globe`}
                className="w-full rounded bg-black"
              />
            ) : (
              <p className="text-xs text-gray-400">
                {zonePending ? 'Preparing zone image…' : 'No zone image yet. Topography view flies there and takes one.'}
              </p>
            )}
            <p className="text-[10px] text-gray-500">Snapshot of the globe over this zone, with the active map layer.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenTopography(selected.id)}
                className="flex-1 rounded border border-[#555] px-2 py-1 text-xs hover:bg-[#3a3a3a]"
              >
                Topography view
              </button>
              <button
                type="button"
                onClick={onZoomOut}
                className="flex-1 rounded border border-[#555] px-2 py-1 text-xs hover:bg-[#3a3a3a]"
              >
                Back to globe
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
