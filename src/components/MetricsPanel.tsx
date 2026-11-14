import type { SkySample, Visibility } from '../types'
import type { BodyVisibility } from '../scene/visibility'

type MetricsPanelProps = {
  sample: SkySample
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
}

type MetricRowProps = {
  label: string
  value: string
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

const stateLabels: Record<Visibility, string> = {
  visible: 'Visible',
  partial: 'Partly hidden',
  hidden: 'Hidden',
}

function stateText({ state, fraction }: BodyVisibility): string {
  if (state === 'partial') return `${stateLabels[state]} (${Math.round(fraction * 100)}% of disc)`
  return stateLabels[state]
}

function degrees(value: number): string {
  return `${value.toFixed(2)}°`
}

export function MetricsPanel({ sample, sunVisibility, earthVisibility }: MetricsPanelProps) {
  const { sun, earth } = sample

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Sun (power)</h2>
        <dl className="flex flex-col gap-1">
          <MetricRow label="Status" value={stateText(sunVisibility)} />
          <MetricRow label="Elevation" value={degrees(sun.elevationDeg)} />
          <MetricRow label="Terrain horizon there" value={degrees(sunVisibility.horizonDeg)} />
          <MetricRow label="Azimuth" value={degrees(sun.azimuthDeg)} />
        </dl>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Earth (direct link)</h2>
        <dl className="flex flex-col gap-1">
          <MetricRow label="Status" value={stateText(earthVisibility)} />
          <MetricRow label="Elevation" value={degrees(earth.elevationDeg)} />
          <MetricRow label="Terrain horizon there" value={degrees(earthVisibility.horizonDeg)} />
          <MetricRow label="Azimuth" value={degrees(earth.azimuthDeg)} />
          <MetricRow label="Lit fraction" value={`${sample.earthIlluminatedPct.toFixed(0)}%`} />
        </dl>
      </div>
      <p className="text-xs text-gray-400">
        Sun and Earth: JPL Horizons. Horizon: LOLA 20 m terrain up to 200 km. A body is partly
        hidden when terrain covers part of its disc.
      </p>
    </section>
  )
}
