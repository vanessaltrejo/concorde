import { useEffect, useMemo, useState } from 'react'
import { SITES, getSite } from '../data/sites'
import { loadSiteLight, type SiteLight } from '../data/loadSiteData'
import { loadSiteSlopes, type SiteSlope } from '../scene/requirements'
import { AXES, GOALS, computeMetrics, scoreFor, whyWinner, type GoalId, type Metrics } from '../scene/compare'
import { addDateVariant, addScenario, MAX_SCENARIOS, moveScenario, removeScenario, setScenarioOrder, updateScenario, useScenarios, type Scenario } from '../state/scenarios'
import { HorizonPreview } from './HorizonPreview'
import { MissionList } from './MissionList'

// Colors per card (red is kept for small highlights only); cards are also told apart by number and line style.
const CARD_COLORS = ['#0B3D91', '#1f7ae0', '#0e8f7e']

type Props = { stayDays: number; fallbackTimeMs: number | null }

type Loaded = { lights: Record<string, SiteLight>; slopes: Record<string, SiteSlope>; failed: string[] }

export function CompareTab({ stayDays, fallbackTimeMs }: Props) {
  const scenarios = useScenarios()
  const [goalId, setGoalId] = useState<GoalId>('power')
  const [data, setData] = useState<Loaded>({ lights: {}, slopes: {}, failed: [] })

  const siteIds = useMemo(() => [...new Set(scenarios.map((s) => s.siteId))], [scenarios])
  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadSiteSlopes().catch(() => ({}) as Record<string, SiteSlope>),
      ...siteIds.map((id) => loadSiteLight(id).then((l) => [id, l] as const).catch(() => [id, null] as const)),
    ]).then(([slopes, ...pairs]) => {
      if (cancelled) return
      const lights: Record<string, SiteLight> = {}
      const failed: string[] = []
      for (const [id, l] of pairs) (l ? (lights[id] = l) : failed.push(id))
      setData({ lights, slopes: slopes as Record<string, SiteSlope>, failed })
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
    <div className="flex h-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#05070d] p-4 text-gray-100">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <span aria-hidden className="h-5 w-1 rounded-sm bg-[var(--nasa-red)]" />
            Compare sites
          </h1>
          <p className="text-xs text-gray-400">
            Up to {MAX_SCENARIOS} scenarios (site + arrival date). Stay length: {stayDays} days. Screening only, not flight grade.
          </p>
        </div>
        <div role="radiogroup" aria-label="Goal" className="flex flex-wrap gap-1.5">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={g.id === goalId}
              title={g.blurb}
              onClick={() => setGoalId(g.id)}
              className={
                'rounded-full border px-3 py-1 text-xs transition-colors ' +
                (g.id === goalId
                  ? 'border-[var(--nasa-blue)] bg-[var(--nasa-blue)] text-white'
                  : 'border-[#3a4560] text-gray-200 hover:border-white')
              }
            >
              {g.label}
            </button>
          ))}
        </div>
      </header>

      {winner?.metrics && (
        <p className="rounded-lg border border-[#22304f] bg-[#0b1226] px-3 py-2 text-sm">
          <span className="text-gray-400">Model suggestion for {goal.label}: </span>
          <strong>{getSite(winner.sc.siteId).name}</strong>
          <span className="text-gray-400"> ({dateLabel(winner.sc, winner.light)})</span>
          {why.length > 0 && second ? (
            <span className="text-gray-300">
              {' '}
              leads on {why.map((k) => AXES.find((a) => a.key === k)?.short.toLowerCase()).join(' and ')} over {getSite(second.sc.siteId).name}.
            </span>
          ) : (
            <span className="text-gray-300"> {ranked.length === 1 ? '— add another scenario to compare.' : 'is a close call: scores are nearly equal.'}</span>
          )}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
        <p>Drag a card to set <strong className="text-gray-200">your</strong> order: 1st, 2nd, 3rd. The model suggestion is separate.</p>
        {ranked.length >= 2 && (
          <button
            type="button"
            onClick={() => setScenarioOrder([...ranked.map((r) => r.sc.id), ...rows.filter((r) => !r.metrics).map((r) => r.sc.id)])}
            className="shrink-0 rounded border border-[#3a4560] px-2 py-1 text-gray-200 hover:border-white"
          >
            Order by model suggestion
          </button>
        )}
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
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
        {scenarios.length < MAX_SCENARIOS && <AddSlot />}
      </div>

      {ranked.length >= 2 && <OverlayRadar rows={ranked.map((r) => ({ index: r.i, name: getSite(r.sc.siteId).name, metrics: r.metrics! }))} />}
    </div>
  )
}

