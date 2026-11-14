// Field of view limits for the 3D camera (degrees, vertical).
export const minFovDeg = 2
export const maxFovDeg = 60

export function clampFov(fovDeg: number): number {
  return Math.max(minFovDeg, Math.min(maxFovDeg, fovDeg))
}
