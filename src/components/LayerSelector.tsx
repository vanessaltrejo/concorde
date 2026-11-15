import { SELECTOR, getLayer } from '../data/layers'

type LayerSelectorProps = {
  activeId: string
  onChange: (id: string) => void
  onResetGlobe: () => void
}

// One map layer at a time (radio buttons). Sources are listed in References.
export function LayerSelector({ activeId, onChange, onResetGlobe }: LayerSelectorProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#444] bg-[#303030] p-3 text-gray-100 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
          Orbital view
        </h1>
        <button
          type="button"
          onClick={onResetGlobe}
          className="flex items-center gap-1.5 rounded bg-[#FFD400] px-2.5 py-1 text-xs font-semibold text-black hover:brightness-110"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
          </svg>
          Reset globe
        </button>
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Map layer</legend>
        {/* Two columns, filled top to bottom: 3 on the left, 2 on the right. */}
        <div className="grid grid-flow-col grid-rows-3 items-start gap-x-4 gap-y-1">
        {SELECTOR.map((entry) => {
          const selected = entry.id === activeId || (entry.options?.includes(activeId) ?? false)
          return (
            <div key={entry.id} className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="map-layer"
                  checked={selected}
                  onChange={() => onChange(entry.options ? entry.options[0] : entry.id)}
                />
                {entry.label}
              </label>
              {entry.options && selected && (
                <div className="ml-6 flex flex-col gap-1">
                  {entry.options.map((optionId) => (
                    <label key={optionId} className="flex cursor-pointer items-center gap-2 text-xs text-gray-300">
                      <input
                        type="radio"
                        name="temperature-layer"
                        checked={optionId === activeId}
                        onChange={() => onChange(optionId)}
                      />
                      {getLayer(optionId).label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </fieldset>

    </div>
  )
}
