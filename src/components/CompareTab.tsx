import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSite } from '../data/sites'
import { loadSiteLight, type SiteLight } from '../data/loadSiteData'
import { loadSiteSlopes, type SiteSlope } from '../scene/requirements'
import { AXES, GOALS, computeMetrics, scoreFor, whyWinner, type GoalId, type Metrics } from '../scene/compare'
import { addDateVariant, addScenario, MAX_SCENARIOS, moveScenario, removeScenario, setScenarioOrder, updateScenario, useScenarios, type Scenario } from '../state/scenarios'
import { HorizonPreview } from './HorizonPreview'
import { MissionList } from './MissionList'
import { SavedPointsTable } from './SavedPointsTable'
import { loadAnywhereLight, parsePointId, pointName } from '../terrain/anywhere'
import { usePlaces, getPlaces } from '../state/places'

// Compare: matte cards (solid dark surface, thin border, no sheen) after the
// reference dashboard. One accent tone per card, from the gray palette; cards
// are also told apart by their number and by line style on the radar.
const CARD_COLORS = ['#FFFFFF', '#B0BEC5', '#808080']

type Props = { stayDays: number; fallbackTimeMs: number | null; onAddPoint: () => void }

type Loaded = { lights: Record<string, SiteLight>; slopes: Record<string, SiteSlope>; failed: string[] }

export function CompareTab({ stayDays, fallbackTimeMs, onAddPoint }: Props) {
  const scenarios = useScenarios()
  // Re-render when a saved place is renamed (card titles use its name).
  usePlaces()
  const [goalId, setGoalId] = useState<GoalId>('power')
  // List mode: tick saved points, then Compare. Compare mode: the cards.
  const [mode, setMode] = useState<'list' | 'compare'>(() => (scenarios.length > 0 ? 'compare' : 'list'))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Registered sites sent here from the globe stay in the comparison and take a slot.
  const otherCount = scenarios.filter((s) => !parsePointId(s.siteId)).length
  const maxPoints = Math.max(0, MAX_SCENARIOS - otherCount)

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else if (next.size < maxPoints) next.add(id)
      return next
    })
  }
  function compareSelected() {
    for (const s of scenarios) if (parsePointId(s.siteId) && !selected.has(s.siteId)) removeScenario(s.id)
    for (const id of selected) if (!scenarios.some((s) => s.siteId === id)) addScenario(id, null)
    setSelected(new Set())
    setMode('compare')
  }
  // With nothing left to compare, the list comes back.
  const view = scenarios.length === 0 ? 'list' : mode
  const [data, setData] = useState<Loaded>({ lights: {}, slopes: {}, failed: [] })

  const siteIds = useMemo(() => [...new Set(scenarios.map((s) => s.siteId))], [scenarios])
  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadSiteSlopes().catch(() => ({}) as Record<string, SiteSlope>),
      ...siteIds.map((id) => {
        const point = parsePointId(id)
        // A point on the Moon: computed in the browser from the terrain tiles.
        if (point)
          return loadAnywhereLight(point)
            .then((r) => [id, r.light, r.slope] as const)
            .catch(() => [id, null, null] as const)
        return loadSiteLight(id).then((l) => [id, l, undefined] as const).catch(() => [id, null, undefined] as const)
      }),
    ]).then(([slopes, ...triples]) => {
      if (cancelled) return
      const lights: Record<string, SiteLight> = {}
      const allSlopes = { ...(slopes as Record<string, SiteSlope>) }
      const failed: string[] = []
      for (const [id, l, slope] of triples as [string, SiteLight | null, SiteSlope | null | undefined][]) {
        if (l) lights[id] = l
        else failed.push(id)
        if (slope) allSlopes[id] = slope
      }
      setData({ lights, slopes: allSlopes, failed })
    })
    return () => {
      cancelled = true
    }
  }, [siteIds])

  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0]
  const rows = scenarios.map((sc, i) => {
    const light = data.lights[sc.siteId]
    const metrics: Metrics | null = light
      ? computeMetrics(sc.siteId, light, data.slopes[sc.siteId] ?? null, sc.timeMs, stayDays)
      : null
    return { sc, i, light, metrics, score: metrics ? scoreFor(metrics, goal.weights) : null }
  })
  const ranked = rows.filter((r) => r.metrics).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const winner = ranked[0]
  const second = ranked[1]
  const why = winner?.metrics ? whyWinner(winner.metrics, second?.metrics ?? null, goal.weights) : []

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-5 overflow-y-auto bg-[#121314] px-6 py-6 text-gray-100">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">Compare sites</h1>
        {view === 'list' ? (
          scenarios.length > 0 && (
            <button type="button" onClick={() => setMode('compare')} className="btn-outline px-4 py-2 text-xs font-medium">
              Back to comparison
            </button>
          )
        ) : (
        <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Goal" className="flex border border-white/20">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={g.id === goalId}
              title={g.blurb}
              onClick={() => setGoalId(g.id)}
              className={
                'border-l border-white/20 px-4 py-2 text-xs font-medium first:border-l-0 ' +
                (g.id === goalId ? 'bg-white text-[#121314]' : 'text-[#c0c0c0] hover:bg-white/[0.06] hover:text-white')
              }
            >
              {g.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onAddPoint} title="Pick a point on the globe" className="btn-outline px-4 py-2 text-xs font-medium">
          + Add point
        </button>
        </div>
        )}
      </header>

      {view === 'list' && (
        <SavedPointsTable selected={selected} max={maxPoints} onToggle={toggle} onAddPoint={onAddPoint} onCompare={compareSelected} />
      )}

      {view === 'compare' && winner?.metrics && (
        <section className="card-matte flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
          <p className="text-sm text-[#c0c0c0]">
            Best for {goal.label.toLowerCase()}: <strong className="font-medium text-white">{scenarioName(winner.sc.siteId)}</strong>{' '}
            ({dateLabel(winner.sc, winner.light)})
            {why.length > 0 && second
              ? `, ahead on ${why.map((k) => AXES.find((a) => a.key === k)?.short.toLowerCase()).join(' and ')} over ${scenarioName(second.sc.siteId)}.`
              : ranked.length === 1
                ? '.'
                : '. Scores are nearly equal.'}
          </p>
          {ranked.length >= 2 && (
            <button
              type="button"
              onClick={() => setScenarioOrder([...ranked.map((r) => r.sc.id), ...rows.filter((r) => !r.metrics).map((r) => r.sc.id)])}
              className="btn-outline px-3 py-1.5 text-xs font-medium"
            >
              Order by score
            </button>
          )}
        </section>
      )}

      {view === 'compare' && rows.length > 0 && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))]">
          {rows.map((r) => (
            <Card
              key={r.sc.id}
              index={r.i}
              row={r}
              rank={ranked.findIndex((x) => x.sc.id === r.sc.id)}
              allMetrics={rows.map((x) => x.metrics)}
              fallbackTimeMs={fallbackTimeMs}
              loadingFailed={data.failed.includes(r.sc.siteId)}
            />
          ))}
        </div>
      )}

      {view === 'compare' && ranked.length >= 2 && <OverlayRadar rows={ranked.map((r) => ({ index: r.i, name: scenarioName(r.sc.siteId), metrics: r.metrics! }))} />}
    </div>
  )
}

