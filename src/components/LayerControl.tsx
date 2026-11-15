import { useState } from 'react'
import { SELECTOR, getLayer, photoBase, tileUrl, type TileSource } from '../data/layers'
import type { MarkerFilter } from '../scene/markers'

// Bottom-left "Layers" button of the Orbital view: a thumbnail of the active
// layer; clicking it opens the layer list (with a short description each) and
// the marker toggles.

// One-line descriptions, from the layer registry's source notes.
const BRIEF: Record<string, string> = {
  image: 'Photo mosaic from the LRO Wide Angle Camera.',
  hillshade: 'Relief shading of LOLA heights; fixed light, not the real Sun.',
  elevation: 'Heights in colour (LOLA); no value scale from Moon Trek.',
  slope: 'Steepness in colour (LOLA, Kaguya); read no numbers from it.',
  temperature: 'Diviner surface temperature; night only, no polar coverage.',
}

// Level-0 tile of the near side (x = 1 covers 0 to 180°E) as a preview picture.
function thumbUrl(layerId: string): string {
  const layer = getLayer(layerId)
  const global = layer.sources.find((s) => s.rectangle[0] <= -180 && s.rectangle[2] >= 179.9) ?? photoBase
  const source: TileSource = global
  return tileUrl(source).replace('{z}', '0').replace('{y}', '0').replace('{x}', '1')
}

type Props = {
  activeId: string
  onChange: (id: string) => void
  filter: MarkerFilter
  onFilterChange: (filter: MarkerFilter) => void
}

export function LayerControl({ activeId, onChange, filter, onFilterChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="absolute bottom-6 left-4 z-10 flex flex-col items-start gap-2">
      {open && (
        <div
          role="dialog"
          aria-label="Map layers"
          className="flex max-h-[min(34rem,calc(100vh-9rem))] w-80 flex-col overflow-y-auto rounded-xl border border-[#444] bg-[#202020]/97 p-4 text-gray-100 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Map layers</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close map layers" className="rounded px-2 text-lg text-gray-400 hover:bg-[#333] hover:text-white">
              ×
            </button>
          </div>

          <ul className="flex flex-col gap-1">
            {SELECTOR.map((entry) => {
              const selected = entry.id === activeId || (entry.options?.includes(activeId) ?? false)
              const firstId = entry.options ? entry.options[0] : entry.id
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onChange(firstId)}
                    aria-pressed={selected}
                    className={'flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-[#2c2c2c] ' + (selected ? 'bg-[#2c2c2c]' : '')}
                  >
                    <img
                      src={thumbUrl(firstId)}
                      alt=""
                      className={'h-12 w-12 shrink-0 rounded-lg object-cover ' + (selected ? 'ring-2 ring-[#7fb0ff]' : 'ring-1 ring-[#444]')}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className={'text-sm ' + (selected ? 'text-[#9fc3ff]' : 'text-gray-100')}>{entry.label}</span>
                      <span className="text-[11px] leading-snug text-gray-400">{BRIEF[entry.id] ?? getLayer(firstId).sourceNote}</span>
                    </span>
                  </button>
                  {entry.options && selected && (
                    <div className="ml-16 mt-1 flex flex-col gap-1">
                      {entry.options.map((optionId) => (
                        <label key={optionId} className="flex cursor-pointer items-center gap-2 text-xs text-gray-300">
                          <input type="radio" name="temperature-layer" checked={optionId === activeId} onChange={() => onChange(optionId)} />
                          {getLayer(optionId).label}
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <h3 className="mt-4 border-t border-[#333] pt-3 text-sm font-semibold">Markers</h3>
          <div className="mt-1 flex flex-col gap-1">
            {(
              [
                ['study', 'Study sites', 'South pole sites.'],
                ['historic', 'Historic missions', 'Apollo landings and completed CLPS missions.'],
                ['future', 'Future missions', 'Scheduled CLPS missions.'],
                ['pins', 'My pins', 'Places you saved; also listed in the left panel.'],
              ] as const
            ).map(([key, label, note]) => (
              <label key={key} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg p-1.5 hover:bg-[#2c2c2c]">
                <span className="flex flex-col">
                  <span className="text-sm">{label}</span>
                  <span className="text-[11px] text-gray-400">{note}</span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={filter[key]}
                  onChange={(e) => onFilterChange({ ...filter, [key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Map layers"
        title="Map layers"
        className="group relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl border-2 border-[#111] shadow-lg ring-1 ring-white/30 hover:ring-white/70"
      >
        <img src={thumbUrl(activeId)} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-0.5 text-[11px] font-medium text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 3l9 5-9 5-9-5 9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
          Layers
        </span>
      </button>
    </div>
  )
}
