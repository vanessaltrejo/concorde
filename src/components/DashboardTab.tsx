import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SITES } from '../data/sites'
import { SitePicker } from './SitePicker'
import { loadSiteLight, type SiteLight } from '../data/loadSiteData'
import { GOALS, computeMetrics, scoreFor, type GoalId } from '../scene/compare'
import { dailySunPercent, toCsv } from '../scene/dashboard'
import { formatDuration, formatUtc, formatUtcDay } from '../scene/formatTime'
import { evaluateSite, loadSiteSlopes, type Criteria, type SiteSlope } from '../scene/requirements'
import { loadAnywhereLight, pointId } from '../terrain/anywhere'
import { usePlaces } from '../state/places'
import { computeStay } from '../scene/stay'
import { indexForTime } from '../scene/timeSelection'
import { buildTimeline, nextTransition, type NextTransition } from '../scene/windows'
import { HorizonPreview } from './HorizonPreview'

// Dashboard: gray "glass" mission control. Palette (2026-11-15): White, Silver,
// Medium Gray, Gray, Blue Gray. Color has meaning and stays the same everywhere
// on it: Sun = white, Earth = Blue Gray. Text is never the only carrier of a color.

type Props = {
  siteId: string | null
  onSelectSite: (id: string) => void
  timeMs: number | null
  onTimeChange: (ms: number) => void
  stayDays: number
  // The requirements set on the Orbital view, checked for the selected point.
  criteria: Criteria
}

// One row of the dashboard: a registered site or one of the user's saved pins.
type Entry = { id: string; name: string; group: string }
const PIN_COLOR = '#56B4E9'

type State = { lights: Record<string, SiteLight>; slopes: Record<string, SiteSlope>; status: 'loading' | 'ready' | 'error' }

const DAY_MS = 86_400_000
// On dark backgrounds
const SUN = '#ffffff'
const EARTH_LIGHT = '#b0bec5'
// On glass cards (readable contrast)
const SUN_LINE = '#ffffff'
const SUN_INK = '#ffffff'
const EARTH = '#b0bec5'
const GRID = 'rgba(255,255,255,0.09)'
const AXIS_TEXT = '#a0a0a0'

