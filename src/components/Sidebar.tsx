import { APP_NAME } from '../appName'
import type { HorizonProfile, LandingSite, SkySample } from '../types'
import type { TimingMetrics } from '../scene/timing'
import type { BodyVisibility } from '../scene/visibility'
import { Credits } from './Credits'
import { DateTimeControl } from './DateTimeControl'
import { MetricsPanel } from './MetricsPanel'
import { PeriodSummary } from './PeriodSummary'
import { StayPanel } from './StayPanel'
import type { TerrainSummary } from '../scene/terrainInfo'

type SidebarProps = {
  site: LandingSite
  samples: SkySample[]
  index: number
  onIndexChange: (index: number) => void
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
  timing: TimingMetrics
  terrainSummary: TerrainSummary
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
  terrainSummary,
  horizon,
  timeMs,
  stayDays,
  onStayDaysChange,
}: SidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-[#444] bg-[#303030] p-4 text-gray-100">
      <h1 className="text-lg font-semibold">{APP_NAME}</h1>

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Site</h2>
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-sm">{site.name}</span>
          <span className="text-xs text-gray-400">
            {site.latitudeDeg.toFixed(4)}°, {site.longitudeDeg.toFixed(2)}° E
          </span>
        </p>
      </section>

      <DateTimeControl samples={samples} index={index} onIndexChange={onIndexChange} />
      <MetricsPanel
        sample={samples[index]}
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
        sunNext={timing.sunNext}
        earthNext={timing.earthNext}
        terrainNote={`LOLA ${terrainSummary.nearSpacingM} m terrain up to ${terrainSummary.radiusKm} km`}
      />
      <StayPanel
        samples={samples}
        horizon={horizon}
        timeMs={timeMs}
        stayDays={stayDays}
        onStayDaysChange={onStayDaysChange}
      />
      <PeriodSummary timing={timing} />
      <Credits siteSource={site.source} terrainSource={terrainSummary.source} />
    </aside>
  )
}
