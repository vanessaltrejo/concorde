// Registry of Orbital view layers. The selector, the info card and the credit line
// are all built from this list. Nothing in the UI is typed by hand per layer.
//
// Every product below was checked on 2026-11-14 against its Moon Trek
// WMTSCapabilities.xml (tile matrix, coverage) and with tile requests (the level
// after `maxLevel` returns 404). Trek serves these as equirectangular tiles,
// 256 px, level 0 = 2 x 1 tiles.

export type TileSource = {
  // Moon Trek product name (folder under /tiles/Moon/EQ/).
  product: string
  // Highest tile level that exists.
  maxLevel: number
  // Coverage in degrees: west, south, east, north.
  rectangle: [number, number, number, number]
  extension: 'png' | 'jpg'
}

export type LayerDef = {
  id: string
  label: string
  // Overlays are drawn over the photo mosaic. The photo mosaic itself is the base.
  sources: TileSource[] // bottom to top
  // What the source product is, from its name or the Moon Trek description.
  sourceNote: string
  coverageLabel: string
  limitsNote: string
  // Short credit shown in the one-line footer.
  credit: string
}

const WORLD: [number, number, number, number] = [-180, -90, 180, 90]

export const MOON_TREK_TILES = 'https://trek.nasa.gov/tiles/Moon/EQ'

export function tileUrl(source: TileSource): string {
  return `${MOON_TREK_TILES}/${source.product}/1.0.0/default/default028mm/{z}/{y}/{x}.${source.extension}`
}

// Size of one tile pixel at the equator for the highest level, derived from the
// level count (256 px tiles, 2 x 1 at level 0, Moon radius 1737.4 km).
export function tilePixelSizeMeters(maxLevel: number): number {
  const pixelsAround = 256 * 2 ** (maxLevel + 1)
  return (2 * Math.PI * 1_737_400) / pixelsAround
}

