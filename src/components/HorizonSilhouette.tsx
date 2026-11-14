import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import type { HorizonProfile } from '../types'

type HorizonSilhouetteProps = {
  profile: HorizonProfile
  eyeHeightM: number
}

// Safety outline behind all terrain grids (they reach 200-283 km): a band whose
// top edge is the computed horizon profile. Where the coarse grids smooth a
// distant peak a little, this band still shows the exact outline, so what you
// see always matches the hidden/visible logic.
const silhouetteRadiusM = 300_000
const bottomElevationDeg = -8

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

// Thin line on the computed horizon, so ground and black sky never blend.
// Every point of nearer terrain is at or below this line by definition, so it
// is drawn on top without a depth test.
function buildHorizonLineGeometry(profile: HorizonProfile, eyeHeightM: number): BufferGeometry {
  const count = profile.elevationDeg.length
  const toRad = Math.PI / 180
  const points: number[] = []
  for (let i = 0; i <= count; i++) {
    const azimuth = i * profile.azimuthStepDeg * toRad
    const elevation = profile.elevationDeg[i % count] * toRad
    points.push(
      silhouetteRadiusM * Math.sin(azimuth),
      eyeHeightM + silhouetteRadiusM * Math.tan(elevation),
      -silhouetteRadiusM * Math.cos(azimuth),
    )
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  return geometry
}

export function HorizonSilhouette({ profile, eyeHeightM }: HorizonSilhouetteProps) {
  const geometry = useMemo(() => buildSilhouetteGeometry(profile, eyeHeightM), [profile, eyeHeightM])
  const lineGeometry = useMemo(() => buildHorizonLineGeometry(profile, eyeHeightM), [profile, eyeHeightM])

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#2b2b2b" side={DoubleSide} />
      </mesh>
      <lineLoop geometry={lineGeometry} renderOrder={2}>
        <lineBasicMaterial color="#8a8a8a" transparent opacity={0.55} depthTest={false} />
      </lineLoop>
    </>
  )
}
