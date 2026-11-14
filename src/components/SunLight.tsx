import type { SkyPosition } from '../types'
import { directionFromSky } from '../scene/skyMath'

type SunLightProps = {
  sun: SkyPosition
  // Visible fraction of the solar disc (0..1) above the terrain horizon.
  visibleFraction: number
}

const lightDistanceM = 10_000
const fullSunIntensity = 3

// Directional light from the Sun, dimmed by how much of the disc the
// terrain hides.
export function SunLight({ sun, visibleFraction }: SunLightProps) {
  const [dx, dy, dz] = directionFromSky(sun)

  return (
    <directionalLight
      position={[dx * lightDistanceM, dy * lightDistanceM, dz * lightDistanceM]}
      intensity={fullSunIntensity * visibleFraction}
    />
  )
}
