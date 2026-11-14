import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three'
import type { HorizonProfile } from '../types'

type HorizonSilhouetteProps = {
  profile: HorizonProfile
  eyeHeightM: number
}

// Far terrain stand-in: a band around the observer whose top edge follows the
// computed horizon profile (terrain up to 200 km away). It sits between the
// near terrain mesh and the Sun/Earth discs, so what you see matches the
// hidden/visible logic exactly.
const silhouetteRadiusM = 30_000
const bottomElevationDeg = -15

function buildSilhouetteGeometry(profile: HorizonProfile, eyeHeightM: number): BufferGeometry {
  const count = profile.elevationDeg.length
  const positions = new Float32Array((count + 1) * 2 * 3)
  const toRad = Math.PI / 180
  const bottomY = eyeHeightM + silhouetteRadiusM * Math.tan(bottomElevationDeg * toRad)

  for (let i = 0; i <= count; i++) {
    const azimuth = i * profile.azimuthStepDeg * toRad
    const elevation = profile.elevationDeg[i % count] * toRad
    const x = silhouetteRadiusM * Math.sin(azimuth)
    const z = -silhouetteRadiusM * Math.cos(azimuth)
    const topY = eyeHeightM + silhouetteRadiusM * Math.tan(elevation)
    positions.set([x, topY, z, x, bottomY, z], i * 6)
  }

  const indices: number[] = []
  for (let i = 0; i < count; i++) {
    const top = i * 2
    indices.push(top, top + 1, top + 2, top + 2, top + 1, top + 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

export function HorizonSilhouette({ profile, eyeHeightM }: HorizonSilhouetteProps) {
  const geometry = useMemo(() => buildSilhouetteGeometry(profile, eyeHeightM), [profile, eyeHeightM])

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#3a3a3a" side={DoubleSide} />
    </mesh>
  )
}
