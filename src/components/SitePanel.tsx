import { FlagButton } from './FlagButton'
import { SitePicker } from './SitePicker'
import { PanelHandle } from './PanelHandle'
import { MissionList } from './MissionList'
import { useEffect, useState, type ReactNode } from 'react'
import { loadSiteLight, type SiteLight } from '../data/loadSiteData'
import { SITES, type SiteEntry } from '../data/sites'
import { indexForTime, timeOfIndex } from '../scene/timeSelection'
import { DateTimeControl } from './DateTimeControl'
import { HorizonPreview } from './HorizonPreview'
import { StayPanel } from './StayPanel'

type SitePanelProps = {
  // Panel for a point picked on the globe; it replaces the site content.
  topSlot?: ReactNode
  selected: SiteEntry | null
  timeMs: number | null
  onTimeChange: (timeMs: number) => void
  stayDays: number
  onStayDaysChange: (days: number) => void
  // Snapshot of the zone taken from the globe, or null while it is being made.
  zoneImageUrl: string | null
  onSelect: (siteId: string) => void
  onOpenSkyView: (siteId: string) => void
}

type LightState =
  | { siteId: string; status: 'ready'; light: SiteLight }
  | { siteId: string; status: 'error'; message: string }

// Right-hand column on the Orbital view: the curated site list, then for the
// selected site the date, a Horizon preview and a Topography preview.
export function SitePanel({
  topSlot,
  selected,
  timeMs,
  onTimeChange,
  stayDays,
  onStayDaysChange,
  zoneImageUrl,
  onSelect,
  onOpenSkyView,
}: SitePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
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
    <div
      className="pointer-events-none absolute bottom-24 top-4 z-10 w-72 transition-[right,transform] duration-300 ease-out"
      style={{ right: 'calc(1rem + var(--assistant-w, 0px))', transform: collapsed ? 'translateX(calc(100% + 1rem))' : 'none' }}
    >
    <PanelHandle open={!collapsed} onClick={() => setCollapsed((c) => !c)} label="site panel" className="absolute -left-7 top-3" />
    <div className={'flex max-h-full w-72 flex-col gap-3 overflow-y-auto rounded-lg border border-[#444] bg-[#303030] p-3 text-gray-100 shadow-lg transition-opacity duration-300 ' + (collapsed ? 'pointer-events-none opacity-0' : 'pointer-events-auto')}>
      {topSlot ?? (
      <>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Registered landing sites</span>
        <SitePicker value={selected?.id ?? null} options={SITES} onChange={onSelect} ariaLabel="Registered landing sites" flagMissingData />
      </div>
      {selected?.hasSkyData && <FlagButton siteId={selected.id} timeMs={timeMs} wide />}

      {selected && (
        <>
          <section className="flex flex-col gap-1 border-t border-[#444] pt-2">
            <p className="text-xs text-gray-400">
              {selected.latitudeDeg.toFixed(4)}°, {selected.longitudeDeg.toFixed(2)}° E
            </p>
          </section>

          <MissionList site={selected} />

          {!selected.hasSkyData && (
            <p className="text-xs text-gray-300">
              Horizon view data for this site is not generated yet (Horizons + LOLA scripts).
            </p>
          )}
          {current?.status === 'error' && <p className="text-xs text-gray-300">{current.message}</p>}
          {selected.hasSkyData && !current && <p className="text-xs text-gray-300">Loading preview…</p>}

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
                  className="mt-1 rounded bg-[#FFD400] px-3 py-2 text-sm font-semibold text-black hover:brightness-110"
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
                alt={`Shaded relief of the zone around ${selected.name}`}
                className="aspect-[16/7] w-full rounded bg-black object-cover"
              />
            ) : (
              <p className="text-xs text-gray-300">No topography picture for this site yet.</p>
            )}
          </section>
        </>
      )}
      </>
      )}
    </div>
    </div>
  )
}
