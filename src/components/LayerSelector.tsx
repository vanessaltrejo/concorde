import { SELECTOR, getLayer, tileLimitLabel } from '../data/layers'

type LayerSelectorProps = {
  activeId: string
  onChange: (id: string) => void
}

// One map layer at a time (radio buttons), with an info card for the active one.
export function LayerSelector({ activeId, onChange }: LayerSelectorProps) {
  const active = getLayer(activeId)

  return (
    <div className="absolute left-4 top-4 flex max-h-[calc(100%-2rem)] w-72 flex-col gap-3 overflow-y-auto rounded-lg border border-[#444] bg-[#303030]/95 p-3 text-gray-100">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Map layer</legend>
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
      </fieldset>

      <section className="flex flex-col gap-1 border-t border-[#444] pt-2 text-xs text-gray-400">
        <p className="font-medium text-gray-200">{active.label}</p>
        <p>{active.sourceNote}</p>
        <p>
          <span className="text-gray-300">Coverage:</span> {active.coverageLabel}
        </p>
        <p>
          <span className="text-gray-300">Tiles:</span> {tileLimitLabel(active)}
        </p>
        <p>{active.limitsNote}</p>
        <p>Does not depend on the date.</p>
      </section>
    </div>
  )
}
