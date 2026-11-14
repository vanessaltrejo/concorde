import { Billboard } from '@react-three/drei'
import type { SkyBodyState } from '../types'
import { discDiameterM, skyPointM } from '../scene/skyMath'

type SkyBodyProps = {
  body: SkyBodyState
  observerPosition: [number, number, number]
  color: string
}

export function SkyBody({ body, observerPosition, color }: SkyBodyProps) {
  const radiusM = discDiameterM(body.angularDiameterDeg) / 2

  return (
    <Billboard position={skyPointM(body, observerPosition)}>
      <mesh>
        <circleGeometry args={[radiusM, 48]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}
