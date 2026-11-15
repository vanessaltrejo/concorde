import type { ReactNode } from 'react'

export type TabId = 'orbital' | 'horizon' | 'dashboard' | 'compare' | 'games' | 'references'

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
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    id: 'compare',
    label: 'Compare sites',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="8" height="14" rx="1.5" />
        <rect x="13" y="5" width="8" height="14" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'games',
    label: 'Games',
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

// Sits just above Profile, at the bottom of the bar.
const bottomTabs: Tab[] = [
  {
    id: 'references',
    label: 'References',
    icon: (
      <svg {...iconProps}>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 21V5M8 7h7M8 11h5" />
      </svg>
    ),
  },
]

type NavRailProps = {
  active: TabId
  onChange: (tab: TabId) => void
}

// Slim icon bar on the far left. Each icon switches the main tab.
export function NavRail({ active, onChange }: NavRailProps) {
  const renderTab = (tab: Tab) => {
    const isActive = tab.id === active
    return (
      <button
        key={tab.id}
        type="button"
        aria-label={tab.label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onChange(tab.id)}
        className={
          'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ' +
          (isActive
            ? 'bg-[var(--nasa-blue)] text-white'
            : 'text-gray-400 hover:bg-[#333] hover:text-white')
        }
      >
        {isActive && <span aria-hidden className="absolute -left-2 top-2 h-6 w-[3px] rounded-r bg-[var(--nasa-red)]" />}
        {tab.icon}
        <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{tab.label}</span>
      </button>
    )
  }

  return (
    <nav
      aria-label="Main navigation"
      className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-[#444] bg-[#262626] py-3"
    >
      {tabs.map(renderTab)}
      <div className="mt-auto flex flex-col items-center gap-2">
        {bottomTabs.map(renderTab)}
      <button
        type="button"
        aria-label="Profile"
        className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-[#333] hover:text-white"
      >
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Profile</span>
      </button>
      </div>
    </nav>
  )
}
