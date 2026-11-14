export type SkyPosition = {
  azimuthDeg: number
  elevationDeg: number
}

// A Sun or Earth position plus its apparent size (from Horizons).
export type SkyBodyState = SkyPosition & {
  angularDiameterDeg: number
}

export type SkySample = {
  timeUtc: string
  sun: SkyBodyState
  earth: SkyBodyState
  // Percent of Earth's disc lit by the Sun, as seen from the site.
  earthIlluminatedPct: number
}

export type LandingSite = {
  id: string
  name: string
  latitudeDeg: number
  longitudeDeg: number
  source: string
}

export type SkyDataProvenance = {
  source: string
  apiVersion: string | null
  generatedUtc: string
  observerAltitudeKm: number
  notes: string
  queries: Record<string, string>
}

// Shape of public/data/<siteId>/sky.json, written by scripts/fetch_horizons.py.
export type SkyData = {
  site: LandingSite
  provenance: SkyDataProvenance
  samples: SkySample[]
}

// Highest terrain elevation for every azimuth, from public/data/<siteId>/horizon.json
// (scripts/build_terrain.py). elevationDeg[k] is the horizon at azimuth k * azimuthStepDeg.
export type HorizonProfile = {
  siteId: string
  azimuthStepDeg: number
  elevationDeg: number[]
}

// Terrain vertices around the site in scene axes (x = east, y = up, z = -north),
// from public/data/<siteId>/terrain.bin + terrain.json.
export type TerrainGrid = {
  gridSize: number
  spacingM: number
  vertices: Float32Array
}

export type Visibility = 'visible' | 'partial' | 'hidden'

export type SiteData = {
  sky: SkyData
  horizon: HorizonProfile
  terrain: TerrainGrid
}
