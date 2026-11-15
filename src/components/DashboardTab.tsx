import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SITES, getSite } from '../data/sites'
import { IMPACT_KPIS } from '../data/kpis'
import { loadSiteLight, type SiteLight } from '../data/loadSiteData'
import { GOALS, computeMetrics, scoreFor, type GoalId } from '../scene/compare'
import { dailySunPercent, toCsv } from '../scene/dashboard'
import { formatDuration, formatUtc, formatUtcDay } from '../scene/formatTime'
import { loadSiteSlopes, type SiteSlope } from '../scene/requirements'
import { computeStay } from '../scene/stay'
import { indexForTime } from '../scene/timeSelection'
import { buildTimeline, nextTransition, type NextTransition } from '../scene/windows'
import { HorizonPreview } from './HorizonPreview'

// Dashboard: dark "mission control" page. Color has meaning and stays the same
// everywhere on it: Sun = white, Earth = blue, NASA red only for small accents
// (title tick, your stay outline). Text is never the only carrier of a color.

type Props = {
  siteId: string | null
  onSelectSite: (id: string) => void
  timeMs: number | null
  onTimeChange: (ms: number) => void
  stayDays: number
  onOpenHorizon: (siteId: string) => void
  onOpenCompare: () => void
}

type State = { lights: Record<string, SiteLight>; slopes: Record<string, SiteSlope>; status: 'loading' | 'ready' | 'error' }

const DAY_MS = 86_400_000
// On dark backgrounds
const SUN = '#ececec'
const EARTH_LIGHT = '#5b9bff'
// On gray cards (readable contrast)
const SUN_LINE = '#ececec'
const SUN_INK = '#ececec'
const EARTH = '#5b9bff'
const RED = '#fc3d21'

