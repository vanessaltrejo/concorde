import { lazy, Suspense, useEffect, useState } from 'react'
import { NavRail, type TabId } from './components/NavRail'
import { Placeholder } from './components/Placeholder'
import { SiteView } from './components/SiteView'
import { loadSiteData } from './data/loadSiteData'
import { DEFAULT_SITE_ID, getSite, SITES } from './data/sites'
import { DEFAULT_STAY_DAYS } from './scene/stay'
import { indexForTime, timeOfIndex } from './scene/timeSelection'
import { readUrlState, writeUrlState } from './state/urlState'
import type { SiteData } from './types'

// CesiumJS is large: it loads only when the Orbital view tab opens.
const MoonGlobe = lazy(() => import('./components/MoonGlobe'))

// Data for one site. Only the open site is kept in memory ("one zone at a
// time"): opening another site replaces it.
type Loaded =
  | { siteId: string; status: 'ready'; data: SiteData }
  | { siteId: string; status: 'error'; message: string }

const centered = 'flex h-full flex-1 items-center justify-center bg-black text-sm text-gray-400'

export default function App() {
  // Start from the address bar (?view=&site=&t=) when it has a valid state.
  const [initial] = useState(() => readUrlState(SITES.map((s) => s.id)))
  const [tab, setTab] = useState<TabId>(initial.view ?? 'orbital')
  // Site picked on the Orbital view (highlighted there).
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(initial.siteId ?? DEFAULT_SITE_ID)
  // Site shown in the Horizon view.
  const [skySiteId, setSkySiteId] = useState(initial.siteId ?? DEFAULT_SITE_ID)
  // Selected date and time, shared by the Orbital view and every Horizon view. null = first sample.
  const [timeMs, setTimeMs] = useState<number | null>(initial.timeMs)
  // Stay length in days, from the selected time on. Shared by both views.
  const [stayDays, setStayDays] = useState(initial.stayDays ?? DEFAULT_STAY_DAYS)
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  // Load the Horizon view site's files (about 19 MB) only when that tab is open and
  // the site is not already loaded. A late answer for an older site is ignored.
  useEffect(() => {
    if (tab !== 'horizon' || loaded?.siteId === skySiteId) return
    let cancelled = false
    loadSiteData(skySiteId)
      .then((data) => {
        if (!cancelled) setLoaded({ siteId: skySiteId, status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoaded({
            siteId: skySiteId,
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
      })
    return () => {
      cancelled = true
    }
  }, [tab, skySiteId, loaded])

  // Keep the address bar in step with the screen, so a link reopens it.
  useEffect(() => {
    writeUrlState({ view: tab, siteId: tab === 'horizon' ? skySiteId : selectedSiteId, timeMs, stayDays })
  }, [tab, skySiteId, selectedSiteId, timeMs, stayDays])

  function openSkyView(siteId: string) {
    setSkySiteId(siteId)
    setTab('horizon')
  }

  // Data that belongs to another site is not shown while the new one loads.
  const current = loaded && loaded.siteId === skySiteId ? loaded : null

  return (
    <div className="flex h-full">
      <NavRail active={tab} onChange={setTab} />
      {tab === 'horizon' && (
        <HorizonTab
          current={current}
          siteName={getSite(skySiteId).name}
          timeMs={timeMs}
          onTimeChange={setTimeMs}
          stayDays={stayDays}
          onStayDaysChange={setStayDays}
          onBackToMap={() => {
            setSelectedSiteId(skySiteId)
            setTab('orbital')
          }}
        />
      )}
      {tab === 'orbital' && (
        <Suspense fallback={<div className={centered}>Loading Orbital view…</div>}>
          <MoonGlobe
            selectedSiteId={selectedSiteId}
            timeMs={timeMs}
            onTimeChange={setTimeMs}
            stayDays={stayDays}
            onStayDaysChange={setStayDays}
            onSelectSite={setSelectedSiteId}
            onOpenSkyView={openSkyView}
          />
        </Suspense>
      )}
      {tab === 'dashboard' && (
        <Placeholder title="Dashboard" description="Summary metrics for the selected site." />
      )}
    </div>
  )
}

type HorizonTabProps = {
  current: Loaded | null
  siteName: string
  timeMs: number | null
  onTimeChange: (timeMs: number) => void
  stayDays: number
  onStayDaysChange: (days: number) => void
  onBackToMap: () => void
}

function HorizonTab({ current, siteName, timeMs, onTimeChange, stayDays, onStayDaysChange, onBackToMap }: HorizonTabProps) {
  if (current?.status === 'ready') {
    const samples = current.data.sky.samples
    return (
      <div className="relative flex h-full min-w-0 flex-1">
        <SiteView
          key={current.siteId}
          data={current.data}
          sampleIndex={indexForTime(samples, timeMs)}
          onSampleIndexChange={(index) => onTimeChange(timeOfIndex(samples, index))}
          stayDays={stayDays}
          onStayDaysChange={onStayDaysChange}
        />
        <button
          type="button"
          onClick={onBackToMap}
          className="absolute left-[19rem] top-3 rounded bg-[#303030]/90 px-3 py-1.5 text-xs text-gray-100 hover:bg-[#3a3a3a]"
        >
          ← Back to Orbital view
        </button>
      </div>
    )
  }
  if (current?.status === 'error') return <div className={centered}>{current.message}</div>
  return <div className={centered}>Loading {siteName}…</div>
}
