import type { TerrainData } from '../types'

// Text about the terrain of the open site, built from its own data files, so
// a polar site (LOLA 20 m, 200 km) and an Apollo site (LOLA 118 m, 50 km) are
// never described with the same words.
export type TerrainSummary = {
  // "20 m to 10 km, 320 m to 80 km, 640 m to 200 km"
  levels: string
  nearSpacingM: number
  radiusKm: number
  source: string
}

function km(meters: number): number {
  return Math.round(meters / 1000)
}

export function summarizeTerrain(terrain: TerrainData): TerrainSummary {
  const grids = [terrain.near, terrain.mid, terrain.far]
  const parts: string[] = []
  let lastExtent = 0
  for (const grid of grids) {
    const extent = km((grid.size * grid.spacingM) / 2)
    // Skip a grid that reaches no further than the one before it.
    if (extent > lastExtent) parts.push(`${Math.round(grid.spacingM)} m to ${extent} km`)
    lastExtent = Math.max(lastExtent, extent)
  }
  return {
    levels: parts.join(', '),
    nearSpacingM: Math.round(terrain.near.spacingM),
    radiusKm: lastExtent,
    source: terrain.source,
  }
}
