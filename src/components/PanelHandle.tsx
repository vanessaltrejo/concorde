// Blue tab with a < or > arrow on the edge of a side panel: opens or closes it.
type PanelHandleProps = {
  // true = the panel is open, so the arrow points toward the edge (>) to close it.
  open: boolean
  onClick: () => void
  label: string
  className?: string
}

export function PanelHandle({ open, onClick, label, className = '' }: PanelHandleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={(open ? 'Hide ' : 'Show ') + label}
      aria-expanded={open}
      title={(open ? 'Hide ' : 'Show ') + label}
      className={
        'pointer-events-auto flex h-14 w-7 items-center justify-center rounded-l-lg border border-r-0 border-white/20 bg-[#1c1e20] text-white hover:bg-[#2a2c2e] ' + className
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={open ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
      </svg>
    </button>
  )
}
