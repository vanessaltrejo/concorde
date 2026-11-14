import { Billboard } from '@react-three/drei'
import { useMemo } from 'react'
import { AdditiveBlending, CanvasTexture } from 'three'
import type { SkyBodyState } from '../types'
import { discDiameterM, skyPointM } from '../scene/skyMath'

type SunDiscProps = {
  sun: SkyBodyState
  observerPosition: [number, number, number]
}

// Glow size relative to the disc (visual only; the disc itself has the real
// angular size from Horizons).
const glowScale = 6

function buildGlowTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 248, 225, 0.55)')
    gradient.addColorStop(0.25, 'rgba(255, 240, 200, 0.18)')
    gradient.addColorStop(1, 'rgba(255, 240, 200, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  return new CanvasTexture(canvas)
}

export function SunDisc({ sun, observerPosition }: SunDiscProps) {
  const glowTexture = useMemo(() => buildGlowTexture(), [])
  const diameterM = discDiameterM(sun.angularDiameterDeg)

  return (
    <Billboard position={skyPointM(sun, observerPosition)}>
      <mesh renderOrder={1}>
        <planeGeometry args={[diameterM * glowScale, diameterM * glowScale]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <circleGeometry args={[diameterM / 2, 48]} />
        <meshBasicMaterial color="#fffaf0" toneMapped={false} />
      </mesh>
    </Billboard>
  )
}
