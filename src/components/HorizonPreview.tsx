import { useMemo } from 'react'
import type { SiteLight } from '../data/loadSiteData'
import { indexForTime } from '../scene/timeSelection'
import { bodyVisibility, horizonElevationAt } from '../scene/visibility'
import { StatusBadge } from './StatusBadge'

type HorizonPreviewProps = SiteLight & { timeMs: number | null }

const WIDTH = 360 // one unit per degree of azimuth
const HEIGHT = 100
const MARKER_RADIUS = 5

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
        <defs>
          <linearGradient id="previewTerrain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a8a8a8" />
            <stop offset="35%" stopColor="#5a5a5a" />
            <stop offset="100%" stopColor="#262626" />
          </linearGradient>
          <radialGradient id="previewSunGlow">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="previewEarth" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#9fd0ff" />
            <stop offset="100%" stopColor="#2a6fb8" />
          </radialGradient>
        </defs>
        {/* Bodies first: the terrain is drawn over them, so they hide behind it as in the 3D view. */}
        <circle cx={sample.sun.azimuthDeg} cy={y(sample.sun.elevationDeg)} r={MARKER_RADIUS * 2.6} fill="url(#previewSunGlow)" />
        <circle cx={sample.sun.azimuthDeg} cy={y(sample.sun.elevationDeg)} r={MARKER_RADIUS} fill="#fff" />
        <circle cx={sample.earth.azimuthDeg} cy={y(sample.earth.elevationDeg)} r={MARKER_RADIUS} fill="url(#previewEarth)" />
        <path d={terrainPath} fill="url(#previewTerrain)" stroke="#bdbdbd" strokeWidth={0.6} />
        {[0, 90, 180, 270].map((az, i) => (
          <text key={az} x={az === 0 ? 3 : az} y={9} fill="#888" fontSize={8} textAnchor={az === 0 ? 'start' : 'middle'}>
            {['N', 'E', 'S', 'W'][i]}
          </text>
        ))}
      </svg>
      <dl className="flex flex-col gap-0.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-gray-300">Sun</dt>
          <dd>
            <StatusBadge state={sun.state} fraction={sun.fraction} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-300">Earth</dt>
          <dd>
            <StatusBadge state={earth.state} fraction={earth.fraction} />
          </dd>
        </div>
      </dl>
    </div>
  )
}
