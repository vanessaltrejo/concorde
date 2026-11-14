import { useEffect, useState } from 'react'
import { MainView } from './components/MainView'
import { Sidebar } from './components/Sidebar'
import { loadSkyData } from './data/loadSkyData'
import type { SkyData } from './types'

const siteId = 'shackleton-rim'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SkyData }

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [sampleIndex, setSampleIndex] = useState(0)

  useEffect(() => {
    loadSkyData(siteId)
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

  const { data } = loadState
  return (
    <div className="flex h-full">
      <Sidebar
        site={data.site}
        samples={data.samples}
        index={sampleIndex}
        onIndexChange={setSampleIndex}
      />
      <MainView
        sample={data.samples[sampleIndex]}
        initialAzimuthDeg={Math.round(data.samples[0].earth.azimuthDeg)}
      />
    </div>
  )
}
