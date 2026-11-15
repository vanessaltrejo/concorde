export type SkyPosition = {
  azimuthDeg: number
  elevationDeg: number
}

// A Sun or Earth position plus its apparent size and astrometric ICRF
// direction (from Horizons).
export type SkyBodyState = SkyPosition & {
  angularDiameterDeg: number
  raDeg: number
  decDeg: number
}

export type SkySample = {
  timeUtc: string
  sun: SkyBodyState
  earth: SkyBodyState
  // Percent of Earth's disc lit by the Sun, as seen from the site.
  earthIlluminatedPct: number
  // Point on Earth (east longitude, latitude) at the center of the disc seen from the site.
  earthSubObserverLonDeg: number
  earthSubObserverLatDeg: number
}

export type LandingSite = {
  id: string
  name: string
  latitudeDeg: number
  longitudeDeg: number
  source: string
}

type SkyDataProvenance = {
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

// One terrain grid around the site, from public/data/<siteId>/terrain_<name>.f32
// + terrain.json (scripts/build_terrain.py). Positions are exact scene x, y, z
// (x = east, y = up, z = -north, meters) per node, row-major.
export type TerrainGrid = {
  size: number
  spacingM: number
  // Approximate map: scene x = a*col + b*row + c, scene z = d*col + e*row + f.
  // Only used to look up heights from scene x, z in the shadow shader.
  affine: [number, number, number, number, number, number]
  positions: Float32Array
}

// near: 20 m out to 10 km, mid: 320 m out to 80 km, far: 640 m out to 200 km.
export type TerrainData = {
  // Where the heights come from (terrain.json provenance).
  source: string
  near: TerrainGrid
  mid: TerrainGrid
  far: TerrainGrid
}

export type Visibility = 'visible' | 'partial' | 'hidden'

export type SiteData = {
  sky: SkyData
  horizon: HorizonProfile
  terrain: TerrainData
}
