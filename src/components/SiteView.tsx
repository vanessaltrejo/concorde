import { useMemo, useState } from 'react'
import type { TimingMetrics } from '../scene/timing'
import type { SiteData } from '../types'
import type { AnywherePoint } from '../terrain/anywhere'
import { bodyVisibility } from '../scene/visibility'
import { buildTimeline, nextTransition, visiblePercent } from '../scene/windows'
import { MainView } from './MainView'
import { Sidebar } from './Sidebar'

type SiteViewProps = {
  data: SiteData
  // The selected time is owned by the app, so it is shared with the Orbital view.
  sampleIndex: number
  onSampleIndexChange: (index: number) => void
  stayDays: number
  onStayDaysChange: (days: number) => void
  // Double-click on the terrain moves the Horizon view there.
  onMoveTo?: (point: AnywherePoint, headingDeg: number) => void
  // Direction to face on opening (kept when moving across the terrain); default: toward the Earth.
  initialHeadingDeg?: number | null
  // Places stood on before (oldest first), drawn as dots on the terrain.
  trail?: AnywherePoint[]
}

// One site: shared time selection for the sidebar and the 3D view.
export function SiteView({ data, sampleIndex, onSampleIndexChange, stayDays, onStayDaysChange, onMoveTo, initialHeadingDeg, trail = [] }: SiteViewProps) {
  const { sky, horizon, terrain } = data
  const [resetToken, setResetToken] = useState(0)

  const sunTimeline = useMemo(() => buildTimeline(sky.samples, horizon, 'sun'), [sky, horizon])
  const earthTimeline = useMemo(() => buildTimeline(sky.samples, horizon, 'earth'), [sky, horizon])

  const sample = sky.samples[sampleIndex]
  const sunVisibility = bodyVisibility(sample.sun, horizon)
  const earthVisibility = bodyVisibility(sample.earth, horizon)

  const timing: TimingMetrics = {
    sunNext: nextTransition(sunTimeline, sampleIndex),
    earthNext: nextTransition(earthTimeline, sampleIndex),
    sunPercent: visiblePercent(sunTimeline),
    earthPercent: visiblePercent(earthTimeline),
    periodStartMs: sunTimeline.timesMs[0],
    periodEndMs: sunTimeline.timesMs[sunTimeline.timesMs.length - 1],
  }

  return (
    <div className="relative flex h-full min-w-0 flex-1">
      <Sidebar
        site={sky.site}
        samples={sky.samples}
        index={sampleIndex}
        onIndexChange={onSampleIndexChange}
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
        timing={timing}
        anywhere={data.anywhere ?? null}
        horizon={horizon}
        timeMs={Date.parse(sample.timeUtc)}
        stayDays={stayDays}
        onStayDaysChange={onStayDaysChange}
        onResetView={() => setResetToken((t) => t + 1)}
      />
      <MainView
        sample={sample}
        horizon={horizon}
        terrain={terrain}
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
        initialAzimuthDeg={Math.round(initialHeadingDeg ?? sky.samples[0].earth.azimuthDeg)}
        resetToken={resetToken}
        siteLatDeg={sky.site.latitudeDeg}
        siteLonDeg={sky.site.longitudeDeg}
        onMoveTo={onMoveTo}
        trail={trail}
      />
    </div>
  )
}
