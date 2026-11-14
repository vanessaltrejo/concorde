import { useEffect, useState } from 'react'
import { SiteView } from './components/SiteView'
import { loadSiteData } from './data/loadSiteData'
import type { SiteData } from './types'

const siteId = 'shackleton-rim'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SiteData }

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

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

  return <SiteView data={loadState.data} />
}