export function DashboardTab({ siteId, onSelectSite, timeMs, onTimeChange, stayDays, onOpenHorizon, onOpenCompare }: Props) {
  const withData = useMemo(() => SITES.filter((s) => s.hasSkyData), [])
  const activeId = siteId && withData.some((s) => s.id === siteId) ? siteId : withData[0].id
  const [state, setState] = useState<State>({ lights: {}, slopes: {}, status: 'loading' })
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

  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0]
  const table = useMemo(() => {
    if (state.status !== 'ready') return []
    return withData
      .map((s) => {
        const m = computeMetrics(s.id, state.lights[s.id], state.slopes[s.id] ?? null, timeMs, stayDays)
        return { site: s, m, score: scoreFor(m, goal.weights) }
      })
      .sort((a, b) => b.score - a.score)
  }, [state, withData, timeMs, stayDays, goal])
  const heat = useMemo(
    () => (state.status === 'ready' ? withData.map((s) => ({ site: s, days: dailySunPercent(state.lights[s.id]) })) : []),
    [state, withData],
  )

  const light = state.lights[activeId]
  if (state.status === 'error') return <Shell><Centered>Could not load the site data.</Centered></Shell>
  if (state.status === 'loading' || !light) return <Shell><Centered>Loading mission data…</Centered></Shell>

  const samples = light.sky.samples
  const a = indexForTime(samples, timeMs)
  const wanted = Math.max(1, Math.round(stayDays * 24))
  const stay = computeStay(samples, light.horizon, a, stayDays)
  const prev = a - wanted >= 0 ? computeStay(samples, light.horizon, a - wanted, stayDays) : null
  const sunTl = buildTimeline(samples, light.horizon, 'sun')
  const earthTl = buildTimeline(samples, light.horizon, 'earth')
  const sunNext = nextTransition(sunTl, a)
  const earthNext = nextTransition(earthTl, a)
  const meets = table.filter((r) => r.m.meetsDefaults).length
  const site = getSite(activeId)
  const mine = table.find((r) => r.site.id === activeId)

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['Site', 'Group', `Score (${goal.label})`, 'Sun %', 'Earth %', 'Longest dark (h)', 'Mean Sun elevation (deg)', 'Slope (deg)', 'Meets defaults'],
      ...table.map((r) => [r.site.name, r.site.group, r.score.toFixed(1), r.m.sunPercent.toFixed(1), r.m.earthPercent.toFixed(1), r.m.longestDarkHours.toFixed(0), r.m.meanSunElevationDeg?.toFixed(2) ?? '', r.m.slopeDeg?.toFixed(1) ?? '', r.m.meetsDefaults ? 'yes' : 'no']),
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
        <section className="relative overflow-hidden rounded-xl border border-[#444] p-5 xl:col-span-7">
          <img src="/textures/moon-hero.png" alt="" aria-hidden className="pointer-events-none absolute -right-16 -top-10 hidden w-64 select-none opacity-90 md:block [mask-image:radial-gradient(circle_at_40%_60%,black_45%,transparent_72%)]" />
          <div className="relative flex max-w-[34rem] flex-col gap-3">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
              <span aria-hidden className="h-3 w-1 rounded-sm" style={{ background: RED }} />
              Lunar landing site navigator
            </p>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">Welcome!</h1>
              <p className="mt-1 text-sm text-gray-300">
                Pick a site and a date. See when the <span style={{ color: SUN }}>Sun</span> powers your lander and when{' '}
                <span style={{ color: EARTH_LIGHT }}>Earth</span> can hear you, behind the real lunar terrain.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeId}
                onChange={(e) => onSelectSite(e.target.value)}
                aria-label="Site"
                className="rounded-lg border border-white/20 bg-[#262626] px-3 py-1.5 text-sm font-medium text-gray-100 [color-scheme:dark]"
              >
                {withData.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Chip>Arrival {formatUtc(stay.arrivalMs)}</Chip>
              <Chip>Stay {stayDays} d</Chip>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onOpenHorizon(activeId)} className="rounded-lg bg-[var(--nasa-blue)] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#164fb0]">
                Open Horizon view
              </button>
              <button type="button" onClick={onOpenCompare} className="rounded-lg border border-white/25 px-3.5 py-1.5 text-sm text-white hover:bg-white/10">
                Compare sites
              </button>
              <div role="group" aria-label="Detail level" className="flex overflow-hidden rounded-lg border border-white/20 text-xs">
                {([['Simple', false], ['Detailed', true]] as const).map(([label, value]) => (
                  <button key={label} type="button" aria-pressed={detailed === value} onClick={() => setDetailed(value)}
                    className={'px-3 py-1.5 ' + (detailed === value ? 'bg-[var(--nasa-blue)] text-white' : 'text-gray-300 hover:bg-white/10')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Headline numbers, 2 x 2 next to the hero */}
        <section className="grid grid-cols-2 gap-3 xl:col-span-5" aria-label="Key numbers">
          <Gauge label="Time with Sun" value={stay.sunPercent} color={SUN_LINE} ink={SUN_INK} delta={prev ? stay.sunPercent - prev.sunPercent : null} />
          <Gauge label="Time with Earth link" value={stay.earthPercent} color={EARTH} ink={EARTH} delta={prev ? stay.earthPercent - prev.earthPercent : null} />
          <Countdown body="Sun" next={sunNext} color={SUN} />
          <Countdown body="Earth" next={earthNext} color={EARTH_LIGHT} />
        </section>

        {/* Timeline */}
        <Panel className="xl:col-span-8" title="Your stay, hour by hour" sub={detailed ? 'Elevation of the disc center. Bars: part of the disc above the real terrain horizon.' : 'Above the dashed line = in the sky. Bars = when you have power and a link.'}>
          <StayChart light={light} start={a} length={wanted} />
        </Panel>

        {/* Live sky + quick facts */}
        <Panel className="xl:col-span-4" title={`Sky now at ${site.name}`} sub="Real horizon, 360°.">
          <HorizonPreview sky={light.sky} horizon={light.horizon} timeMs={timeMs} />
          <dl className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
            <Fact label="Sun height" value={`${samples[a].sun.elevationDeg.toFixed(1)}°`} />
            <Fact label="Earth height" value={`${samples[a].earth.elevationDeg.toFixed(1)}°`} />
            <Fact label="Longest dark gap" value={mine ? (mine.m.longestDarkHours < 1 ? 'none' : `${Math.round(mine.m.longestDarkHours)} h`) : '—'} />
            <Fact label="Slope (~100 m)" value={mine?.m.slopeDeg != null ? `${mine.m.slopeDeg.toFixed(1)}°` : 'no data'} />
          </dl>
        </Panel>

        {/* Heatmap */}
        <Panel className="xl:col-span-7" title="90 days of sunlight, every site" sub={detailed ? 'Share of each UTC day with part of the Sun above the terrain horizon. Click a day to set your arrival.' : 'Brighter = more sunlight that day. Click any day to jump there.'}>
          <Heatmap rows={heat} startMs={Date.parse(samples[0].timeUtc)} arrivalMs={stay.arrivalMs} stayDays={stayDays} activeId={activeId} onPick={(id, ms) => { onSelectSite(id); onTimeChange(ms) }} />
        </Panel>

        {/* Ranking */}
        <Panel
          className="xl:col-span-5"
          title="Best sites for your goal"
          sub={`${meets} of ${table.length} meet the defaults (Sun 100%, Earth ≥ 25%, slope ≤ 10°).`}
          action={<button type="button" onClick={exportCsv} className="rounded border border-[#555] px-2 py-0.5 text-xs text-gray-100 hover:bg-[var(--nasa-blue)] hover:text-white">Export CSV</button>}
        >
          <div role="radiogroup" aria-label="Goal" className="mb-2 flex flex-wrap gap-1">
            {GOALS.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={g.id === goalId} title={g.blurb} onClick={() => setGoalId(g.id)}
                className={'rounded-full border px-2.5 py-0.5 text-xs ' + (g.id === goalId ? 'border-[var(--nasa-blue)] bg-[var(--nasa-blue)] text-white' : 'border-[#555] text-gray-200 hover:bg-[#3a3a3a]')}>
                {g.label}
              </button>
            ))}
          </div>
          <ol className="flex flex-col">
            {table.map((r, i) => (
              <li key={r.site.id}>
                <button type="button" onClick={() => onSelectSite(r.site.id)}
                  className={'grid w-full grid-cols-[1rem_1fr_auto] items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-[#3a3a3a] ' + (r.site.id === activeId ? 'bg-[#0B3D91]/40' : '')}>
                  <span className="text-xs text-gray-500">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-gray-100">{r.site.name}</span>
                      <span className="shrink-0 text-[11px]">
                        <span style={{ color: SUN_INK }}>☀︎ {Math.round(r.m.sunPercent)}%</span>
                        <span className="mx-1 text-gray-400">·</span>
                        <span style={{ color: EARTH }}>⊕ {Math.round(r.m.earthPercent)}%</span>
                        {detailed && <span className="ml-1 text-gray-400">· {r.m.slopeDeg != null ? `${r.m.slopeDeg.toFixed(1)}°` : 'no slope'}</span>}
                      </span>
                    </span>
                    <span className="mt-1 block h-1 rounded-full bg-[#444]">
                      <span className="block h-1 rounded-full bg-[#4d8be8]" style={{ width: `${r.score}%` }} />
                    </span>
                  </span>
                  <span className="w-7 text-right text-sm font-semibold tabular-nums text-gray-100">{Math.round(r.score)}</span>
                </button>
              </li>
            ))}
          </ol>
          {detailed && <p className="mt-1 text-[11px] text-gray-400">Score 0–100 for “{goal.label}”. Weights are a first proposal.</p>}
        </Panel>

        {/* Impact: one slim row */}
        <Panel className="xl:col-span-12" title="Impact" sub="KPIs pending definition: waiting for the team's research on today's process. No values are invented.">
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {IMPACT_KPIS.map((k) => (
              <li key={k.id} className="flex items-baseline justify-between gap-2 rounded-lg border border-dashed border-[#555] px-3 py-2">
                <span>
                  <span className="block text-xs text-gray-200">{k.label}</span>
                  <span className="block text-[10px] text-gray-400">{k.unit}</span>
                </span>
                <span className="text-xl font-semibold text-gray-400">{k.status === 'live' ? k.value : '—'}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <p className="pb-1 text-center text-[11px] text-gray-500">
        Sun and Earth: NASA/JPL Horizons · Terrain: LOLA · Moon image: NASA LRO / Moon Trek · Planning aid, not flight grade.
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#303030] p-3 text-gray-100 md:p-4 [&>*]:shrink-0"
    >
      {children}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">{children}</div>
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-300">{children}</span>
}

function Panel({ title, sub, action, className = '', children }: { title: string; sub?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={'rounded-xl border border-[#444] p-3.5 text-gray-100 ' + className}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#3a3a3a] px-2.5 py-1.5">
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-mono text-sm text-gray-100">{value}</dd>
    </div>
  )
}

// Ring gauge on a white card: value 0–100.
function Gauge({ label, value, color, ink, delta }: { label: string; value: number; color: string; ink: string; delta: number | null }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#444] p-3 text-gray-100">
      <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#444" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * Math.max(0, Math.min(100, value))) / 100} ${c}`} />
      </svg>
      <div className="min-w-0">
        <p className="text-xs text-gray-300">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-tight" style={{ color: ink }}>{Math.round(value)}%</p>
        <p className="text-[11px] text-gray-400">
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
    <div className="flex flex-col justify-between rounded-xl border border-[#444] p-3">
      <p className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-gray-400">
        <span>{body}{up ? 'set' : 'rise'} in</span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: up ? color : 'transparent', border: `1.5px solid ${color}` }} />
          {up ? 'up now' : 'below horizon'}
        </span>
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">{next.found ? formatDuration(next.inMs) : `> ${formatDuration(next.afterMs)}`}</p>
      <p className="text-[11px] text-gray-500">{next.found ? formatUtc(next.timeMs) : 'beyond the end of the data'}</p>
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
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#98a2b3' : '#444'} strokeDasharray={v === 0 ? '4 4' : undefined} />
            <text x={L - 6} y={y(v) + 3} fontSize={10} fill="#9aa3b2" textAnchor="end">{v}°</text>
          </g>
        ))}
        <text x={W - R} y={y(0) - 4} fontSize={10} fill="#9aa3b2" textAnchor="end">horizon plane</text>
        {Array.from({ length: Math.floor(nDays / dayStep) + 1 }, (_, t) => t * dayStep * 24).filter((k) => k < idx.length).map((k) => (
          <text key={k} x={x(k)} y={H - 6} fontSize={10} fill="#9aa3b2" textAnchor={k === 0 ? 'start' : 'middle'}>{formatUtcDay(startMs + k * 3_600_000)}</text>
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
      <p className="mb-0.5 text-[10px] text-gray-400">{label}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-[#444]">
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
            <span className={'w-32 shrink-0 truncate text-xs ' + (site.id === activeId ? 'font-semibold text-[#7fb0ff]' : 'text-gray-300')}>{site.name}</span>
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
                      background: pct === 0 ? '#444' : `rgba(236,236,236,${0.18 + 0.82 * (pct / 100)})`,
                      boxShadow: inStay ? `inset 0 0 0 1.5px ${RED}` : undefined,
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
            <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, #444, ${SUN_LINE})` }} />
            Sun all day
          </span>
          <span>{formatUtcDay(startMs + nDays * DAY_MS)}</span>
        </div>
      </div>
    </div>
  )
}
