import { useEffect, useState } from 'react'
import { MainView } from './components/MainView'
import { Sidebar } from './components/Sidebar'
import { loadSiteData } from './data/loadSiteData'
import { bodyVisibility } from './scene/visibility'
import type { SiteData } from './types'

const siteId = 'shackleton-rim'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SiteData }

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [sampleIndex, setSampleIndex] = useState(0)

  useEffect(() => {
    loadSiteData(siteId)
      .then((data) => setLoadState({ status: 'ready', data }))
      .catch((error: unknown) =>
        setLoadState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
      )
  }, [])

  if (loadState.status !== 'ready') {
    return (
      <div className="flex h-full items-center justify-center bg-black text-sm text-gray-400">
        {loadState.status === 'loading' ? 'Loading data…' : loadState.message}
      </div>
    )
  }

  const { sky, horizon, terrain } = loadState.data
  const sample = sky.samples[sampleIndex]
  const sunVisibility = bodyVisibility(sample.sun, horizon)
  const earthVisibility = bodyVisibility(sample.earth, horizon)

  return (
    <div className="flex h-full">
      <Sidebar
        site={sky.site}
        samples={sky.samples}
        index={sampleIndex}
        onIndexChange={setSampleIndex}
        sunVisibility={sunVisibility}
        earthVisibility={earthVisibility}
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
