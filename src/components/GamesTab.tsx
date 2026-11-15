import type { ReactNode } from 'react'

// Page for the mini games that teach kids about the Moon. The games are not
// built yet: each card is a place holder for one game (title, what it teaches).

type Game = { title: string; teaches: string; color: string; icon: ReactNode }

const iconProps = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const GAMES: Game[] = [
  {
    title: 'Sun or shadow?',
    teaches: 'Where the Sun shines on the Moon and where it stays dark.',
    color: '#FFD400',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    title: 'Land the lander',
    teaches: 'Pick a flat, sunny place to land safely.',
    color: '#4ADE80',
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l4 8H8z" />
        <path d="M9 11l-3 8M15 11l3 8M4 21h16" />
      </svg>
    ),
  },
  {
    title: 'Can you call home?',
    teaches: 'The Earth must be in the sky to talk to it.',
    color: '#56B4E9',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    title: 'Moon quiz',
    teaches: 'Questions about craters, days and nights on the Moon.',
    color: '#B794F6',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" />
      </svg>
    ),
  },
]

export function GamesTab() {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#303030] p-3 text-gray-100 md:p-4 [&>*]:shrink-0">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
          Games
        </h1>
        <p className="mt-1 text-sm text-gray-300">Mini games to learn about the Moon. Coming soon.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {GAMES.map((game) => (
          <section key={game.title} className="flex flex-col gap-3 rounded-xl border border-[#444] p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${game.color}22`, color: game.color }}>
              {game.icon}
            </div>
            <div>
              <h2 className="text-sm font-semibold">{game.title}</h2>
              <p className="mt-1 text-xs text-gray-300">{game.teaches}</p>
            </div>
            <span className="mt-auto self-start rounded-full border border-[#555] px-2.5 py-0.5 text-[11px] text-gray-400">Coming soon</span>
          </section>
        ))}
      </div>
    </div>
  )
}
