export type BannerItem = { id: number; text: string }

// Every change the assistant makes is announced on screen (AI-2).
export function ActionBanner({ items, onDismiss }: { items: BannerItem[]; onDismiss: (id: number) => void }) {
  if (!items.length) return null
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onDismiss(item.id)}
          className="pointer-events-auto rounded-full border border-[#56B4E9]/70 bg-[#1e1e1e]/95 px-3 py-1 text-xs text-gray-100 shadow"
        >
          Assistant changed: {item.text}
        </button>
      ))}
    </div>
  )
}
