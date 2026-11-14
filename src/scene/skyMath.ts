import type { SkyPosition } from '../types'

// Sky bodies are drawn on a far sphere, behind all the terrain.
export const skyDistanceM = 40_000

const degToRad = Math.PI / 180

// Unit vector for an azimuth and elevation.
// Scene axes: +X = east, -Z = north, +Y = up. Azimuth from north toward east
// (clockwise seen from above), the same convention as JPL Horizons.
export function directionFromSky({ azimuthDeg, elevationDeg }: SkyPosition): [number, number, number] {
  const az = azimuthDeg * degToRad
  const el = elevationDeg * degToRad
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]
}

// Size of a disc at a given distance that covers an angular diameter.
export function discDiameterM(angularDiameterDeg: number, distanceM: number): number {
  return 2 * distanceM * Math.tan((angularDiameterDeg * degToRad) / 2)
}
