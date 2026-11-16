import { useState } from 'react'
import { addScenario, MAX_SCENARIOS, removeScenario, type Scenario } from '../state/scenarios'
import { formatCoords, lastEdited, renamePlace, usePlaces, type Place } from '../state/places'

// Compare page: the saved points as a list (after the Google Earth projects
// table). Tick a point to put it in the comparison; pencil or double-click to
// rename; "Add point" picks a new one on the globe and comes back here.

const pointId = (p: Place) => `point:${p.latDeg.toFixed(4)},${p.lonDeg.toFixed(4)}`
const COLS = 'grid grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function SavedPointsTable({ scenarios, onAddPoint }: { scenarios: Scenario[]; onAddPoint: () => void }) {
  const places = usePlaces()
  const sorted = [...places].sort((a, b) => lastEdited(b).localeCompare(lastEdited(a)))
  const full = scenarios.length >= MAX_SCENARIOS

  return (
    <section data-tour="compare-add" className="card-matte overflow-hidden rounded-2xl">
      <h2 className="px-5 pt-4 pb-3 text-base font-medium text-white">Saved points</h2>
      <div className={COLS + ' border-y border-white/[0.08] px-5 py-2 text-xs font-medium text-[#a7abad]'}>
        <span>
          <span className="sr-only">In comparison</span>
        </span>
        <span>Name</span>
        <span>Last edited ↓</span>
        <span className="flex items-center justify-between gap-2">
          Coordinates
          <button type="button" onClick={onAddPoint} className="btn-outline px-2.5 py-1 text-[11px] font-medium" title="Pick a point on the globe">
            + Add point
          </button>
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[#8f9396]">No saved points</p>
      ) : (
        <ul>
          {sorted.map((p) => (
            <Row key={p.id} place={p} scenarios={scenarios} full={full} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ place, scenarios, full }: { place: Place; scenarios: Scenario[]; full: boolean }) {
  const id = pointId(place)
  const inCompare = scenarios.filter((s) => s.siteId === id)
  const checked = inCompare.length > 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(place.name)

  function toggle() {
    if (checked) inCompare.forEach((s) => removeScenario(s.id))
    else if (!full) addScenario(id, null)
  }
  function save() {
    renamePlace(place.id, draft)
    setEditing(false)
  }

  return (
    <li className={COLS + ' border-b border-white/[0.06] px-5 py-2.5 last:border-0 hover:bg-white/[0.03]'}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!checked && full}
        onChange={toggle}
        aria-label={`${checked ? 'Remove' : 'Add'} ${place.name} ${checked ? 'from' : 'to'} the comparison`}
        title={!checked && full ? `Compare holds ${MAX_SCENARIOS}: untick one first` : undefined}
        className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
      />
      <span className="flex min-w-0 items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b0bec5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setDraft(place.name)
                setEditing(false)
              }
            }}
            aria-label="Point name"
            className="min-w-0 flex-1 border border-white/30 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-white/60"
          />
        ) : (
          <>
            <span className="truncate text-sm text-white" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
              {place.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setDraft(place.name)
                setEditing(true)
              }}
              aria-label={`Rename ${place.name}`}
              title="Rename"
              className="shrink-0 p-1 text-[#8f9396] hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
              </svg>
            </button>
          </>
        )}
      </span>
      <span className="text-sm text-[#c0c0c0]">{formatDate(lastEdited(place))}</span>
      <span className="truncate font-mono text-[13px] text-[#c0c0c0]">{formatCoords(place.latDeg, place.lonDeg)}</span>
    </li>
  )
}
