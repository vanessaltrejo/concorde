import { isFlagged, MAX_SCENARIOS, toggleFlag, useScenarios } from '../state/scenarios'

// Flag a site for the Compare tab (up to 3 scenarios).
export function FlagButton({ siteId, timeMs, wide = false }: { siteId: string; timeMs: number | null; wide?: boolean }) {
  const list = useScenarios()
  const flagged = isFlagged(list, siteId)
  const full = !flagged && list.length >= MAX_SCENARIOS
  return (
    <button
      type="button"
      disabled={full}
      aria-pressed={flagged}
      onClick={() => toggleFlag(siteId, timeMs)}
      title={full ? `Compare is full (${MAX_SCENARIOS}). Remove one first.` : flagged ? 'Remove from Compare' : 'Add to Compare'}
      className={
        wide
          ? 'flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ' +
            (flagged ? 'border border-white bg-white text-[#121314]' : 'btn-outline')
          : 'flex items-center gap-1 border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
        (flagged
          ? 'border-white bg-white text-[#121314]'
          : 'border-white/20 text-gray-100 hover:bg-white/10 hover:text-white')
      }
    >
      <svg width={wide ? 15 : 12} height={wide ? 15 : 12} viewBox="0 0 24 24" fill={flagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M5 3v18M5 4h12l-2 4 2 4H5" />
      </svg>
      {flagged ? (wide ? 'In Compare ✓' : 'In Compare') : 'Compare'}
    </button>
  )
}
