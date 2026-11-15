import type { HorizonProfile, SkyBodyState, Visibility } from '../types'

// Horizon elevation at any azimuth, by linear interpolation between bins.
export function horizonElevationAt(profile: HorizonProfile, azimuthDeg: number): number {
  const values = profile.elevationDeg
  const count = values.length
  const x = (((azimuthDeg / profile.azimuthStepDeg) % count) + count) % count
  const k = Math.floor(x)
  const f = x - k
  return values[k] * (1 - f) + values[(k + 1) % count] * f
}

// Fraction (0..1) of a disc above the horizon. The horizon is treated as a
// straight line across the small disc. Same rule as scripts/check_illumination.py.
function visibleDiscFraction(body: SkyBodyState, horizonDeg: number): number {
  const radius = body.angularDiameterDeg / 2
  const d = Math.max(-1, Math.min(1, (body.elevationDeg - horizonDeg) / radius))
  const below = (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI
  return 1 - below
}

// "partial" counts as visible for communication, as in the NASA PGDA Earth
// visibility maps (visible if any part of the disc is not obscured).
function visibilityOf(fraction: number): Visibility {
  if (fraction >= 1) return 'visible'
  if (fraction <= 0) return 'hidden'
  return 'partial'
}

export type BodyVisibility = {
  horizonDeg: number
  fraction: number
  state: Visibility
}

export function bodyVisibility(body: SkyBodyState, profile: HorizonProfile): BodyVisibility {
  const horizonDeg = horizonElevationAt(profile, body.azimuthDeg)
  const fraction = visibleDiscFraction(body, horizonDeg)
  return { horizonDeg, fraction, state: visibilityOf(fraction) }
}
