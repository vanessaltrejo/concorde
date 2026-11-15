import { isFlagged, MAX_SCENARIOS, toggleFlag, useScenarios } from '../state/scenarios'

// Flag a site for the Compare tab (up to 3 scenarios).
export function FlagButton({ siteId, timeMs }: { siteId: string; timeMs: number | null }) {
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
        'flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
        (flagged
          ? 'border-[var(--nasa-blue)] bg-[var(--nasa-blue)] text-white'
          : 'border-[#555] text-gray-100 hover:bg-[var(--nasa-blue)] hover:text-white')
      }
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill={flagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M5 3v18M5 4h12l-2 4 2 4H5" />
      </svg>
      {flagged ? 'In Compare' : 'Compare'}
    </button>
  )
}
