import { useMemo } from 'react'
import { formatUtc } from '../scene/formatTime'
import { computeStay, MAX_STAY_DAYS, MIN_STAY_DAYS } from '../scene/stay'
import { indexForTime } from '../scene/timeSelection'
import type { HorizonProfile, SkySample } from '../types'

type StayPanelProps = {
  samples: SkySample[]
  horizon: HorizonProfile
  timeMs: number | null
  stayDays: number
  onStayDaysChange: (days: number) => void
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="font-medium">{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded bg-[#444]">
        <div className="h-1.5 rounded bg-[#4d8be8]" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// Stay: arrival = the selected date and time. Shows how much of the stay has
// the Sun (power) and the Earth (direct link) above the terrain.
export function StayPanel({ samples, horizon, timeMs, stayDays, onStayDaysChange }: StayPanelProps) {
  const arrivalIndex = indexForTime(samples, timeMs)
  const stay = useMemo(
    () => computeStay(samples, horizon, arrivalIndex, stayDays),
    [samples, horizon, arrivalIndex, stayDays],
  )

  return (
    <section className="flex flex-col gap-2">
      <label className="flex justify-between text-sm font-medium" htmlFor="stayDays">
        <span>Stay length</span>
        <span>{stayDays} days</span>
      </label>
      <input
        id="stayDays"
        type="range"
        min={MIN_STAY_DAYS}
        max={MAX_STAY_DAYS}
        step={0.5}
        value={stayDays}
        onChange={(e) => onStayDaysChange(Number(e.target.value))}
      />
      <ul className="list-disc pl-4 text-xs text-gray-300">
        <li>
          Longer stays make green less likely: the Sun must stay up the whole time.
        </li>
      </ul>
      <p className="truncate text-xs text-gray-300">
        {formatUtc(stay.arrivalMs).replace(' UTC', '')} → {formatUtc(stay.coveredEndMs)}
      </p>
      <Bar label="Stay with Sun" value={stay.sunPercent} />
      <Bar label="Stay with Earth link" value={stay.earthPercent} />
      {stay.truncated && (
        <p className="truncate text-xs text-[#E69F00]">
          Data ends: {stay.coveredDays.toFixed(1)} of {stay.requestedDays} days counted.
        </p>
      )}
    </section>
  )
}