export function formatLength(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

export const photoBase: TileSource = {
  product: 'LRO_WAC_Mosaic_Global_303ppd_v02',
  maxLevel: 8,
  rectangle: WORLD,
  extension: 'jpg',
}

export const LAYERS: LayerDef[] = [
  {
    id: 'image',
    label: 'Image',
    sources: [],
    sourceNote: 'LRO Wide Angle Camera photo mosaic (Moon Trek product LRO_WAC_Mosaic_Global_303ppd_v02).',
    coverageLabel: 'Whole Moon',
    limitsNote: 'A photo, not a measurement. Its lighting is part of the picture and does not change with the date.',
    credit: 'LRO Wide Angle Camera',
  },
  {
    id: 'hillshade',
    label: 'Hillshade',
    sources: [
      {
        product: 'LRO_LOLA_Shade_Global_256ppd_v06',
        maxLevel: 6,
        rectangle: WORLD,
        extension: 'png',
      },
      // South pole detail on top: the global tiles break up near the pole.
      {
        product: 'LRO_LOLA_Shade_SPole875_5mp_v04_EQ',
        maxLevel: 9,
        rectangle: [-180, -89.9994527, 180, -86.4641138],
        extension: 'png',
      },
    ],
    sourceNote:
      'Shaded relief of the LOLA elevation model: whole Moon (256 pixels per degree, version 6) and, from 86.5°S to the pole, a 5 m per pixel south pole model (version 4).',
    coverageLabel: 'Whole Moon; detailed from 86.5°S to the south pole',
    limitsNote: 'The light direction is fixed. It does not follow the real Sun, so it cannot show real shadows.',
    credit: 'LRO LOLA',
  },
  {
    id: 'elevation',
    label: 'Elevation',
    sources: [
      {
        product: 'LRO_LOLA_ClrShade_Global_256ppd_v06',
        maxLevel: 6,
        rectangle: WORLD,
        extension: 'png',
      },
      {
        product: 'LRO_LOLA_ClrShade_SPole875_5mp_v04_EQ',
        maxLevel: 9,
        rectangle: [-180, -89.9994527, 180, -86.4641138],
        extension: 'png',
      },
    ],
    sourceNote:
      'Colour shaded relief of the LOLA elevation model: whole Moon (256 pixels per degree, version 6) and, from 86.5°S to the pole, a 5 m per pixel south pole model (version 4). The two colour scales may not match.',
    coverageLabel: 'Whole Moon; detailed from 86.5°S to the south pole',
    limitsNote:
      'Shading is part of the picture. Moon Trek gives no height scale for these tiles, so colours are not read as heights.',
    credit: 'LRO LOLA',
  },
  {
    id: 'slope',
    label: 'Slope',
    sources: [
      // Bottom to top: the coarse global map first, finer maps over it.
      {
        product: 'LRO_LOLA_ClrSlope_Global_16ppd',
        maxLevel: 2,
        rectangle: WORLD,
        extension: 'png',
      },
      {
        product: 'LRO_LOLAKaguya_ClrSlope_60N60S_512ppd',
        maxLevel: 10,
        rectangle: [-180, -60, 180, 60],
        extension: 'png',
      },
      {
        product: 'LRO_LOLA_ClrSlope_SPole75S_120m_EQ',
        maxLevel: 6,
        rectangle: [-180, -89.9951773, 179.9992504, -68.9074986],
        extension: 'png',
      },
      {
        product: 'LRO_LOLA_ClrSlope_NPole75N_120m_EQ',
        maxLevel: 6,
        rectangle: [-180, 68.9123213, 179.9992504, 90],
        extension: 'png',
      },
    ],
    sourceNote:
      'Three maps joined: 60°S to 60°N (LOLA + Kaguya, 512 ppd), both poles from about 69° (LOLA, 120 m), and a coarse whole-Moon map (16 ppd) underneath.',
    coverageLabel: 'Whole Moon, resolution changes with latitude',
    limitsNote:
      'Between about 60° and 69° latitude only the coarse whole-Moon map exists. Moon Trek gives no value scale for these tiles, so do not read slope numbers from colours. Slope depends on the map scale.',
    credit: 'LRO LOLA, Kaguya',
  },
  {
    id: 'temperature-night',
    label: 'Night temperature',
    sources: [
      {
        product: 'LRO_DIVINER_ClrRockFreeSurfaceTemp_Global_128ppd',
        maxLevel: 6,
        rectangle: [-180, -70, 180, 70],
        extension: 'png',
      },
    ],
    sourceNote:
      'Rock-free regolith temperature at night (local time 19:30 to 05:30) from Diviner data, July 2009 to September 2012 (Moon Trek description).',
    coverageLabel: '70°S to 70°N (the Moon Trek description says 60°S to 60°N)',
    limitsNote:
      'No polar coverage: the photo shows through there. Night only, not a temperature for a chosen date. No value scale in the tiles.',
    credit: 'LRO Diviner',
  },
  {
    id: 'temperature-max',
    label: 'Max temperature (coarse)',
    sources: [
      {
        product: 'diviner_Clrtbol_max',
        maxLevel: 0,
        rectangle: WORLD,
        extension: 'png',
      },
    ],
    sourceNote: 'Moon Trek layer diviner_Clrtbol_max. Its description was not read.',
    coverageLabel: 'Whole Moon',
    limitsNote: 'Only one tile level exists, so it is very blurry. Context only. No value scale in the tiles.',
    credit: 'LRO Diviner',
  },
  {
    id: 'temperature-min',
    label: 'Min temperature (coarse)',
    sources: [
      {
        product: 'diviner_Clrtbol_min',
        maxLevel: 0,
        rectangle: WORLD,
        extension: 'png',
      },
    ],
    sourceNote: 'Moon Trek layer diviner_Clrtbol_min. Its description was not read.',
    coverageLabel: 'Whole Moon',
    limitsNote: 'Only one tile level exists, so it is very blurry. Context only. No value scale in the tiles.',
    credit: 'LRO Diviner',
  },
]

// How the layers are grouped in the selector. One layer is shown at a time.
export type SelectorEntry = { id: string; label: string; options?: string[] }

export const SELECTOR: SelectorEntry[] = [
  { id: 'image', label: 'Image' },
  { id: 'hillshade', label: 'Hillshade' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'slope', label: 'Slope' },
  {
    id: 'temperature',
    label: 'Temperature',
    options: ['temperature-night', 'temperature-max', 'temperature-min'],
  },
]

export function getLayer(id: string): LayerDef {
  const layer = LAYERS.find((l) => l.id === id)
  if (!layer) throw new Error(`Unknown layer: ${id}`)
  return layer
}

// Tile text built from the real tile levels, so it cannot disagree with the map.
// This is the size of a tile pixel, not the resolution of the source data: the
// source can be coarser or finer than the tiles.
export function tileLimitLabel(layer: LayerDef): string {
  const finest =
    layer.sources.length === 0 ? photoBase.maxLevel : Math.max(...layer.sources.map((s) => s.maxLevel))
  return `finest tile pixel is ${formatLength(tilePixelSizeMeters(finest))} at the equator (not the data resolution)`
}
