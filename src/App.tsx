import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ActionBanner, type BannerItem } from './assistant/ActionBanner'
import { AssistantPanel } from './assistant/AssistantPanel'
import type { AppBridge, AppSnapshot } from './assistant/tools'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NavRail, type TabId } from './components/NavRail'
import { loadSiteData } from './data/loadSiteData'
import { DEFAULT_SITE_ID, getSite, SITES } from './data/sites'
import { DEFAULT_CRITERIA, type Criteria } from './scene/requirements'
import { DEFAULT_STAY_DAYS } from './scene/stay'
import { indexForTime, timeOfIndex } from './scene/timeSelection'
import { readUrlState, writeUrlState } from './state/urlState'
import { encodeScenarios, useScenarios } from './state/scenarios'
import { DashboardTab } from './components/DashboardTab'
import { CompareTab } from './components/CompareTab'
import type { SiteData } from './types'
import { loadAnywhereSite, pointId, pointName, type AnywherePoint } from './terrain/anywhere'

// CesiumJS is large: it loads only when the Orbital view tab opens.
const MoonGlobe = lazy(() => import('./components/MoonGlobe'))
// The 3D Horizon code (three.js) loads only when that tab is opened.
const SiteView = lazy(() => import('./components/SiteView').then((m) => ({ default: m.SiteView })))

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
  // A point picked on the map; when set, the Horizon view shows it instead of skySiteId.
  const [horizonPoint, setHorizonPoint] = useState<AnywherePoint | null>(initial.view === 'horizon' ? initial.point : null)
  const [pointProgress, setPointProgress] = useState('')
  // Selected date and time, shared by the Orbital view and every Horizon view. null = first sample.
  const [timeMs, setTimeMs] = useState<number | null>(initial.timeMs)
  // Stay length in days, from the selected time on. Shared by both views.
  const [stayDays, setStayDays] = useState(initial.stayDays ?? DEFAULT_STAY_DAYS)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const scenarios = useScenarios()
  // Orbital view layer and requirements. Kept here so the assistant can use them.
  const [layerId, setLayerId] = useState('image')
  const [requirementsOn, setRequirementsOn] = useState(false)
  const [criteria, setCriteria] = useState<Criteria>(DEFAULT_CRITERIA)
  const [flyRequest, setFlyRequest] = useState<{ siteId: string } | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [banners, setBanners] = useState<BannerItem[]>([])
  const bannerIdRef = useRef(0)

  // Latest state for the assistant's tools. Setters below also write it at
  // once, so several tool calls in one turn see each other's changes.
  const snapshot: AppSnapshot = {
    view: tab,
    orbitalSiteId: selectedSiteId,
    horizonSiteId: skySiteId,
    horizonPoint,
    timeMs,
    stayDays,
    layerId,
    requirementsOn,
    criteria,
  }
  const stateRef = useRef(snapshot)
  useEffect(() => {
    stateRef.current = snapshot
  })

  // Load the Horizon view site's files (about 19 MB) only when that tab is open and
  // the site is not already loaded. A late answer for an older site is ignored.
  // A picked point is computed in a Web Worker from the terrain tiles instead.
  const horizonKey = horizonPoint ? pointId(horizonPoint) : skySiteId
  useEffect(() => {
    if (tab !== 'horizon' || loaded?.siteId === horizonKey) return
    let cancelled = false
    const load = horizonPoint
      ? loadAnywhereSite(horizonPoint, (text) => {
          if (!cancelled) setPointProgress(text)
        })
      : loadSiteData(skySiteId)
    load
      .then((data) => {
        if (!cancelled) setLoaded({ siteId: horizonKey, status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoaded({
            siteId: horizonKey,
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
      })
    return () => {
      cancelled = true
    }
  }, [tab, skySiteId, horizonPoint, horizonKey, loaded])

  // Keep the address bar in step with the screen, so a link reopens it.
  useEffect(() => {
    const siteId = tab === 'horizon' ? skySiteId : selectedSiteId
    // The home (Orbital view, default site, stay and date) keeps a clean address: just "/".
    const isHome = tab === 'orbital' && siteId === DEFAULT_SITE_ID && stayDays === DEFAULT_STAY_DAYS && timeMs === null
    const point = tab === 'horizon' ? horizonPoint : null
    writeUrlState(
      isHome ? null : { view: tab, siteId: point ? null : siteId, timeMs, stayDays, point },
      encodeScenarios(scenarios),
    )
  }, [tab, skySiteId, selectedSiteId, horizonPoint, timeMs, stayDays, scenarios])

  function openSkyView(siteId: string) {
    setSkySiteId(siteId)
    setHorizonPoint(null)
    setTab('horizon')
    setFlyRequest(null)
  }

  function openPointView(point: AnywherePoint) {
    setPointProgress('')
    setHorizonPoint(point)
    setTab('horizon')
    setFlyRequest(null)
  }

  function backToMap() {
    // A picked point is not a curated site: keep the site that was selected.
    if (!horizonPoint) setSelectedSiteId(skySiteId)
    setTab('orbital')
  }

  function announce(text: string) {
    const id = ++bannerIdRef.current
    setBanners((prev) => [...prev.slice(-2), { id, text }])
    window.setTimeout(() => setBanners((prev) => prev.filter((b) => b.id !== id)), 6000)
  }

  // Bridge between the assistant's tools and the app state. Each change is announced.
  const [bridge] = useState<AppBridge>(() => {
    const patch = (change: Partial<AppSnapshot>) => {
      stateRef.current = { ...stateRef.current, ...change }
    }
    return {
      getState: () => stateRef.current,
      setTimeMs: (ms) => {
        patch({ timeMs: ms })
        setTimeMs(ms)
      },
      setStayDays: (days) => {
        patch({ stayDays: days })
        setStayDays(days)
      },
      setLayerId: (id) => {
        patch({ layerId: id })
        setLayerId(id)
      },
      selectSite: (siteId) => {
        if (stateRef.current.view === 'horizon') {
          patch({ horizonSiteId: siteId })
          setSkySiteId(siteId)
        } else {
          patch({ orbitalSiteId: siteId })
          setSelectedSiteId(siteId)
          setFlyRequest({ siteId })
        }
      },
      openHorizonView: (siteId) => {
        patch({ horizonSiteId: siteId, horizonPoint: null, view: 'horizon' })
        setSkySiteId(siteId)
        setHorizonPoint(null)
        setTab('horizon')
        setFlyRequest(null)
      },
      openHorizonAtPoint: (point) => {
        patch({ horizonPoint: point, view: 'horizon' })
        setHorizonPoint(point)
        setTab('horizon')
        setFlyRequest(null)
      },
      backToOrbitalView: () => {
        if (stateRef.current.horizonPoint) {
          patch({ view: 'orbital' })
        } else {
          const siteId = stateRef.current.horizonSiteId
          patch({ orbitalSiteId: siteId, view: 'orbital' })
          setSelectedSiteId(siteId)
        }
        setTab('orbital')
      },
      setRequirementsOn: (on) => {
        patch({ requirementsOn: on })
        setRequirementsOn(on)
      },
      setCriteria: (next) => {
        patch({ criteria: next })
        setCriteria(next)
      },
    }
  })

  // Data that belongs to another site is not shown while the new one loads.
  const current = loaded && loaded.siteId === horizonKey ? loaded : null

  return (
    <div className="relative flex h-full">
      <NavRail active={tab} onChange={setTab} assistantOpen={assistantOpen} onToggleAssistant={() => setAssistantOpen((o) => !o)} />
      <ErrorBoundary key={tab}>
      {tab === 'horizon' && (
        <HorizonTab
          current={current}
          siteName={horizonPoint ? pointName(horizonPoint) : getSite(skySiteId).name}
          progress={horizonPoint ? pointProgress : ''}
          timeMs={timeMs}
          onTimeChange={setTimeMs}
          stayDays={stayDays}
          onStayDaysChange={setStayDays}
          onBackToMap={backToMap}
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
            onOpenPointView={openPointView}
            layerId={layerId}
            onLayerChange={setLayerId}
            requirementsOn={requirementsOn}
            onRequirementsOnChange={setRequirementsOn}
            criteria={criteria}
            onCriteriaChange={setCriteria}
            flyRequest={flyRequest}
          />
        </Suspense>
      )}
      {tab === 'dashboard' && (
        <DashboardTab
          siteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
          timeMs={timeMs}
          onTimeChange={setTimeMs}
          stayDays={stayDays}
          onOpenHorizon={openSkyView}
          onOpenCompare={() => setTab('compare')}
        />
      )}
      {tab === 'compare' && (
        <CompareTab stayDays={stayDays} fallbackTimeMs={timeMs} />
      )}
      </ErrorBoundary>
      {/* Outside the error boundary: a view crash does not close the assistant. */}
      <ActionBanner items={banners} onDismiss={(id) => setBanners((prev) => prev.filter((b) => b.id !== id))} />
      {assistantOpen && (
        <AssistantPanel bridge={bridge} onAnnounce={announce} onClose={() => setAssistantOpen(false)} />
      )}
    </div>
  )
}

type HorizonTabProps = {
  current: Loaded | null
  siteName: string
  progress: string
  timeMs: number | null
  onTimeChange: (timeMs: number) => void
  stayDays: number
  onStayDaysChange: (days: number) => void
  onBackToMap: () => void
}

function HorizonTab({ current, siteName, progress, timeMs, onTimeChange, stayDays, onStayDaysChange, onBackToMap }: HorizonTabProps) {
  if (current?.status === 'ready') {
    const samples = current.data.sky.samples
    return (
      <div className="relative flex h-full min-w-0 flex-1">
        <Suspense fallback={<div className={centered}>Loading Horizon view…</div>}>
          <SiteView
            key={current.siteId}
            data={current.data}
            sampleIndex={indexForTime(samples, timeMs)}
            onSampleIndexChange={(index) => onTimeChange(timeOfIndex(samples, index))}
            stayDays={stayDays}
            onStayDaysChange={onStayDaysChange}
          />
        </Suspense>
        <button
          type="button"
          onClick={onBackToMap}
          className="absolute right-4 top-4 rounded-lg border border-[#444] bg-[#303030] px-3 py-1.5 text-xs text-gray-100 shadow-lg hover:bg-[var(--nasa-blue)] hover:text-white"
        >
          ← Back to Orbital view
        </button>
      </div>
    )
  }
  if (current?.status === 'error')
    return (
      <div className={`${centered} flex-col gap-3 px-6 text-center`}>
        <p className="max-w-md">{current.message}</p>
        <button type="button" onClick={onBackToMap} className="rounded border border-[#555] px-3 py-1.5 text-xs text-gray-100 hover:bg-[#3a3a3a]">
          ← Back to Orbital view
        </button>
      </div>
    )
  return (
    <div className={`${centered} flex-col gap-1`}>
      <p>Loading {siteName}…</p>
      {progress && <p className="text-xs text-gray-500">{progress}</p>}
    </div>
  )
}
