import type { TimingMetrics } from '../scene/timing'
import { formatUtcDay } from '../scene/formatTime'

type PeriodSummaryProps = {
  timing: TimingMetrics
}

function PercentRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="font-medium">{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded bg-white/10">
        <div className="h-1.5 rounded bg-[#4d8be8]" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// Share of the data period with the Sun or Earth at least partly visible.
export function PeriodSummary({ timing }: PeriodSummaryProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">
        Period {formatUtcDay(timing.periodStartMs)} – {formatUtcDay(timing.periodEndMs)}
      </h2>
      <PercentRow label="Time with Sun" value={timing.sunPercent} />
      <PercentRow label="Time with Earth link" value={timing.earthPercent} />
    </section>
  )
}
