import type { BodyVisibility } from '../scene/visibility'
import { formatDuration, formatUtc } from '../scene/formatTime'
import { StatusBadge } from './StatusBadge'
import type { NextTransition } from '../scene/windows'

type MetricsPanelProps = {
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
  sunNext: NextTransition
  earthNext: NextTransition
}

function transitionLabel(body: 'Sun' | 'Earth', next: NextTransition): string {
  return `${body} ${next.kind === 'set' ? 'sets' : 'rises'} in`
}

function transitionValue(next: NextTransition): string {
  if (!next.found) return `> ${formatDuration(next.afterMs)} (end of data)`
  return `${formatDuration(next.inMs)}`
}

// One card per body: its name and what it is for, a clear status, and the next
// change (when it sets or rises) in plain words.
function BodyCard({
  body,
  role,
  color,
  visibility,
  next,
}: {
  body: 'Sun' | 'Earth'
  role: string
  color: string
  visibility: BodyVisibility
  next: NextTransition
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/[0.08] bg-[#121314] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: color }} />
          {body} <span className="font-normal text-gray-400">· {role}</span>
        </h2>
        <StatusBadge state={visibility.state} fraction={visibility.fraction} />
      </div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-gray-300">{transitionLabel(body, next)}</span>
        <span className="font-medium">{transitionValue(next)}</span>
      </div>
      {next.found && <p className="text-right text-xs text-gray-400">{formatUtc(next.timeMs)}</p>}
    </div>
  )
}

export function MetricsPanel({ sunVisibility, earthVisibility, sunNext, earthNext }: MetricsPanelProps) {
  return (
    <section className="flex flex-col gap-2">
      <BodyCard body="Sun" role="power" color="#FFD400" visibility={sunVisibility} next={sunNext} />
      <BodyCard body="Earth" role="direct link" color="#56B4E9" visibility={earthVisibility} next={earthNext} />
    </section>
  )
}
