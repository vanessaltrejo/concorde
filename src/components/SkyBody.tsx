import { Billboard, Html } from '@react-three/drei'
import type { SkyBodyState } from '../types'
import { directionFromSky, discDiameterM, skyDistanceM } from '../scene/skyMath'

type SkyBodyProps = {
  label: string
  body: SkyBodyState
  observerPosition: [number, number, number]
  color: string
}

export function SkyBody({ label, body, observerPosition, color }: SkyBodyProps) {
  const [dx, dy, dz] = directionFromSky(body)
  const [ox, oy, oz] = observerPosition
  const radiusM = discDiameterM(body.angularDiameterDeg, skyDistanceM) / 2

  return (
    <Billboard position={[ox + dx * skyDistanceM, oy + dy * skyDistanceM, oz + dz * skyDistanceM]}>
      <mesh>
        <circleGeometry args={[radiusM, 48]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <Html position={[0, -radiusM * 2.2, 0]} center className="pointer-events-none">
        <span className="text-xs whitespace-nowrap text-white/80">{label}</span>
      </Html>
    </Billboard>
  )
}
