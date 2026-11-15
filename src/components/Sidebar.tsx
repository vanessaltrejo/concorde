import { SITES } from '../data/sites'
import { FlagButton } from './FlagButton'
import { MissionList } from './MissionList'
import type { HorizonProfile, LandingSite, SiteData, SkySample } from '../types'
import type { TimingMetrics } from '../scene/timing'
import type { BodyVisibility } from '../scene/visibility'
import { DateTimeControl } from './DateTimeControl'
import { MetricsPanel } from './MetricsPanel'
import { PeriodSummary } from './PeriodSummary'
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
}: SidebarProps) {
  return (
    <aside className="absolute left-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-72 flex-col gap-6 overflow-y-auto rounded-lg border border-[#444] bg-[#303030] p-4 shadow-lg text-gray-100">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
        Horizon view
      </h1>

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Site</h2>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">{site.name}</span>
          {!anywhere && <FlagButton siteId={site.id} timeMs={timeMs} />}
        </div>
        <p className="text-xs text-gray-400">
          {site.latitudeDeg.toFixed(4)}°, {site.longitudeDeg.toFixed(2)}° E
        </p>
        {(() => {
          const entry = SITES.find((s) => s.id === site.id)
          return entry ? <MissionList site={entry} /> : null
        })()}
      </section>

      <DateTimeControl samples={samples} index={index} onIndexChange={onIndexChange} />
      <MetricsPanel
        sample={samples[index]}
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
      <PeriodSummary timing={timing} />
    </aside>
  )
}
