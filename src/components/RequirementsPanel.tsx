import { GREEN_FULL, GREEN_WEAK, type Criteria } from '../scene/requirements'

// Default values and their sources are documented in src/scene/requirements.ts.

type RequirementsPanelProps = {
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  criteria: Criteria
  onCriteriaChange: (criteria: Criteria) => void
  zoneSummary: { meets: number; total: number; cellKm: number } | null
  globalSummary: { meets: number; total: number; cellLabel: string; hasSlope: boolean } | null
}

const MEETS_COLOR = GREEN_FULL // always with a symbol and text

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
    </div>
  )
}

function Swatch({ background }: { background: string }) {
  return <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background }} aria-hidden />
}

// Criteria input (from the team sketch): Sun, Earth link and slope, applied to
// the curated sites, the south pole zones and the whole Moon for the selected
// arrival date and stay length.
export function RequirementsPanel({
  enabled,
  onEnabledChange,
  criteria,
  onCriteriaChange,
  zoneSummary,
  globalSummary,
}: RequirementsPanelProps) {
  const gradient = !criteria.sun.on || criteria.sun.minPercent < 100
  return (
    <div data-tour="requirements" className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#1c1e20] p-3 text-gray-100">
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
          />

          <ul className="flex flex-col gap-1 text-xs text-gray-300">
            <li className="flex gap-2">
              <Swatch background={GREEN_FULL} />
              Green: meets every requirement
            </li>
            {gradient && (
              <li className="flex gap-2">
                <Swatch background={`linear-gradient(to right, ${GREEN_FULL}, ${GREEN_WEAK})`} />
                Green to yellow: less Sun during the stay
              </li>
            )}
            <li className="flex gap-2">
              <Swatch background="#8a8a8a" />
              Gray: fails at least one
            </li>
          </ul>

          {(globalSummary || zoneSummary) && (
            <ul className="flex flex-col gap-0.5 text-xs text-gray-300">
              {globalSummary && (
                <li>
                  Whole Moon ({globalSummary.cellLabel}):{' '}
                  <span style={{ color: MEETS_COLOR }}>
                    ✓ {globalSummary.meets.toLocaleString('en-US')} of {globalSummary.total.toLocaleString('en-US')}
                  </span>{' '}
                  cells
                  {!globalSummary.hasSlope && ' (slope data missing)'}
                </li>
              )}
              {zoneSummary && (
                <li>
                  South pole ({zoneSummary.cellKm} km):{' '}
                  <span style={{ color: MEETS_COLOR }}>
                    ✓ {zoneSummary.meets.toLocaleString('en-US')} of {zoneSummary.total.toLocaleString('en-US')}
                  </span>{' '}
                  cells
                </li>
              )}
            </ul>
          )}

        </>
      )}
    </div>
  )
}
