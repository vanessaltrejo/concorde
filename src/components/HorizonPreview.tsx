import { useMemo } from 'react'
import type { SiteLight } from '../data/loadSiteData'
import { indexForTime } from '../scene/timeSelection'
import { bodyVisibility, horizonElevationAt } from '../scene/visibility'
import { StatusBadge } from './StatusBadge'

type HorizonPreviewProps = SiteLight & { timeMs: number | null }

const WIDTH = 360 // one unit per degree of azimuth
const HEIGHT = 100
const MARKER_RADIUS = 5
const EARTH_COLOR = '#56B4E9'

type Range = { min: number; max: number }

// Elevation range of the drawing, from the whole period so it does not jump
// while the date changes.
function elevationRange({ sky, horizon }: SiteLight): Range {
  let min = Math.min(...horizon.elevationDeg)
  let max = Math.max(...horizon.elevationDeg)
  for (const sample of sky.samples) {
    min = Math.min(min, sample.sun.elevationDeg, sample.earth.elevationDeg)
    max = Math.max(max, sample.sun.elevationDeg, sample.earth.elevationDeg)
  }
  return { min: min - 0.5, max: max + 0.5 }
}

function toY(range: Range, elevationDeg: number): number {
  return (HEIGHT * (range.max - elevationDeg)) / (range.max - range.min)
}

// Small flat drawing of the real horizon (azimuth 0 to 360) with the Sun and
// the Earth at the chosen time. A preview of the Horizon view, from the same data.
export function HorizonPreview({ sky, horizon, timeMs }: HorizonPreviewProps) {
  const range = useMemo(() => elevationRange({ sky, horizon }), [sky, horizon])
  const sample = sky.samples[indexForTime(sky.samples, timeMs)]
  const sun = bodyVisibility(sample.sun, horizon)
  const earth = bodyVisibility(sample.earth, horizon)

  const y = (elevationDeg: number) => toY(range, elevationDeg)

  const terrainPath = useMemo(() => {
    let d = `M0,${HEIGHT}`
    for (let az = 0; az <= 360; az += 1) d += ` L${az},${toY(range, horizonElevationAt(horizon, az)).toFixed(1)}`
    return `${d} L${WIDTH},${HEIGHT} Z`
  }, [horizon, range])

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full rounded bg-black"
        role="img"
        aria-label={`Horizon preview. Sun ${sun.state}, Earth ${earth.state}.`}
      >
        <path d={terrainPath} fill="#4a4a4a" stroke="#9a9a9a" strokeWidth={0.8} />
        {[0, 90, 180, 270].map((az, i) => (
          <text key={az} x={az === 0 ? 3 : az} y={HEIGHT - 3} fill="#bbb" fontSize={9} textAnchor={az === 0 ? 'start' : 'middle'}>
            {['N', 'E', 'S', 'W'][i]}
          </text>
        ))}
        <circle
          cx={sample.sun.azimuthDeg}
          cy={y(sample.sun.elevationDeg)}
          r={MARKER_RADIUS}
          fill={sun.state === 'hidden' ? 'none' : '#fff'}
          stroke="#fff"
          strokeWidth={1.5}
        />
        <circle
          cx={sample.earth.azimuthDeg}
          cy={y(sample.earth.elevationDeg)}
          r={MARKER_RADIUS - 1}
          fill={earth.state === 'hidden' ? 'none' : EARTH_COLOR}
          stroke={EARTH_COLOR}
          strokeWidth={1.5}
        />
      </svg>
      <dl className="flex flex-col gap-0.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-gray-400">Sun (white)</dt>
          <dd>
            <StatusBadge state={sun.state} fraction={sun.fraction} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Earth (blue)</dt>
          <dd>
            <StatusBadge state={earth.state} fraction={earth.fraction} />
          </dd>
        </div>
      </dl>
      <p className="text-[10px] text-gray-500">
        Markers are not to scale (the Sun is 0.5° wide, the Earth 1.8°). Hollow = hidden by terrain.
      </p>
    </div>
  )
}
