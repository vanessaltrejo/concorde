import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import type { SkySample } from '../types'
import { observerHeightM } from '../scene/constants'
import { fakeHeightM } from '../scene/fakeTerrain'
import { CompassOverlay } from './CompassOverlay'
import { LookControls } from './LookControls'
import { SkyBody } from './SkyBody'
import { SunLight } from './SunLight'
import { TerrainMesh } from './TerrainMesh'

type MainViewProps = {
  sample: SkySample
  initialAzimuthDeg: number
}

const observerPosition: [number, number, number] = [0, fakeHeightM(0, 0) + observerHeightM, 0]

export function MainView({ sample, initialAzimuthDeg }: MainViewProps) {
  const [headingDeg, setHeadingDeg] = useState(initialAzimuthDeg)

  return (
    <main className="relative flex-1 bg-black">
      <Canvas
        style={{ touchAction: 'none', cursor: 'grab' }}
        gl={{ logarithmicDepthBuffer: true }}
        camera={{ position: observerPosition, fov: 60, near: 0.5, far: 60_000 }}
      >
        <color attach="background" args={['#000000']} />
        {/* Visual only: a faint fill light so the terrain never turns fully black.
            It stands in for earthshine but is not a measured value. */}
        <ambientLight intensity={0.35} />
        <SunLight sun={sample.sun} />
        <TerrainMesh />
        <SkyBody label="Sun" body={sample.sun} observerPosition={observerPosition} color="#fffbe6" />
        <SkyBody label="Earth" body={sample.earth} observerPosition={observerPosition} color="#3b82f6" />
        <LookControls
          initialAzimuthDeg={initialAzimuthDeg}
          initialElevationDeg={0}
          onHeadingChange={setHeadingDeg}
        />
      </Canvas>
      <CompassOverlay azimuthDeg={headingDeg} />
      <p className="pointer-events-none absolute bottom-3 left-3 text-xs text-gray-500">
        Fake terrain. Sun and Earth positions: JPL Horizons. Ambient light is visual only. Drag to
        look around. Observer height {observerHeightM} m.
      </p>
    </main>
  )
}
