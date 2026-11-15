import type { SkyPosition } from '../types'

// Sky bodies are drawn on a far sphere, behind all the terrain and the
// horizon silhouette.
const skyDistanceM = 400_000

const degToRad = Math.PI / 180

// Unit vector for an azimuth and elevation.
// Scene axes: +X = east, -Z = north, +Y = up. Azimuth from north toward east
// (clockwise seen from above), the same convention as JPL Horizons.
export function directionFromSky({ azimuthDeg, elevationDeg }: SkyPosition): [number, number, number] {
  const az = azimuthDeg * degToRad
  const el = elevationDeg * degToRad
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]
}

// Point on the sky sphere for a position, seen from the observer.
export function skyPointM(position: SkyPosition, observer: [number, number, number]): [number, number, number] {
  const [dx, dy, dz] = directionFromSky(position)
  return [observer[0] + dx * skyDistanceM, observer[1] + dy * skyDistanceM, observer[2] + dz * skyDistanceM]
}

// Size of a disc on the sky sphere that covers an angular diameter.
export function discDiameterM(angularDiameterDeg: number): number {
  return 2 * skyDistanceM * Math.tan((angularDiameterDeg * degToRad) / 2)
}
