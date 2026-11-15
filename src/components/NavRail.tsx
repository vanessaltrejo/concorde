import type { ReactNode } from 'react'

export type TabId = 'orbital' | 'horizon' | 'dashboard'

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
]

type NavRailProps = {
  active: TabId
  onChange: (tab: TabId) => void
  assistantOpen: boolean
  onToggleAssistant: () => void
}

// Slim icon bar on the far left. Each icon switches the main tab.
export function NavRail({ active, onChange, assistantOpen, onToggleAssistant }: NavRailProps) {
  return (
    <nav
      aria-label="Main navigation"
      className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-[#444] bg-[#262626] py-3"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(tab.id)}
            className={
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors ' +
              (isActive
                ? 'bg-[#3d3d3d] text-white'
                : 'text-gray-400 hover:bg-[#333] hover:text-white')
            }
          >
            {tab.icon}
          </button>
        )
      })}
      <button
        type="button"
        title="Assistant"
        aria-label="Assistant"
        aria-pressed={assistantOpen}
        onClick={onToggleAssistant}
        className={
          'mt-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors ' +
          (assistantOpen ? 'bg-[#3d3d3d] text-white' : 'text-gray-400 hover:bg-[#333] hover:text-white')
        }
      >
        <svg {...iconProps}>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
        </svg>
      </button>
    </nav>
  )
}
