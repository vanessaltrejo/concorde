import { getSite } from '../data/sites'
import type { Criteria, SiteResult } from '../scene/requirements'

type RequirementsPanelProps = {
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  criteria: Criteria
  onCriteriaChange: (criteria: Criteria) => void
  results: SiteResult[] | null
  error: string | null
  stayDays: number
  zoneSummary: { meets: number; total: number; cellKm: number; minSlopeArea: number } | null
}

const MEETS_COLOR = '#009E73' // Okabe-Ito bluish green, always with a symbol and text

function Row({
  label,
  on,
  onToggle,
  value,
  min,
  max,
  step,
  unit,
  sign,
  onValue,
  note,
}: {
  label: string
  on: boolean
  onToggle: (on: boolean) => void
  value: number
  min: number
  max: number
  step: number
  unit: string
  sign: '≥' | '≤'
  onValue: (value: number) => void
  note: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} />
          {label}
        </span>
        <span className="text-xs text-gray-300">
          {sign} {value}
          {unit}
        </span>
      </label>
      <input
        type="range"
        aria-label={`${label} threshold`}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={!on}
        onChange={(e) => onValue(Number(e.target.value))}
      />
      <p className="text-[10px] text-gray-500">{note}</p>
    </div>
  )
}

// Criteria input (from the team sketch): Sun, Earth link and slope, applied to
// the curated sites for the selected arrival date and stay length.
export function RequirementsPanel({
  enabled,
  onEnabledChange,
  criteria,
  onCriteriaChange,
  results,
  error,
  stayDays,
  zoneSummary,
}: RequirementsPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#444] bg-[#303030]/95 p-3 text-gray-100">
      <label className="flex items-center justify-between text-sm font-medium">
        <span>Requirements</span>
        <span className="flex items-center gap-2 text-xs font-normal text-gray-300">
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
          Show on map
        </span>
      </label>

      {enabled && (
        <>
          <Row
            label="Sun during stay"
            on={criteria.sun.on}
            onToggle={(on) => onCriteriaChange({ ...criteria, sun: { ...criteria.sun, on } })}
            value={criteria.sun.minPercent}
            min={0}
            max={100}
            step={5}
            unit="%"
            sign="≥"
            onValue={(minPercent) => onCriteriaChange({ ...criteria, sun: { ...criteria.sun, minPercent } })}
            note="Default 100%: NASA Artemis lander requirement (team plan)."
          />
          <Row
            label="Earth link during stay"
            on={criteria.earth.on}
            onToggle={(on) => onCriteriaChange({ ...criteria, earth: { ...criteria.earth, on } })}
            value={criteria.earth.minPercent}
            min={0}
            max={100}
            step={5}
            unit="%"
            sign="≥"
            onValue={(minPercent) => onCriteriaChange({ ...criteria, earth: { ...criteria.earth, minPercent } })}
            note="Default 25%: team plan value, NASA origin not verified yet."
          />
          <Row
            label="Slope at the site"
            on={criteria.slope.on}
            onToggle={(on) => onCriteriaChange({ ...criteria, slope: { ...criteria.slope, on } })}
            value={criteria.slope.maxDeg}
            min={1}
            max={30}
            step={1}
            unit="°"
            sign="≤"
            onValue={(maxDeg) => onCriteriaChange({ ...criteria, slope: { ...criteria.slope, maxDeg } })}
            note="Default 10° (NASA Artemis, about 100 m scale). Polar sites use a 100 m baseline, Apollo sites about 355 m."
          />

          <p className="text-xs text-gray-400">
            For the selected arrival date and a {stayDays} day stay. Green = meets your requirements
            (screening only, not "safe"): rocks, small craters and dust are not in the data.
          </p>

          {zoneSummary && (
            <p className="text-xs text-gray-300">
              Zones (south pole, 50 × 50 km, {zoneSummary.cellKm} km cells):{' '}
              <span style={{ color: MEETS_COLOR }}>
                ✓ {zoneSummary.meets} of {zoneSummary.total}
              </span>{' '}
              cells meet. A cell passes slope when at least {zoneSummary.minSlopeArea}% of its area is under the
              limit (100 m baseline). Click a cell for its values.
            </p>
          )}
          {error && <p className="text-xs text-gray-400">{error}</p>}
          {!results && !error && <p className="text-xs text-gray-400">Checking sites…</p>}
          {results && (
            <ul className="flex flex-col gap-1 text-xs">
              {results.map((r) => (
                <li key={r.siteId} className="flex flex-col">
                  <span className="font-medium" style={{ color: r.meets ? MEETS_COLOR : '#9a9a9a' }}>
                    {r.meets ? '✓' : '✕'} {getSite(r.siteId).name}
                  </span>
                  <span className="text-gray-400">
                    Sun {r.sunPercent.toFixed(0)}%{r.passes.sun ? '' : ' ✕'} · Earth {r.earthPercent.toFixed(0)}%
                    {r.passes.earth ? '' : ' ✕'} · Slope{' '}
                    {r.slope ? `${r.slope.slopeDeg.toFixed(1)}° (${r.slope.baselineM} m)` : 'n/a'}
                    {r.passes.slope ? '' : ' ✕'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
