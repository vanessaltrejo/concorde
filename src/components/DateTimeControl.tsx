import type { SkySample } from '../types'

type DateTimeControlProps = {
  samples: SkySample[]
  index: number
  onIndexChange: (index: number) => void
}

// The input shows UTC. We format and parse the string by hand so the
// browser time zone is never applied.
function toInputValue(timeUtc: string): string {
  return timeUtc.slice(0, 16)
}

function findNearestIndex(samples: SkySample[], inputValue: string): number {
  const target = Date.parse(`${inputValue}:00Z`)
  if (Number.isNaN(target)) return 0

  let bestIndex = 0
  let bestDiff = Infinity
  samples.forEach((sample, i) => {
    const diff = Math.abs(Date.parse(sample.timeUtc) - target)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = i
    }
  })
  return bestIndex
}

export function DateTimeControl({
  samples,
  index,
  onIndexChange,
}: DateTimeControlProps) {
  const current = samples[index]

  return (
    <section className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor="dateTimeUtc">
        Date and time (UTC)
      </label>
      <input
        id="dateTimeUtc"
        type="datetime-local"
        className="rounded border border-[#555] bg-[#262626] px-2 py-1 text-sm [color-scheme:dark]"
        value={toInputValue(current.timeUtc)}
        min={toInputValue(samples[0].timeUtc)}
        max={toInputValue(samples[samples.length - 1].timeUtc)}
        onChange={(e) => onIndexChange(findNearestIndex(samples, e.target.value))}
      />
      <input
        type="range"
        aria-label="Time slider"
        min={0}
        max={samples.length - 1}
        step={1}
        value={index}
        onChange={(e) => onIndexChange(Number(e.target.value))}
      />
    </section>
  )
}
