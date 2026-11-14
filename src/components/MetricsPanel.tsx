import type { SkySample, SkyPosition } from '../types'

type MetricsPanelProps = {
  sample: SkySample
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

// Placeholder rule (flat horizon). The real check against the horizon
// profile comes in Step 6.
function visibilityLabel(position: SkyPosition): string {
  return position.elevationDeg > 0 ? 'Visible' : 'Hidden'
}

export function MetricsPanel({ sample }: MetricsPanelProps) {
  const { sun, earth } = sample

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">Metrics</h2>
      <dl className="flex flex-col gap-1">
        <MetricRow label="Sun azimuth" value={`${sun.azimuthDeg.toFixed(2)}°`} />
        <MetricRow label="Sun elevation" value={`${sun.elevationDeg.toFixed(2)}°`} />
        <MetricRow label="Earth azimuth" value={`${earth.azimuthDeg.toFixed(2)}°`} />
        <MetricRow label="Earth elevation" value={`${earth.elevationDeg.toFixed(2)}°`} />
        <MetricRow label="Sun" value={visibilityLabel(sun)} />
        <MetricRow label="Earth" value={visibilityLabel(earth)} />
        <MetricRow label="Earth lit fraction" value={`${sample.earthIlluminatedPct.toFixed(0)}%`} />
      </dl>
      <p className="text-xs text-gray-400">
        Sun and Earth from JPL Horizons. Visibility uses a flat horizon for now (no terrain).
      </p>
    </section>
  )
}
