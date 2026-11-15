import { SELECTOR, getLayer, tileLimitLabel } from '../data/layers'

type LayerSelectorProps = {
  activeId: string
  onChange: (id: string) => void
}

// One map layer at a time (radio buttons), with an info card for the active one.
export function LayerSelector({ activeId, onChange }: LayerSelectorProps) {
  const active = getLayer(activeId)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#444] bg-[#303030] p-3 text-gray-100 shadow-lg">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden className="h-4 w-1 rounded-sm bg-[var(--nasa-red)]" />
        Orbital view
      </h1>
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

      <section className="flex flex-col gap-1 border-t border-[#444] pt-2 text-xs text-gray-300">
        <p className="font-medium text-gray-100">{active.label}</p>
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
