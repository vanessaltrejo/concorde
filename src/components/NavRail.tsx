import { useState, type ReactNode } from 'react'
import { formatCoords, removePlace, renamePlace, usePlaces, type Place } from '../state/places'

export type TabId = 'orbital' | 'horizon' | 'dashboard' | 'compare' | 'educational' | 'references'

type Tab = { id: TabId; label: string; icon: ReactNode }

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const small = { ...iconProps, width: 15, height: 15 }

const tabs: Tab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    id: 'orbital',
    label: 'Orbital view',
    icon: (
      <svg {...iconProps}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
      </svg>
    ),
  },
  {
    id: 'horizon',
    label: 'Horizon view',
    icon: (
      <svg {...iconProps}>
        <path d="M2 20l6.5-11 4 6.5 2.5-3.5L22 20z" />
        <path d="M8.5 9l1.8 3" />
      </svg>
    ),
  },
  {
    id: 'compare',
    label: 'Compare',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="8" height="14" rx="1.5" />
        <rect x="13" y="5" width="8" height="14" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'educational',
    label: 'Educational',
    icon: (
      <svg {...iconProps}>
        <rect x="2.5" y="7" width="19" height="11" rx="5" />
        <path d="M7.5 10.5v4M5.5 12.5h4" />
        <circle cx="15.5" cy="11.5" r="1" />
        <circle cx="18" cy="14" r="1" />
      </svg>
    ),
  },
]

// Sits at the bottom of the rail, just above Profile.
const referencesTab: Tab = {
  id: 'references',
  label: 'References',
  icon: (
    <svg {...iconProps}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 21V5M8 7h7M8 11h5" />
    </svg>
  ),
}

type NavRailProps = {
  active: TabId
  onChange: (tab: TabId) => void
  // A saved place was clicked: show it on the Orbital view.
  onOpenPlace: (place: Place) => void
}

// Left rail: the main tabs (icon with its name below) and the saved places
// (pins dropped on the Orbital view). Collapses to icons only.
export function NavRail({ active, onChange, onOpenPlace }: NavRailProps) {
  const [expanded, setExpanded] = useState(true)
  const [placesOpen, setPlacesOpen] = useState(true)
  const places = usePlaces()

  return (
    <nav
      aria-label="Main navigation"
      className={
        'flex shrink-0 flex-col gap-1 border-r border-[#444] bg-[#262626] py-2 transition-[width] ' +
        (expanded ? 'w-52' : 'w-[4.5rem]')
      }
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Collapse the side panel' : 'Expand the side panel'}
        title={expanded ? 'Collapse' : 'Expand'}
        className={'mx-2 mb-1 flex h-7 items-center rounded text-gray-400 hover:bg-[#333] hover:text-white ' + (expanded ? 'justify-end px-2' : 'justify-center')}
      >
        <svg {...small}>{expanded ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}</svg>
      </button>

      <div className={expanded ? 'grid grid-cols-2 gap-1 px-2' : 'flex flex-col items-center gap-1 px-1'}>
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              title={tab.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(tab.id)}
              className={
                'relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors ' +
                (isActive ? 'bg-[var(--nasa-blue)] text-white' : 'text-gray-400 hover:bg-[#333] hover:text-white')
              }
            >
              {isActive && <span aria-hidden className="absolute left-0 top-2 h-6 w-[3px] rounded-r bg-[var(--nasa-red)]" />}
              {tab.icon}
              <span className="text-center text-[10px] leading-tight">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {expanded ? (
        <section className="mt-3 flex min-h-0 flex-1 flex-col border-t border-[#3a3a3a] pt-2">
          <button
            type="button"
            onClick={() => setPlacesOpen((o) => !o)}
            aria-expanded={placesOpen}
            className="mx-2 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-200"
          >
            Saved places
            <svg {...small} width={12} height={12} className={placesOpen ? '' : '-rotate-90'}>
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span className="ml-auto text-[10px] font-normal text-gray-500">{places.length}</span>
          </button>
          {placesOpen && (
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
              {places.length === 0 && (
                <li className="px-2 py-1 text-[11px] leading-snug text-gray-500">
                  No saved points yet. Click the Moon on the Orbital view, then “Save point”.
                </li>
              )}
              {places.map((place) => (
                <PlaceRow key={place.id} place={place} onOpen={() => onOpenPlace(place)} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="flex-1" />
      )}

      <div className={expanded ? 'grid grid-cols-2 gap-1 px-2' : 'flex flex-col items-center gap-1 px-1'}>
        <button
          type="button"
          title={referencesTab.label}
          aria-current={active === 'references' ? 'page' : undefined}
          onClick={() => onChange('references')}
          className={
            'relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors ' +
            (active === 'references' ? 'bg-[var(--nasa-blue)] text-white' : 'text-gray-400 hover:bg-[#333] hover:text-white')
          }
        >
          {active === 'references' && <span aria-hidden className="absolute left-0 top-2 h-6 w-[3px] rounded-r bg-[var(--nasa-red)]" />}
          {referencesTab.icon}
          <span className="text-center text-[10px] leading-tight">{referencesTab.label}</span>
        </button>
        <button
          type="button"
          title="Profile"
          className="flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-gray-400 transition-colors hover:bg-[#333] hover:text-white"
        >
          <svg {...iconProps}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <span className="text-center text-[10px] leading-tight">Profile</span>
        </button>
      </div>
    </nav>
  )
}

function PlaceRow({ place, onOpen }: { place: Place; onOpen: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(place.name)

  function save() {
    renamePlace(place.id, draft)
    setEditing(false)
  }

  return (
    <li className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-[#333]">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setDraft(place.name)
              setEditing(false)
            }
          }}
          aria-label="Place name"
          maxLength={60}
          className="min-w-0 flex-1 rounded border border-[#555] bg-[#1e1e1e] px-1 py-0.5 text-xs text-gray-100 outline-none focus:border-gray-400"
        />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          onDoubleClick={() => {
            setDraft(place.name)
            setEditing(true)
          }}
          title="Show on the Orbital view (double-click to rename)"
          className="flex min-w-0 flex-1 flex-col items-start text-left"
        >
          <span className="w-full truncate text-xs text-gray-100">{place.name}</span>
          <span className="w-full truncate text-[10px] text-gray-500">{formatCoords(place.latDeg, place.lonDeg)}</span>
        </button>
      )}
      {!editing && (
        <button
          type="button"
          onClick={() => {
            setDraft(place.name)
            setEditing(true)
          }}
          aria-label={`Rename ${place.name}`}
          title="Rename"
          className="rounded p-1 text-gray-500 opacity-0 hover:bg-[#444] hover:text-white focus:opacity-100 group-hover:opacity-100"
        >
          <svg {...small} width={13} height={13}>
            <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={() => removePlace(place.id)}
        aria-label={`Delete ${place.name}`}
        title="Delete pin"
        className="rounded p-1 text-gray-500 hover:bg-[#444] hover:text-[#F0793A]"
      >
        <svg {...small} width={13} height={13}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
    </li>
  )
}
