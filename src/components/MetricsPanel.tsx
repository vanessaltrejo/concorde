import type { SkySample } from '../types'
import type { BodyVisibility } from '../scene/visibility'
import { formatDuration, formatUtc } from '../scene/formatTime'
import { StatusBadge } from './StatusBadge'
import type { NextTransition } from '../scene/windows'

type MetricsPanelProps = {
  sample: SkySample
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
  sunNext: NextTransition
  earthNext: NextTransition
  // "LOLA 20 m terrain up to 200 km", from the site's own data.
  terrainNote: string
}

type MetricRowProps = {
  label: string
  value: string
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function StatusRow({ visibility }: { visibility: BodyVisibility }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-400">Status</dt>
      <dd>
        <StatusBadge state={visibility.state} fraction={visibility.fraction} />
      </dd>
    </div>
  )
}

function transitionLabel(body: 'Sun' | 'Earth', next: NextTransition): string {
  return `${body}${next.kind === 'set' ? 'set' : 'rise'} in`
}

function transitionValue(next: NextTransition): string {
  if (!next.found) return `> ${formatDuration(next.afterMs)} (end of data)`
  return `${formatDuration(next.inMs)}`
}

function transitionTime(next: NextTransition): string | null {
  return next.found ? formatUtc(next.timeMs) : null
}

function TransitionRow({ body, next }: { body: 'Sun' | 'Earth'; next: NextTransition }) {
  const at = transitionTime(next)
  return (
    <div className="flex flex-col">
      <MetricRow label={transitionLabel(body, next)} value={transitionValue(next)} />
      {at && <p className="text-right text-xs text-gray-500">{at}</p>}
    </div>
  )
}

function degrees(value: number): string {
  return `${value.toFixed(2)}°`
}

export function MetricsPanel({
  sample,
  sunVisibility,
  earthVisibility,
  sunNext,
  earthNext,
  terrainNote,
}: MetricsPanelProps) {
  const { sun, earth } = sample

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Sun (power)</h2>
        <dl className="flex flex-col gap-1">
          <StatusRow visibility={sunVisibility} />
          <TransitionRow body="Sun" next={sunNext} />
          <MetricRow label="Elevation" value={degrees(sun.elevationDeg)} />
          <MetricRow label="Terrain horizon there" value={degrees(sunVisibility.horizonDeg)} />
          <MetricRow label="Azimuth" value={degrees(sun.azimuthDeg)} />
        </dl>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Earth (direct link)</h2>
        <dl className="flex flex-col gap-1">
          <StatusRow visibility={earthVisibility} />
          <TransitionRow body="Earth" next={earthNext} />
          <MetricRow label="Elevation" value={degrees(earth.elevationDeg)} />
          <MetricRow label="Terrain horizon there" value={degrees(earthVisibility.horizonDeg)} />
          <MetricRow label="Azimuth" value={degrees(earth.azimuthDeg)} />
          <MetricRow label="Lit fraction" value={`${sample.earthIlluminatedPct.toFixed(0)}%`} />
        </dl>
      </div>
      <p className="text-xs text-gray-400">
        Sun and Earth: JPL Horizons. Horizon: {terrainNote}. A body is partly
        hidden when terrain covers part of its disc. Set and rise times use the same rule (set =
        no part visible), interpolated between hourly samples.
      </p>
    </section>
  )
}
