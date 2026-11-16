import { SITES } from '../data/sites'
import { GROUP_COLOR } from '../data/siteGroups'
import { FlagButton } from './FlagButton'
import type { HorizonProfile, LandingSite, SiteData, SkySample } from '../types'
import type { TimingMetrics } from '../scene/timing'
import type { BodyVisibility } from '../scene/visibility'
import { DateTimeControl } from './DateTimeControl'
import { MetricsPanel } from './MetricsPanel'
import { StayPanel } from './StayPanel'

type SidebarProps = {
  site: LandingSite
  samples: SkySample[]
  index: number
  onIndexChange: (index: number) => void
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
  timing: TimingMetrics
  // Set for a point picked on the map (not a curated site).
  anywhere: NonNullable<SiteData['anywhere']> | null
  horizon: HorizonProfile
  timeMs: number
  stayDays: number
  onStayDaysChange: (days: number) => void
  onResetView: () => void
}

export function Sidebar({
  site,
  samples,
  index,
  onIndexChange,
  sunVisibility,
  earthVisibility,
  timing,
  anywhere,
  horizon,
  timeMs,
  stayDays,
  onStayDaysChange,
  onResetView,
}: SidebarProps) {
  const entry = SITES.find((s) => s.id === site.id)
  const groupColor = entry ? GROUP_COLOR[entry.group] : null
  return (
    <aside data-tour="horizon-panel" className="absolute left-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-72 flex-col gap-4 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#1c1e20] p-4 text-gray-100">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          Horizon view
        </h1>
        <button
          type="button"
          onClick={onResetView}
          title="Back to the starting direction, level horizon, no zoom"
          className="btn-outline flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
          </svg>
          Reset view
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            {groupColor && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: groupColor }} />}
            {site.name}
          </p>
          <p className="text-xs text-gray-400">
            {site.latitudeDeg.toFixed(4)}°, {site.longitudeDeg.toFixed(2)}° E
          </p>
        </div>
        <FlagButton siteId={anywhere ? horizon.siteId : site.id} timeMs={timeMs} wide />
      </section>

      <DateTimeControl samples={samples} index={index} onIndexChange={onIndexChange} />
      <MetricsPanel
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
        sunNext={timing.sunNext}
        earthNext={timing.earthNext}
      />
      <StayPanel
        samples={samples}
        horizon={horizon}
        timeMs={timeMs}
        stayDays={stayDays}
        onStayDaysChange={onStayDaysChange}
      />
    </aside>
  )
}