export function DashboardTab({ siteId, onSelectSite, timeMs, onTimeChange, stayDays, criteria }: Props) {
  const withData = useMemo(() => SITES.filter((s) => s.hasSkyData), [])
  const places = usePlaces()
  const pins = useMemo<Entry[]>(() => places.map((p) => ({ id: pointId(p), name: p.name, group: 'Saved point' })), [places])
  const entries = useMemo<Entry[]>(() => [...withData, ...pins], [withData, pins])
  // A saved pin picked here stays on the dashboard (the other pages keep the registered site).
  const [pinId, setPinId] = useState<string | null>(null)
  const curatedId = siteId && withData.some((s) => s.id === siteId) ? siteId : withData[0].id
  const activeId = pinId && pins.some((p) => p.id === pinId) ? pinId : curatedId
  const select = (id: string) => {
    if (id.startsWith('point:')) setPinId(id)
    else {
      setPinId(null)
      onSelectSite(id)
    }
  }
  const [state, setState] = useState<State>({ lights: {}, slopes: {}, status: 'loading' })
  const [pinData, setPinData] = useState<{ lights: Record<string, SiteLight>; slopes: Record<string, SiteSlope> }>({ lights: {}, slopes: {} })
  const [detailed, setDetailed] = useState(false)
  const [goalId, setGoalId] = useState<GoalId>('power')

  useEffect(() => {
    let cancelled = false
    Promise.all([Promise.all(withData.map((s) => loadSiteLight(s.id))), loadSiteSlopes().catch(() => ({}) as Record<string, SiteSlope>)])
      .then(([lights, slopes]) => {
        if (!cancelled) setState({ lights: Object.fromEntries(withData.map((s, i) => [s.id, lights[i]])), slopes, status: 'ready' })
      })
      .catch(() => !cancelled && setState((p) => ({ ...p, status: 'error' })))
    return () => {
      cancelled = true
    }
  }, [withData])

  // Saved pins: computed in the browser from the terrain tiles (cached per point).
  useEffect(() => {
    let cancelled = false
    for (const p of places) {
      const id = pointId(p)
      loadAnywhereLight(p)
        .then((r) => {
          if (cancelled) return
          setPinData((d) => ({ lights: { ...d.lights, [id]: r.light }, slopes: r.slope ? { ...d.slopes, [id]: r.slope } : d.slopes }))
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [places])

  const lights = useMemo(() => ({ ...state.lights, ...pinData.lights }), [state.lights, pinData.lights])
  const slopes = useMemo(() => ({ ...state.slopes, ...pinData.slopes }), [state.slopes, pinData.slopes])

  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0]
  const table = useMemo(() => {
    if (state.status !== 'ready') return []
    return entries
      .filter((s) => lights[s.id])
      .map((s) => {
        const m = computeMetrics(s.id, lights[s.id], slopes[s.id] ?? null, timeMs, stayDays)
        const req = evaluateSite(s.id, lights[s.id], slopes[s.id] ?? null, criteria, timeMs, stayDays)
        return { site: s, m, req, score: scoreFor(m, goal.weights) }
      })
      .sort((a, b) => b.score - a.score)
  }, [state.status, entries, lights, slopes, timeMs, stayDays, goal, criteria])
  const heat = useMemo(
    () => (state.status === 'ready' ? entries.filter((s) => lights[s.id]).map((s) => ({ site: s, days: dailySunPercent(lights[s.id]) })) : []),
    [state.status, entries, lights],
  )

  const light = lights[activeId]
  const pinLoading = activeId.startsWith('point:') && !light
  if (state.status === 'error') return <Shell><Centered>Could not load the site data.</Centered></Shell>
  if (state.status === 'loading' || !light) return <Shell><Centered>{pinLoading ? 'Computing this point from NASA terrain tiles…' : 'Loading mission data…'}</Centered></Shell>

  const samples = light.sky.samples
  const a = indexForTime(samples, timeMs)
  const wanted = Math.max(1, Math.round(stayDays * 24))
  const stay = computeStay(samples, light.horizon, a, stayDays)
  const prev = a - wanted >= 0 ? computeStay(samples, light.horizon, a - wanted, stayDays) : null
  const sunTl = buildTimeline(samples, light.horizon, 'sun')
  const earthTl = buildTimeline(samples, light.horizon, 'earth')
  const sunNext = nextTransition(sunTl, a)
  const earthNext = nextTransition(earthTl, a)
  const meets = table.filter((r) => r.req.meets).length
  const site = entries.find((e) => e.id === activeId) ?? withData[0]
  const mine = table.find((r) => r.site.id === activeId)
  const req = evaluateSite(activeId, light, slopes[activeId] ?? null, criteria, timeMs, stayDays)
  const reqRows = [
    criteria.sun.on && { label: 'Sun during stay', want: `≥ ${criteria.sun.minPercent}%`, got: `${Math.round(req.sunPercent)}%`, ok: req.passes.sun },
    criteria.earth.on && { label: 'Earth link during stay', want: `≥ ${criteria.earth.minPercent}%`, got: `${Math.round(req.earthPercent)}%`, ok: req.passes.earth },
    criteria.slope.on && { label: 'Slope at the site', want: `≤ ${criteria.slope.maxDeg}°`, got: req.slope ? `${req.slope.slopeDeg.toFixed(1)}°` : 'no data', ok: req.passes.slope },
  ].filter(Boolean) as { label: string; want: string; got: string; ok: boolean }[]
  const reqText = [
    criteria.sun.on && `Sun ≥ ${criteria.sun.minPercent}%`,
    criteria.earth.on && `Earth ≥ ${criteria.earth.minPercent}%`,
    criteria.slope.on && `slope ≤ ${criteria.slope.maxDeg}°`,
  ].filter(Boolean).join(', ')

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['Site', 'Group', `Score (${goal.label})`, 'Sun %', 'Earth %', 'Longest dark (h)', 'Mean Sun elevation (deg)', 'Slope (deg)', 'Meets your requirements'],
      ...table.map((r) => [r.site.name, r.site.group, r.score.toFixed(1), r.m.sunPercent.toFixed(1), r.m.earthPercent.toFixed(1), r.m.longestDarkHours.toFixed(0), r.m.meanSunElevationDeg?.toFixed(2) ?? '', r.m.slopeDeg?.toFixed(1) ?? '', r.req.meets ? 'yes' : 'no']),
    ]
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `landing-sites-${new Date(stay.arrivalMs).toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Shell>
      <div className="grid gap-3 xl:grid-cols-12">
        {/* Hero: dark accent with the Moon */}
        <section className="glass rise relative overflow-hidden rounded-3xl p-6 xl:col-span-7" style={{ animationDelay: '0ms' }}>
          <img src="/textures/moon-hero.png" alt="" aria-hidden className="pointer-events-none absolute -right-14 -top-12 hidden w-72 select-none opacity-80 grayscale md:block [mask-image:radial-gradient(circle_at_40%_60%,black_45%,transparent_72%)]" />
          <div className="relative flex max-w-[34rem] flex-col gap-3">
            <p className="font-display flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#c0c0c0]">
              <span aria-hidden className="h-3 w-1 rounded-sm bg-gradient-to-b from-white to-[#808080]" />
              Lunar landing site navigator
            </p>
            <div>
              <h1 className="font-display bg-gradient-to-b from-white via-[#e6e8e9] to-[#a0a0a0] bg-clip-text text-5xl font-semibold tracking-tight text-transparent">Welcome!</h1>
              <p className="mt-2 text-sm text-[#d6dadc]">
                Pick a site and a date. See when the <span style={{ color: SUN }}>Sun</span> powers your lander and when{' '}
                <span style={{ color: EARTH_LIGHT }}>Earth</span> can hear you, behind the real lunar terrain.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-56">
                <SitePicker
                  value={activeId}
                  options={withData}
                  extraGroups={pins.length ? [{ title: 'Saved points', color: PIN_COLOR, items: pins }] : []}
                  onChange={select}
                  ariaLabel="Site"
                  triggerClassName="btn-glass flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm font-medium"
                />
              </div>
              <Chip>Arrival {formatUtc(stay.arrivalMs)}</Chip>
              <Chip>Stay {stayDays} d</Chip>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center justify-between gap-2 text-xs text-[#c0c0c0]">
                <span>Your requirements</span>
                {reqRows.length > 0 && <span className={req.meets ? 'text-white' : 'text-[#a0a0a0]'}>{req.meets ? '✓ Meets all' : '✕ Misses at least one'}</span>}
              </p>
              {reqRows.length === 0 ? (
                <p className="text-xs text-[#a0a0a0]">None set (Orbital view)</p>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-3">
                  {reqRows.map((r) => (
                    <li key={r.label} className="rounded-xl border border-white/15 bg-white/[0.05] px-2.5 py-1.5">
                      <span className="block text-[11px] text-[#a0a0a0]">{r.label} {r.want}</span>
                      <span className="flex items-center justify-between text-sm text-white">
                        {r.got}
                        <span aria-label={r.ok ? 'meets' : 'misses'} className={r.ok ? 'text-white' : 'text-[#a0a0a0]'}>{r.ok ? '✓' : '✕'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Detail level" className="flex overflow-hidden rounded-xl border border-white/20 bg-white/5 text-xs">
                {([['Simple', false], ['Detailed', true]] as const).map(([label, value]) => (
                  <button key={label} type="button" aria-pressed={detailed === value} onClick={() => setDetailed(value)}
                    className={'px-3 py-1.5 ' + (detailed === value ? 'bg-gradient-to-b from-white to-[#c0c0c0] font-semibold text-[#1b1d1f]' : 'text-[#d6dadc] hover:bg-white/10')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Headline numbers, 2 x 2 next to the hero */}
        <section className="rise grid grid-cols-2 gap-3 xl:col-span-5" style={{ animationDelay: '80ms' }} aria-label="Key numbers">
          <Gauge label="Time with Sun" value={stay.sunPercent} color={SUN_LINE} ink={SUN_INK} delta={prev ? stay.sunPercent - prev.sunPercent : null} />
          <Gauge label="Time with Earth link" value={stay.earthPercent} color={EARTH} ink={EARTH} delta={prev ? stay.earthPercent - prev.earthPercent : null} />
          <Countdown body="Sun" next={sunNext} color={SUN} />
          <Countdown body="Earth" next={earthNext} color={EARTH_LIGHT} />
        </section>

        {/* Timeline */}
        <Panel delay={160} className="xl:col-span-8" title="Your stay, hour by hour" sub={detailed ? 'Elevation of the disc center. Bars: part of the disc above the real terrain horizon.' : 'Above the dashed line = in the sky. Bars = when you have power and a link.'}>
          <StayChart light={light} start={a} length={wanted} />
        </Panel>

        {/* Live sky + quick facts */}
        <Panel delay={220} className="xl:col-span-4" title={`Sky now at ${site.name}`} sub="Real horizon, 360°.">
          <HorizonPreview sky={light.sky} horizon={light.horizon} timeMs={timeMs} />
          <dl className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
            <Fact label="Sun height" value={`${samples[a].sun.elevationDeg.toFixed(1)}°`} />
            <Fact label="Earth height" value={`${samples[a].earth.elevationDeg.toFixed(1)}°`} />
            <Fact label="Longest dark gap" value={mine ? (mine.m.longestDarkHours < 1 ? 'none' : `${Math.round(mine.m.longestDarkHours)} h`) : '—'} />
            <Fact label="Slope (~100 m)" value={mine?.m.slopeDeg != null ? `${mine.m.slopeDeg.toFixed(1)}°` : 'no data'} />
          </dl>
        </Panel>

        {/* Heatmap */}
        <Panel delay={280} className="xl:col-span-7" title="90 days of sunlight, every site" sub={detailed ? 'Share of each UTC day with part of the Sun above the terrain horizon. Click a day to set your arrival.' : 'Brighter = more sunlight that day. Click any day to jump there.'}>
          <Heatmap rows={heat} startMs={Date.parse(samples[0].timeUtc)} arrivalMs={stay.arrivalMs} stayDays={stayDays} activeId={activeId} onPick={(id, ms) => { select(id); onTimeChange(ms) }} />
        </Panel>

        {/* Ranking */}
        <Panel
          delay={340}
          className="xl:col-span-5"
          title="Best sites for your goal"
          sub={reqText ? `${meets} of ${table.length} meet your requirements (${reqText}).` : `${table.length} sites and saved points.`}
          action={<button type="button" onClick={exportCsv} className="btn-glass rounded-lg px-2.5 py-0.5 text-xs">Export CSV</button>}
        >
          <div role="radiogroup" aria-label="Goal" className="mb-2 flex flex-wrap gap-1">
            {GOALS.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={g.id === goalId} title={g.blurb} onClick={() => setGoalId(g.id)}
                className={'rounded-full border px-2.5 py-0.5 text-xs ' + (g.id === goalId ? 'border-white/70 bg-gradient-to-b from-white to-[#c0c0c0] font-semibold text-[#1b1d1f]' : 'border-white/20 bg-white/5 text-[#d6dadc] hover:bg-white/10')}>
                {g.label}
              </button>
            ))}
          </div>
          <ol className="flex flex-col">
            {table.map((r, i) => (
              <li key={r.site.id}>
                <button type="button" onClick={() => select(r.site.id)}
                  className={'grid w-full grid-cols-[1rem_1fr_auto] items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.08] ' + (r.site.id === activeId ? 'bg-white/[0.12] ring-1 ring-white/25' : '')}>
                  <span className="text-xs text-gray-500">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {r.site.id.startsWith('point:') && <span aria-label="Saved point" className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIN_COLOR }} />}
                        <span className="truncate font-medium text-gray-100">{r.site.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px]">
                        <span style={{ color: SUN_INK }}>☀︎ {Math.round(r.m.sunPercent)}%</span>
                        <span className="mx-1 text-gray-400">·</span>
                        <span style={{ color: EARTH }}>⊕ {Math.round(r.m.earthPercent)}%</span>
                        {detailed && <span className="ml-1 text-gray-400">· {r.m.slopeDeg != null ? `${r.m.slopeDeg.toFixed(1)}°` : 'no slope'}</span>}
                      </span>
                    </span>
                    <span className="mt-1 block h-1 rounded-full bg-white/10">
                      <span className="block h-1 rounded-full bg-gradient-to-r from-[#808080] via-[#c0c0c0] to-white" style={{ width: `${r.score}%` }} />
                    </span>
                  </span>
                  <span className="font-display w-7 text-right text-sm font-semibold tabular-nums text-white">{Math.round(r.score)}</span>
                </button>
              </li>
            ))}
          </ol>
          {detailed && <p className="mt-1 text-[11px] text-gray-400">Score 0–100 for “{goal.label}”. Weights are a first proposal.</p>}
        </Panel>

      </div>

    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#1b1d1f] text-gray-100">
      {/* Backdrop for the glass: graphite with soft silver and blue-gray light. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 12% 0%, rgba(192,192,192,0.28), transparent 70%), radial-gradient(45% 40% at 95% 20%, rgba(176,190,197,0.22), transparent 70%), radial-gradient(55% 50% at 60% 110%, rgba(128,128,128,0.28), transparent 70%), linear-gradient(180deg, #2a2d30 0%, #1b1d1f 60%, #151617 100%)',
        }}
      />
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 md:p-5 [&>*]:shrink-0">{children}</div>
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">{children}</div>
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/20 bg-white/[0.07] px-3 py-1.5 text-xs text-[#e3e6e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">{children}</span>
}

function Panel({ title, sub, action, className = '', delay = 0, children }: { title: string; sub?: string; action?: ReactNode; className?: string; delay?: number; children: ReactNode }) {
  return (
    <section className={'glass rise rounded-2xl p-4 text-gray-100 ' + className} style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-white">{title}</h2>
          {sub && <p className="mt-0.5 text-[11px] text-[#a0a0a0]">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5">
      <dt className="text-[#a0a0a0]">{label}</dt>
      <dd className="font-display text-sm text-white">{value}</dd>
    </div>
  )
}

// Ring gauge on a white card: value 0–100.
function Gauge({ label, value, color, ink, delta }: { label: string; value: number; color: string; ink: string; delta: number | null }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3 text-gray-100">
      <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 -rotate-90 drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * Math.max(0, Math.min(100, value))) / 100} ${c}`} />
      </svg>
      <div className="min-w-0">
        <p className="text-xs text-[#c0c0c0]">{label}</p>
        <p className="font-display text-3xl font-semibold tabular-nums leading-tight" style={{ color: ink }}>{Math.round(value)}%</p>
        <p className="text-[11px] text-[#a0a0a0]">
          {delta === null ? 'of your stay' : <>{delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '='} {Math.abs(delta).toFixed(0)} pts vs previous stay</>}
        </p>
      </div>
    </div>
  )
}

