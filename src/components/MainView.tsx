import { Canvas } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { HorizonProfile, SkySample, TerrainGrid, Visibility } from '../types'
import { observerHeightM } from '../scene/constants'
import { skyPointM } from '../scene/skyMath'
import type { BodyVisibility } from '../scene/visibility'
import { CompassOverlay } from './CompassOverlay'
import { HorizonSilhouette } from './HorizonSilhouette'
import { LookControls } from './LookControls'
import { ScreenLabels } from './ScreenLabels'
import { SkyBody } from './SkyBody'
import { SunLight } from './SunLight'
import { TerrainMesh } from './TerrainMesh'

type MainViewProps = {
  sample: SkySample
  horizon: HorizonProfile
  terrain: TerrainGrid
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
  initialAzimuthDeg: number
}

const observerPosition: [number, number, number] = [0, observerHeightM, 0]

const labelClassName =
  'pointer-events-none absolute top-0 left-0 text-xs whitespace-nowrap text-white/80'

function labelFor(name: string, state: Visibility): string {
  return state === 'visible' ? name : `${name} (${state})`
}

export function MainView({
  sample,
  horizon,
  terrain,
  sunVisibility,
  earthVisibility,
  initialAzimuthDeg,
}: MainViewProps) {
  const [headingDeg, setHeadingDeg] = useState(initialAzimuthDeg)
  const sunLabelRef = useRef<HTMLDivElement>(null)
  const earthLabelRef = useRef<HTMLDivElement>(null)

  return (
    <main className="relative flex-1 overflow-hidden bg-black">
      <Canvas
        style={{ touchAction: 'none', cursor: 'grab' }}
        gl={{ logarithmicDepthBuffer: true }}
        camera={{ position: observerPosition, fov: 60, near: 0.5, far: 60_000 }}
      >
        <color attach="background" args={['#000000']} />
        {/* Visual only: a faint fill light so the terrain never turns fully black.
            It stands in for earthshine but is not a measured value. */}
        <ambientLight intensity={0.35} />
        <SunLight sun={sample.sun} visibleFraction={sunVisibility.fraction} />
        <TerrainMesh grid={terrain} />
        <HorizonSilhouette profile={horizon} eyeHeightM={observerHeightM} />
        <SkyBody body={sample.sun} observerPosition={observerPosition} color="#fffbe6" />
        <SkyBody body={sample.earth} observerPosition={observerPosition} color="#3b82f6" />
        <ScreenLabels
          targets={[
            { elementRef: sunLabelRef, worldPosition: skyPointM(sample.sun, observerPosition) },
            { elementRef: earthLabelRef, worldPosition: skyPointM(sample.earth, observerPosition) },
          ]}
        />
        <LookControls
          initialAzimuthDeg={initialAzimuthDeg}
          initialElevationDeg={0}
          onHeadingChange={setHeadingDeg}
        />
      </Canvas>
      <div ref={sunLabelRef} className={labelClassName}>
        {labelFor('Sun', sunVisibility.state)}
      </div>
      <div ref={earthLabelRef} className={labelClassName}>
        {labelFor('Earth', earthVisibility.state)}
      </div>
      <CompassOverlay azimuthDeg={headingDeg} />
      <p className="pointer-events-none absolute bottom-3 left-3 text-xs text-gray-500">
        Terrain: LOLA 20 m (near mesh 40 m, far terrain as horizon silhouette to 200 km). Sun and
        Earth: JPL Horizons. Ambient light is visual only. Drag to look around. Observer height{' '}
        {observerHeightM} m.
      </p>
    </main>
  )
}
