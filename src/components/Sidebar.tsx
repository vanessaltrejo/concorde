import { SITES } from '../data/sites'
import { FlagButton } from './FlagButton'
import { MissionList } from './MissionList'
import type { HorizonProfile, LandingSite, SiteData, SkySample } from '../types'
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
  terrainSummary,
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
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-sm">{site.name}</span>
          {!anywhere && <FlagButton siteId={site.id} timeMs={timeMs} />}
          <span className="text-xs text-gray-300">
            {site.latitudeDeg.toFixed(4)}°, {site.longitudeDeg.toFixed(2)}° E
          </span>
        </p>
        {(() => {
          const entry = SITES.find((s) => s.id === site.id)
          return entry ? <MissionList site={entry} /> : null
        })()}
        {anywhere && (
          <div className="mt-1 rounded border border-[#56B4E9]/50 bg-[#56B4E9]/10 p-2 text-[11px] leading-snug text-gray-200">
            <p className="font-medium text-[#9fd3f2]">Point picked on the map</p>
            <p>
              {anywhere.terrain}, computed in your browser from NASA tiles ({anywhere.tilesLoaded} tiles,{' '}
              {anywhere.seconds.toFixed(1)} s). Same method as the curated sites, checked against all six of them.
            </p>
            <p className="mt-1 text-gray-400">
              Sun and Earth: geometry from one JPL Horizons table for the whole Moon. Not a curated site: no published
              coordinates or site study behind this point.
            </p>
          </div>
        )}
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
      <Credits
        siteSource={site.source}
        terrainSource={terrainSummary.source}
        skySource={
          anywhere
            ? "Sun and Earth positions: computed for this point from one NASA/JPL Horizons table of the Sun and Earth seen from the Moon (checked against the per-site Horizons tables within 0.006°). Earth's picture orientation from Shackleton rim's table (parallax up to about 0.3°, visual only)."
            : undefined
        }
      />
    </aside>
  )
}