// Mission-control countdown.
function Countdown({ body, next, color }: { body: 'Sun' | 'Earth'; next: NextTransition; color: string }) {
  const up = next.kind === 'set'
  return (
    <div className="glass flex flex-col justify-between rounded-2xl p-3">
      <p className="font-display flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#a0a0a0]">
        <span>{body}{up ? 'set' : 'rise'} in</span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: up ? color : 'transparent', border: `1.5px solid ${color}` }} />
          {up ? 'up now' : 'below horizon'}
        </span>
      </p>
      <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-white">{next.found ? formatDuration(next.inMs) : `> ${formatDuration(next.afterMs)}`}</p>
      <p className="text-[11px] text-[#a0a0a0]">{next.found ? formatUtc(next.timeMs) : 'beyond the end of the data'}</p>
    </div>
  )
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Elevation lines in real pixels (text never scales), plus visibility bars.
function StayChart({ light, start, length }: { light: SiteLight; start: number; length: number }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const samples = light.sky.samples
  const end = Math.min(start + length, samples.length)
  const idx = Array.from({ length: end - start }, (_, i) => start + i)
  const sun = idx.map((i) => samples[i].sun.elevationDeg)
  const earth = idx.map((i) => samples[i].earth.elevationDeg)
  const sunMargins = buildTimeline(samples, light.horizon, 'sun').marginsDeg
  const earthMargins = buildTimeline(samples, light.horizon, 'earth').marginsDeg
  const H = 185, L = 32, R = 6, T = 8, B = 20
  const lo = Math.floor(Math.min(...sun, ...earth, 0) - 1)
  const hi = Math.ceil(Math.max(...sun, ...earth, 0) + 1)
  const x = (k: number) => L + (k / Math.max(idx.length - 1, 1)) * (W - L - R)
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B)
  const line = (vals: number[]) => vals.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = (vals: number[]) => `${line(vals)} L${x(vals.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z`
  const step = Math.max(1, Math.ceil((hi - lo) / 4))
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  const startMs = Date.parse(samples[start].timeUtc)
  const nDays = Math.max(1, Math.round(idx.length / 24))
  const dayStep = Math.max(1, Math.ceil(nDays / Math.max(2, Math.floor(W / 90))))
  return (
    <div ref={ref}>
      <svg width={W} height={H} role="img" aria-label="Sun and Earth elevation over the stay">
        <defs>
          <linearGradient id="sunFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={SUN_LINE} stopOpacity="0.22" />
            <stop offset="100%" stopColor={SUN_LINE} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#a0a0a0' : GRID} strokeDasharray={v === 0 ? '4 4' : undefined} />
            <text x={L - 6} y={y(v) + 3} fontSize={10} fill={AXIS_TEXT} textAnchor="end">{v}°</text>
          </g>
        ))}
        <text x={W - R} y={y(0) - 4} fontSize={10} fill={AXIS_TEXT} textAnchor="end">horizon plane</text>
        {Array.from({ length: Math.floor(nDays / dayStep) + 1 }, (_, t) => t * dayStep * 24).filter((k) => k < idx.length).map((k) => (
          <text key={k} x={x(k)} y={H - 6} fontSize={10} fill={AXIS_TEXT} textAnchor={k === 0 ? 'start' : 'middle'}>{formatUtcDay(startMs + k * 3_600_000)}</text>
        ))}
        <path d={area(sun)} fill="url(#sunFill)" />
        <path d={line(earth)} fill="none" stroke={EARTH} strokeWidth={2} strokeDasharray="6 4" />
        <path d={line(sun)} fill="none" stroke={SUN_LINE} strokeWidth={2.5} />
      </svg>
      <div className="flex flex-col gap-1" style={{ paddingLeft: L, paddingRight: R }}>
        <Strip label="Power (Sun up)" color={SUN_LINE} on={idx.map((i) => sunMargins[i] > 0)} />
        <Strip label="Link (Earth up)" color={EARTH} on={idx.map((i) => earthMargins[i] > 0)} />
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-4 text-[11px] text-gray-300">
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-5" style={{ background: SUN_LINE }} />Sun</li>
        <li className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: EARTH }} />Earth</li>
      </ul>
    </div>
  )
}

