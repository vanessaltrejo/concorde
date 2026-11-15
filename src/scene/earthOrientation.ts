import type { SkyBodyState, SkySample } from '../types'
import { directionFromSky } from './skyMath'

type Vec3 = [number, number, number]

const degToRad = Math.PI / 180

function icrfDirection({ raDeg, decDeg }: SkyBodyState): Vec3 {
  const ra = raDeg * degToRad
  const dec = decDeg * degToRad
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(...a)
  return [a[0] / length, a[1] / length, a[2] / length]
}

function scale(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k]
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

// Orthonormal triad from two directions (TRIAD method).
function triad(a: Vec3, b: Vec3): [Vec3, Vec3, Vec3] {
  const t1 = normalize(a)
  const t2 = normalize(cross(a, b))
  return [t1, t2, cross(t1, t2)]
}

type EarthFrame = {
  // Earth's north pole, local direction "east" on Earth's equator, and the
  // equator direction toward the meridian at the center of the visible disc,
  // all in scene axes (x = east, y = up, z = -north of the site).
  pole: Vec3
  towardSubObserver: Vec3
  eastOfSubObserver: Vec3
  subObserverLonRad: number
}

// Earth's orientation as seen from the site. The Sun and Earth directions are
// known both in the sky frame (ICRF RA/DEC) and in the site frame (az/el), which
// gives the rotation between them; Earth's pole is the ICRF z axis (precession
// since J2000 is ~0.4 deg, too small to see). Checked against Horizons: the
// sub-observer latitude from this rotation matches within 0.25 deg.
export function earthFrame(sample: SkySample): EarthFrame {
  const [e1, e2, e3] = triad(directionFromSky(sample.earth), directionFromSky(sample.sun))
  const [i1, i2, i3] = triad(icrfDirection(sample.earth), icrfDirection(sample.sun))
  // Rotation ICRF -> scene applied to the ICRF z axis.
  const pole = normalize([
    e1[0] * i1[2] + e2[0] * i2[2] + e3[0] * i3[2],
    e1[1] * i1[2] + e2[1] * i2[2] + e3[1] * i3[2],
    e1[2] * i1[2] + e2[2] * i2[2] + e3[2] * i3[2],
  ])
  // From Earth's center toward the site.
  const towardObserver = scale(directionFromSky(sample.earth), -1)
  const towardSubObserver = normalize(subtract(towardObserver, scale(pole, dot(towardObserver, pole))))
  return {
    pole,
    towardSubObserver,
    eastOfSubObserver: cross(pole, towardSubObserver),
    subObserverLonRad: sample.earthSubObserverLonDeg * degToRad,
  }
}
