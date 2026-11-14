import { useEffect, useState } from 'react'
import { NavRail, type TabId } from './components/NavRail'
import { Placeholder } from './components/Placeholder'
import { SiteView } from './components/SiteView'
import { loadSiteData } from './data/loadSiteData'
import type { SiteData } from './types'

const siteId = 'shackleton-rim'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SiteData }

const centered = 'flex h-full flex-1 items-center justify-center bg-black text-sm text-gray-400'

export default function App() {
  const [tab, setTab] = useState<TabId>('sky')
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

  // Sky view is the default tab, so its site data loads once on mount and stays cached
  // while you switch tabs.
  useEffect(() => {
    loadSiteData(siteId)
      .then((data) => setLoadState({ status: 'ready', data }))
      .catch((error: unknown) =>
        setLoadState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
      )
  }, [])

  return (
    <div className="flex h-full">
      <NavRail active={tab} onChange={setTab} />
      {tab === 'sky' && <SkyTab loadState={loadState} />}
      {tab === 'moon' && (
        <Placeholder title="Moon map" description="3D Moon globe. Pick a zone (like Shackleton) to open its Sky view." />
      )}
      {tab === 'dashboard' && (
        <Placeholder title="Dashboard" description="Summary metrics for the selected site." />
      )}
      {tab === 'earth' && <Placeholder title="Earth" description="3D Earth view." />}
    </div>
  )
}

function SkyTab({ loadState }: { loadState: LoadState }) {
  if (loadState.status === 'ready') return <SiteView data={loadState.data} />
  if (loadState.status === 'error') return <div className={centered}>{loadState.message}</div>
  return <div className={centered}>Loading data…</div>
}
