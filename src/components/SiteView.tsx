import { useMemo, useState } from 'react'
import type { TimingMetrics } from '../scene/timing'
import type { SiteData } from '../types'
import { bodyVisibility } from '../scene/visibility'
import { buildTimeline, nextTransition, visiblePercent } from '../scene/windows'
import { MainView } from './MainView'
import { Sidebar } from './Sidebar'

type SiteViewProps = {
  data: SiteData
}

// One site: shared time selection for the sidebar and the 3D view.
export function SiteView({ data }: SiteViewProps) {
  const { sky, horizon, terrain } = data
  const [sampleIndex, setSampleIndex] = useState(0)

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
    <div className="flex h-full">
      <Sidebar
        site={sky.site}
        samples={sky.samples}
        index={sampleIndex}
        onIndexChange={setSampleIndex}
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
        timing={timing}
      />
      <MainView
        sample={sample}
        horizon={horizon}
        terrain={terrain}
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
        initialAzimuthDeg={Math.round(sky.samples[0].earth.azimuthDeg)}
      />
    </div>
  )
}
