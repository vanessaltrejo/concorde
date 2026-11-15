import type { Visibility } from '../types'

type StatusBadgeProps = {
  state: Visibility
  // Visible part of the disc, 0..1 (shown for "partial").
  fraction: number
}

// Okabe-Ito colors (safe for common color vision deficiencies), always paired
// with a symbol and text so color is never the only signal.
const styles: Record<Visibility, { color: string; symbol: string; label: string }> = {
  visible: { color: '#7fb0ff', symbol: '●', label: 'Visible' },
  partial: { color: '#E69F00', symbol: '◐', label: 'Partly hidden' },
  hidden: { color: '#F0793A', symbol: '○', label: 'Hidden' },
}

export function StatusBadge({ state, fraction }: StatusBadgeProps) {
  const { color, symbol, label } = styles[state]
  const detail = state === 'partial' ? ` (${Math.round(fraction * 100)}% of disc)` : ''
  return (
    <span className="inline-flex items-center gap-1 font-medium" style={{ color }}>
      <span aria-hidden="true">{symbol}</span>
      {label}
      {detail}
    </span>
  )
}
