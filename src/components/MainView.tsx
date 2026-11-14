import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useState } from 'react'
import type { HorizonProfile, SkySample, TerrainData, Visibility } from '../types'
import { observerHeightM } from '../scene/constants'
import { skyPointM } from '../scene/skyMath'
import type { BodyVisibility } from '../scene/visibility'
import { CompassOverlay } from './CompassOverlay'
import { HorizonSilhouette } from './HorizonSilhouette'
import { LookControls } from './LookControls'
import { ScreenLabels } from './ScreenLabels'
import { EarthDisc } from './EarthDisc'
import { SunDisc } from './SunDisc'
import { Terrain } from './Terrain'

type MainViewProps = {
  sample: SkySample
  horizon: HorizonProfile
  terrain: TerrainData
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
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ logarithmicDepthBuffer: true }}
        camera={{ position: observerPosition, fov: 60, near: 0.5, far: 800_000 }}
      >
        <color attach="background" args={['#000000']} />
        <Terrain terrain={terrain} sample={sample} />
        <HorizonSilhouette profile={horizon} eyeHeightM={observerHeightM} />
        <SunDisc sun={sample.sun} observerPosition={observerPosition} />
        <Suspense fallback={null}>
          <EarthDisc sample={sample} observerPosition={observerPosition} />
        </Suspense>
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
        Terrain: LOLA 20 m to 10 km, 320 m to 80 km, 640 m to 200 km. Shadows computed from the
        same terrain. Earthshine is boosted to be visible (visual aid). Drag to look
        around. Observer height {observerHeightM} m.
      </p>
    </main>
  )
}
