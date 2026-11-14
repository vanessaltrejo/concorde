import type { LandingSite, SkySample } from '../types'
import type { TimingMetrics } from '../scene/timing'
import type { BodyVisibility } from '../scene/visibility'
import { Credits } from './Credits'
import { DateTimeControl } from './DateTimeControl'
import { MetricsPanel } from './MetricsPanel'
import { PeriodSummary } from './PeriodSummary'

type SidebarProps = {
  site: LandingSite
  samples: SkySample[]
  index: number
  onIndexChange: (index: number) => void
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
  timing: TimingMetrics
}

export function Sidebar({
  site,
  samples,
  index,
  onIndexChange,
  sunVisibility,
  earthVisibility,
  timing,
}: SidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-200 bg-white p-4 text-gray-900">
      <h1 className="text-lg font-semibold">Lunar Landing Site Simulator</h1>

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Site</h2>
        <p className="text-sm">{site.name}</p>
        <p className="text-xs text-gray-500">
          {site.latitudeDeg.toFixed(4)}°, {site.longitudeDeg.toFixed(2)}° E
        </p>
      </section>

      <DateTimeControl samples={samples} index={index} onIndexChange={onIndexChange} />
      <MetricsPanel
        sample={samples[index]}
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
        sunNext={timing.sunNext}
        earthNext={timing.earthNext}
      />
      <PeriodSummary timing={timing} />
      <Credits />
    </aside>
  )
}
