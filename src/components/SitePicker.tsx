import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GROUP_COLOR } from '../data/siteGroups'
import type { SiteEntry } from '../data/sites'

type SitePickerProps = {
  value: string | null
  options: SiteEntry[]
  onChange: (siteId: string) => void
  placeholder?: string
  ariaLabel: string
  // Marks sites that have no Horizon view data yet.
  flagMissingData?: boolean
  triggerClassName?: string
}

// Site menu with a coloured title per group (South pole orange, CLPS missions
// purple, Apollo green, Saved points blue) and a dot in the same colour per site.
export function SitePicker({ value, options, onChange, placeholder = 'Choose a site…', ariaLabel, flagMissingData = false, triggerClassName }: SitePickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const selected = options.find((s) => s.id === value) ?? null
  const groups = [...new Set(options.map((s) => s.group))]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current && !rootRef.current.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // The menu is drawn on the page itself (not inside the panel), so it is never
  // cut or scrolled: the whole list shows, moved up if it would pass the bottom.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    setBox({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [open])
  useLayoutEffect(() => {
    if (!open || !box || !menuRef.current) return
    const h = menuRef.current.offsetHeight
    const top = Math.max(8, Math.min(box.top, window.innerHeight - h - 8))
    if (top !== box.top) setBox({ ...box, top })
  }, [open, box])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          triggerClassName ??
          'flex w-full items-center gap-2 rounded border border-[#555] bg-[#262626] px-2 py-1.5 text-left text-sm text-gray-100 hover:border-[#777]'
        }
      >
        {selected && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUP_COLOR[selected.group] }} />}
        <span className="flex-1 truncate">{selected ? selected.name : placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={'shrink-0 text-gray-400 transition-transform ' + (open ? 'rotate-180' : '')}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && box && createPortal(
        <div ref={menuRef} role="listbox" aria-label={ariaLabel} style={{ position: 'fixed', top: box.top, left: box.left, minWidth: box.width, maxHeight: 'calc(100vh - 16px)' }} className="z-[100] overflow-y-auto rounded-lg border border-[#555] bg-[#262626] py-1 shadow-2xl">
          {groups.map((group) => (
            <div key={group}>
              <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: GROUP_COLOR[group] }}>
                <span aria-hidden className="h-3 w-1 rounded-sm" style={{ background: GROUP_COLOR[group] }} />
                {group}
              </p>
              {options
                .filter((s) => s.group === group)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={s.id === value}
                    onClick={() => {
                      onChange(s.id)
                      setOpen(false)
                    }}
                    className={'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[#3a3a3a] ' + (s.id === value ? 'bg-[#333] text-white' : 'text-gray-200')}
                  >
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUP_COLOR[s.group] }} />
                    <span className="flex-1 whitespace-nowrap">{s.name}</span>
                    {flagMissingData && !s.hasSkyData && <span className="whitespace-nowrap text-[10px] text-gray-500">no Horizon data yet</span>}
                  </button>
                ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
