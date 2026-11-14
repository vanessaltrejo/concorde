import { moonRadiusM } from './constants'

// FAKE TERRAIN: a procedural heightmap to build the view. Replaced by
// LOLA data in Step 5.

export const terrainSizeM = 20_000
export const terrainSegments = 256

// A ridge about 3 km away, toward azimuth 120 deg, so we can test that
// it hides things in Step 3.
const ridgeAzimuthDeg = 120
const ridgeDistanceM = 3_000
const ridgeHeightM = 150
const ridgeWidthM = 600

function ridgeHeight(x: number, z: number): number {
  const azRad = (ridgeAzimuthDeg * Math.PI) / 180
  const dirX = Math.sin(azRad)
  const dirZ = -Math.cos(azRad)
  // Distance along the ridge direction and across it.
  const along = x * dirX + z * dirZ
  const across = -x * dirZ + z * dirX
  const fromCrest = along - ridgeDistanceM
  const crest = Math.exp(-(fromCrest * fromCrest) / (2 * ridgeWidthM * ridgeWidthM))
  const lengthFade = Math.exp(-(across * across) / (2 * 4_000 * 4_000))
  return ridgeHeightM * crest * lengthFade
}

function rollingHills(x: number, z: number): number {
  return (
    25 * Math.sin(x / 1_300) * Math.cos(z / 1_700) +
    10 * Math.sin((x + z) / 600) +
    4 * Math.cos((x - 2 * z) / 250)
  )
}

// How far the ground drops below the camera's flat tangent plane
// because the Moon is a sphere.
export function curvatureDropM(x: number, z: number): number {
  const distanceSq = x * x + z * z
  return distanceSq / (2 * moonRadiusM)
}

// Height in scene units (meters), already including curvature.
export function fakeHeightM(x: number, z: number): number {
  return ridgeHeight(x, z) + rollingHills(x, z) - curvatureDropM(x, z)
}