const ordinal = (i: number) => ['1st', '2nd', '3rd'][i] ?? `${i + 1}th`

function dateLabel(sc: Scenario, light: SiteLight | undefined): string {
  const ms = sc.timeMs ?? (light ? Date.parse(light.sky.samples[0].timeUtc) : null)
  return ms === null ? 'first date' : new Date(ms).toISOString().slice(0, 10)
}

type Row = { sc: Scenario; i: number; light: SiteLight | undefined; metrics: Metrics | null; score: number | null }

function Card({ index, row, rank, allMetrics, fallbackTimeMs, loadingFailed }: { index: number; row: Row; rank: number; allMetrics: (Metrics | null)[]; fallbackTimeMs: number | null; loadingFailed: boolean }) {
  const { sc, light, metrics, score } = row
  const [over, setOver] = useState(false)
  const site = getSite(sc.siteId)
  const color = CARD_COLORS[index % CARD_COLORS.length]
  const first = light ? Date.parse(light.sky.samples[0].timeUtc) : 0
  const last = light ? Date.parse(light.sky.samples[light.sky.samples.length - 1].timeUtc) : 0
  const toInput = (ms: number) => new Date(ms).toISOString().slice(0, 16)
  const value = sc.timeMs ?? first

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
      className={
        'flex cursor-grab flex-col overflow-hidden rounded-xl border bg-[#303030] text-gray-100 shadow-lg active:cursor-grabbing ' +
        (over ? 'border-white ring-2 ring-white' : 'border-[#444]')
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-white" style={{ background: color }}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span aria-hidden className="rounded-full bg-[#303030] px-1.5 py-0.5 text-[11px] font-bold" style={{ color }} title="Your order (drag to change)">
            {ordinal(index)}
          </span>
          {site.name}
        </h2>
        <button type="button" onClick={() => removeScenario(sc.id)} aria-label={`Remove ${site.name}`} className="text-lg leading-none text-white/80 hover:text-white">
          ×
        </button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <label className="flex flex-col gap-0.5 text-xs text-gray-300">
          Arrival (UTC)
          <input
            type="datetime-local"
            value={toInput(value)}
            min={light ? toInput(first) : undefined}
            max={light ? toInput(last) : undefined}
            onChange={(e) => {
              const ms = Date.parse(`${e.target.value}Z`)
              if (!Number.isNaN(ms)) updateScenario(sc.id, { timeMs: ms })
            }}
            className="rounded border border-[#555] bg-[#262626] px-2 py-1 text-sm text-gray-100 [color-scheme:dark]"
          />
        </label>

        {loadingFailed && <p className="text-xs text-[#F0793A]">No data for this site yet.</p>}
        {!light && !loadingFailed && <p className="text-xs text-gray-300">Loading…</p>}

        {metrics && light && (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-semibold leading-none" style={{ color: color === '#0B3D91' ? '#7fb0ff' : color }}>
                  {Math.round(score ?? 0)}
                </p>
                <p className="text-[11px] text-gray-300">goal score / 100</p>
              </div>
              {rank === 0 && (
                <span className="rounded border border-[#7fb0ff] px-1.5 py-0.5 text-[10px] font-medium text-[#7fb0ff]" title="Highest score for the chosen goal. Independent of your 1st/2nd/3rd order.">
                  Model suggestion
                </span>
              )}
              <span className={'rounded px-2 py-0.5 text-[11px] font-medium ' + (metrics.meetsDefaults ? 'bg-[#0B3D91]/50 text-[#9cc0ff]' : 'bg-[#3a3a3a] text-gray-300')}>
                {metrics.meetsDefaults ? '✓ meets default requirements' : '– misses a default requirement'}
              </span>
            </div>

            <HorizonPreview sky={light.sky} horizon={light.horizon} timeMs={sc.timeMs} />

            <ul className="flex flex-col gap-1.5">
              {AXES.map(({ key, label }) => {
                const v = metrics.axes[key]
                const best = v !== null && allMetrics.every((m) => !m || m.axes[key] === null || (m.axes[key] as number) <= v)
                return (
                  <li key={key}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-gray-300">{label}</span>
                      <span className={best && allMetrics.filter(Boolean).length > 1 ? 'font-semibold text-[#7fb0ff]' : 'text-gray-100'}>
                        {best && allMetrics.filter(Boolean).length > 1 ? '★ ' : ''}
                        {axisText(key, metrics)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded bg-[#444]">
                      <div className="h-1.5 rounded" style={{ width: `${v ?? 0}%`, background: color }} />
                    </div>
                  </li>
                )
              })}
            </ul>
            {metrics.truncated && <p className="text-[11px] text-[#E69F00]">The stay runs past the end of the data ({metrics.coveredDays.toFixed(1)} days counted).</p>}
            {metrics.slopeDeg === null && <p className="text-[11px] text-gray-300">No slope data for this site yet: flatness is left out of the score.</p>}
            <MissionList site={site} />
            <button
              type="button"
              disabled={false}
              onClick={() => addDateVariant(sc, fallbackTimeMs ?? first)}
              className="rounded border border-[#555] px-2 py-1 text-xs hover:bg-[var(--nasa-blue)] hover:text-white"
            >
              + Same site, 7 days later
            </button>
          </>
        )}
      </div>
    </article>
  )
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

function AddSlot() {
  const options = SITES.filter((s) => s.hasSkyData)
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#3a4560] p-4 text-center text-sm text-gray-300">
      <p>Add a scenario</p>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) addScenario(e.target.value, null)
          e.target.value = ''
        }}
        className="rounded border border-[#555] bg-[#262626] px-2 py-1 text-sm text-gray-100 [color-scheme:dark]"
        aria-label="Add a site to compare"
      >
        <option value="">Choose a site…</option>
        {[...new Set(options.map((s) => s.group))].map((g) => (
          <optgroup key={g} label={g}>
            {options.filter((s) => s.group === g).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="text-[11px] text-gray-400">Or press “Compare” on any site in the other tabs.</p>
    </div>
  )
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
    <section className="flex flex-wrap items-center justify-center gap-6 rounded-xl border border-[#22304f] bg-[#0b1226] p-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-64" role="img" aria-label="Radar chart of the compared scenarios">
        {[25, 50, 75, 100].map((ring) => (
          <polygon key={ring} points={AXES.map((_, i) => pt(i, ring).join(',')).join(' ')} fill="none" stroke="#2a3552" strokeWidth={1} />
        ))}
        {AXES.map((a, i) => {
          const [x, y] = pt(i, 100)
          const [lx, ly] = pt(i, 122)
          return (
            <g key={a.key}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="#2a3552" />
              <text x={lx} y={ly} fill="#cbd2e1" fontSize={9} textAnchor="middle" dominantBaseline="middle">{a.short}</text>
            </g>
          )
        })}
        {rows.map((row) => (
          <polygon
            key={row.index}
            points={AXES.map((a, i) => pt(i, row.metrics.axes[a.key] ?? 0).join(',')).join(' ')}
            fill={CARD_COLORS[row.index % CARD_COLORS.length]}
            fillOpacity={0.25}
            stroke={CARD_COLORS[row.index % CARD_COLORS.length]}
            strokeWidth={2}
            strokeDasharray={row.index === 1 ? '5 3' : row.index === 2 ? '2 3' : undefined}
          />
        ))}
      </svg>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((row) => (
          <li key={row.index} className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: CARD_COLORS[row.index % CARD_COLORS.length] }} />
            <span className="font-medium">{ordinal(row.index)} · {row.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