function dateLabel(sc: Scenario, light: SiteLight | undefined): string {
  const ms = sc.timeMs ?? (light ? Date.parse(light.sky.samples[0].timeUtc) : null)
  return ms === null ? 'first date' : new Date(ms).toISOString().slice(0, 10)
}

type Row = { sc: Scenario; i: number; light: SiteLight | undefined; metrics: Metrics | null; score: number | null }

function Card({ index, row, rank, allMetrics, fallbackTimeMs, loadingFailed }: { index: number; row: Row; rank: number; allMetrics: (Metrics | null)[]; fallbackTimeMs: number | null; loadingFailed: boolean }) {
  const { sc, light, metrics, score } = row
  const [over, setOver] = useState(false)
  const site = parsePointId(sc.siteId) ? null : getSite(sc.siteId)
  const name = scenarioName(sc.siteId)
  const color = CARD_COLORS[index % CARD_COLORS.length]
  const first = light ? Date.parse(light.sky.samples[0].timeUtc) : 0
  const last = light ? Date.parse(light.sky.samples[light.sky.samples.length - 1].timeUtc) : 0
  const toInput = (ms: number) => new Date(ms).toISOString().slice(0, 16)
  const value = sc.timeMs ?? first
  const others = allMetrics.filter(Boolean).length > 1

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', sc.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        moveScenario(e.dataTransfer.getData('text/plain'), index)
      }}
      title="Drag to change your order"
      className={'card-matte flex cursor-grab flex-col rounded-2xl p-5 active:cursor-grabbing ' + (over ? 'outline outline-1 outline-white' : '')}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="icon-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ color }}>
            {index + 1}
          </span>
          <h2 className="truncate text-base font-medium text-white">{name}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {light && <span className="text-[11px] text-[#8f9396]">{dateLabel(sc, light)}</span>}
          <button type="button" onClick={() => removeScenario(sc.id)} aria-label={`Remove ${name}`} className="p-1 text-[#8f9396] hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>

      {loadingFailed && (
        <p className="mt-4 text-sm text-[#c0c0c0]">
          No data for this {site ? 'site' : 'point'} yet{site ? '' : ': outside the covered latitudes, or the daily tile limit was reached'}.
        </p>
      )}
      {!light && !loadingFailed && <p className="mt-4 text-sm text-[#8f9396]">{site ? 'Loading' : 'Computing the terrain for this point'}</p>}

      {metrics && light && (
        <>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-5xl font-bold leading-none tabular-nums text-white">{Math.round(score ?? 0)}</p>
              <p className="mt-1 text-xs text-[#8f9396]">score for this goal, out of 100</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-[11px]">
              {rank === 0 && others && <span className="border border-white/50 px-2 py-0.5 text-white">Highest score</span>}
              <span className={metrics.meetsDefaults ? 'text-white' : 'text-[#8f9396]'}>
                {metrics.meetsDefaults ? 'Meets the default requirements' : 'Misses a default requirement'}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <HorizonPreview sky={light.sky} horizon={light.horizon} timeMs={sc.timeMs} />
          </div>

          <ul className="mt-4 flex flex-col gap-2.5">
            {AXES.map(({ key, label }) => {
              const v = metrics.axes[key]
              const best = others && v !== null && allMetrics.every((m) => !m || m.axes[key] === null || (m.axes[key] as number) <= v)
              return (
                <li key={key}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-[#a7abad]">{label}</span>
                    <span className={best ? 'font-medium text-white' : 'text-[#c0c0c0]'}>
                      {axisText(key, metrics)}
                      {best && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[#8f9396]">best</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-1 bg-white/[0.08]">
                    <div className="h-1" style={{ width: `${v ?? 0}%`, background: color }} />
                  </div>
                </li>
              )
            })}
          </ul>

          {metrics.truncated && <Note>The stay runs past the end of the data ({metrics.coveredDays.toFixed(1)} days counted).</Note>}
          {metrics.slopeDeg === null && <Note>No slope data for this site yet: flatness is left out of the score.</Note>}
          <div className="mt-3">{site ? <MissionList site={site} /> : <Note>Point on the Moon: terrain and slope from NASA LOLA tiles.</Note>}</div>

          <label className="mt-4 flex flex-col gap-1 text-xs text-[#a7abad]">
            Arrival (UTC)
            <input
              type="datetime-local"
              onClick={(e) => e.currentTarget.showPicker?.()}
              value={toInput(value)}
              min={toInput(first)}
              max={toInput(last)}
              onChange={(e) => {
                const ms = Date.parse(`${e.target.value}Z`)
                if (!Number.isNaN(ms)) updateScenario(sc.id, { timeMs: ms })
              }}
              className="border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white outline-none [color-scheme:dark] focus:border-white/40"
            />
          </label>
          <button type="button" onClick={() => addDateVariant(sc, fallbackTimeMs ?? first)} className="btn-outline mt-3 px-3 py-1.5 text-xs font-medium">
            Same place, 7 days later
          </button>
        </>
      )}
    </article>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[11px] text-[#8f9396]">{children}</p>
}

function axisText(key: string, m: Metrics): string {
  switch (key) {
    case 'sun': return `${Math.round(m.sunPercent)}%`
    case 'earth': return `${Math.round(m.earthPercent)}%`
    case 'continuity': return m.longestDarkHours < 1 ? 'no dark gap' : `longest dark ${Math.round(m.longestDarkHours)} h`
    case 'elevation': return m.meanSunElevationDeg === null ? 'no Sun' : `${m.meanSunElevationDeg.toFixed(1)}°`
    default: return m.slopeDeg === null ? 'no data' : `${m.slopeDeg.toFixed(1)}° slope`
  }
}

// Display name of a scenario: curated site, saved place, or bare coordinates.
function scenarioName(siteId: string): string {
  const point = parsePointId(siteId)
  if (!point) return getSite(siteId).name
  const saved = getPlaces().find((p) => Math.abs(p.latDeg - point.latDeg) < 5e-5 && Math.abs(p.lonDeg - point.lonDeg) < 5e-5)
  return saved ? saved.name : pointName(point)
}

// All scenarios drawn on one radar so shape differences stand out.
function OverlayRadar({ rows }: { rows: { index: number; name: string; metrics: Metrics }[] }) {
  const size = 260
  const c = size / 2
  const r = 95
  const n = AXES.length
  const pt = (i: number, v: number): [number, number] => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180)
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)]
  }
  return (
    <section className="card-matte flex flex-wrap items-center gap-8 rounded-2xl p-5">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-64" role="img" aria-label="Radar chart of the compared scenarios">
        {[25, 50, 75, 100].map((ring) => (
          <polygon key={ring} points={AXES.map((_, i) => pt(i, ring).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        ))}
        {AXES.map((a, i) => {
          const [x, y] = pt(i, 100)
          const [lx, ly] = pt(i, 122)
          return (
            <g key={a.key}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" />
              <text x={lx} y={ly} fill="#a7abad" fontSize={9} textAnchor="middle" dominantBaseline="middle">{a.short}</text>
            </g>
          )
        })}
        {rows.map((row) => (
          <polygon
            key={row.index}
            points={AXES.map((a, i) => pt(i, row.metrics.axes[a.key] ?? 0).join(',')).join(' ')}
            fill={CARD_COLORS[row.index % CARD_COLORS.length]}
            fillOpacity={0.12}
            stroke={CARD_COLORS[row.index % CARD_COLORS.length]}
            strokeWidth={1.5}
            strokeDasharray={row.index === 1 ? '5 3' : row.index === 2 ? '2 3' : undefined}
          />
        ))}
      </svg>
      <div>
        <h2 className="text-base font-medium text-white">All five measures</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.index} className="flex items-center gap-3">
              <span aria-hidden className="h-0.5 w-6" style={{ background: CARD_COLORS[row.index % CARD_COLORS.length] }} />
              <span className="text-[#c0c0c0]">
                <span className="text-white">{row.index + 1}</span> · {row.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