function Strip({ label, color, on }: { label: string; color: string; on: boolean[] }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] text-[#a0a0a0]">{label}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        {on.map((v, i) => <span key={i} className="h-full flex-1" style={{ background: v ? color : 'transparent' }} />)}
      </div>
    </div>
  )
}

function Heatmap({ rows, startMs, arrivalMs, stayDays, activeId, onPick }: { rows: { site: { id: string; name: string }; days: number[] }[]; startMs: number; arrivalMs: number; stayDays: number; activeId: string; onPick: (id: string, ms: number) => void }) {
  const stayFrom = (arrivalMs - startMs) / DAY_MS
  const stayTo = stayFrom + stayDays
  const nDays = rows[0]?.days.length ?? 0
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[32rem]">
        {rows.map(({ site, days }) => (
          <div key={site.id} className="mb-1 flex items-center gap-3">
            <span className={'w-32 shrink-0 truncate text-xs ' + (site.id === activeId ? 'font-semibold text-white' : 'text-[#a0a0a0]')}>{site.name}</span>
            <div className="flex flex-1 gap-px">
              {days.map((pct, d) => {
                const inStay = site.id === activeId && d + 1 > stayFrom && d < stayTo
                return (
                  <button
                    key={d}
                    type="button"
                    title={`${site.name}, ${formatUtcDay(startMs + d * DAY_MS)}: ${Math.round(pct)}% of the day with Sun`}
                    aria-label={`${site.name}, ${formatUtcDay(startMs + d * DAY_MS)}: ${Math.round(pct)} percent Sun`}
                    onClick={() => onPick(site.id, startMs + d * DAY_MS)}
                    className="h-4 flex-1 rounded-[2px] transition-transform hover:scale-y-125"
                    style={{
                      background: pct === 0 ? 'rgba(255,255,255,0.06)' : `rgba(255,255,255,${0.14 + 0.86 * (pct / 100)})`,
                      boxShadow: inStay ? 'inset 0 0 0 1.5px #b0bec5, 0 0 6px rgba(176,190,197,0.8)' : undefined,
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
        <div className="mt-1.5 flex items-center justify-between pl-[8.75rem] text-[11px] text-gray-400">
          <span>{formatUtcDay(startMs)}</span>
          <span className="flex items-center gap-2">
            no Sun
            <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.06), ${SUN_LINE})` }} />
            Sun all day
          </span>
          <span>{formatUtcDay(startMs + nDays * DAY_MS)}</span>
        </div>
      </div>
    </div>
  )
}
