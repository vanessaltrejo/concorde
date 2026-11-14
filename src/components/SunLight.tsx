import type { SkyPosition } from '../types'
import { directionFromSky } from '../scene/skyMath'

type SunLightProps = {
  sun: SkyPosition
}

const lightDistanceM = 10_000

// Directional light coming from the Sun. Off when the Sun is below
// the flat horizon (the terrain check comes in Step 6).
export function SunLight({ sun }: SunLightProps) {
  const [dx, dy, dz] = directionFromSky(sun)
  const intensity = sun.elevationDeg > 0 ? 3 : 0

  return (
    <directionalLight
      position={[dx * lightDistanceM, dy * lightDistanceM, dz * lightDistanceM]}
      intensity={intensity}
    />
  )
}
