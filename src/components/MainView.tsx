import { Canvas } from '@react-three/fiber'
import { StarSky } from './StarSky'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HorizonProfile, SkySample, TerrainData, Visibility } from '../types'
import { observerHeightM } from '../scene/constants'
import { skyPointM } from '../scene/skyMath'
import type { BodyVisibility } from '../scene/visibility'
import { CompassOverlay } from './CompassOverlay'
import { HorizonSilhouette } from './HorizonSilhouette'
import { clampFov, maxFovDeg } from '../scene/viewLimits'
import { LookControls } from './LookControls'
import type { LookTarget } from './LookControls'
import { ScreenLabels } from './ScreenLabels'
import { EarthDisc } from './EarthDisc'
import { SunDisc } from './SunDisc'
import { Terrain } from './Terrain'
import { TerrainPicker, type TerrainHover } from './TerrainPicker'
import { ViewControls } from './ViewControls'
import { latLonToScene, makeHeightAt, pickTerrain, sceneToLatLon, type TerrainHit } from '../scene/terrainPick'
import { TrailDots, TrailProjector, type TrailMark } from './TrailMarkers'
import { coverage, type AnywherePoint } from '../terrain/anywhere'

type MainViewProps = {
  sample: SkySample
  horizon: HorizonProfile
  terrain: TerrainData
  sunVisibility: BodyVisibility
  earthVisibility: BodyVisibility
  initialAzimuthDeg: number
  // Changes each time the user presses Reset view.
  resetToken: number
  // Where the observer stands (degrees, longitude east 0..360).
  siteLatDeg: number
  siteLonDeg: number
  // Double-click on the terrain: open the Horizon view at that point, looking
  // the same way (headingDeg). Absent = no terrain navigation.
  onMoveTo?: (point: AnywherePoint, headingDeg: number) => void
  // Places stood on before (oldest first): dots on the terrain, the last one yellow.
  trail?: AnywherePoint[]
}

type HoverInfo = { x: number; y: number; point: AnywherePoint; distanceM: number; available: boolean }

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`
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
  resetToken,
  siteLatDeg,
  siteLonDeg,
  onMoveTo,
  trail = [],
}: MainViewProps) {
  // Trail dots: each place on the terrain, hidden when a hill is in between.
  // The observer never moves within a view, so this is worked out once.
  const trailMarks = useMemo<TrailMark[]>(() => {
    const heightAt = makeHeightAt(terrain)
    const eye: [number, number, number] = [0, observerHeightM, 0]
    const marks: TrailMark[] = []
    trail.forEach((p, i) => {
      const { x, z } = latLonToScene(siteLatDeg, siteLonDeg, p.latDeg, p.lonDeg)
      const ground = heightAt(x, z)
      if (ground === null) return // farther than the loaded terrain
      const position: [number, number, number] = [x, ground + 1, z]
      const d = [x - eye[0], position[1] - eye[1], z - eye[2]]
      const length = Math.hypot(d[0], d[1], d[2])
      const hit = length > 0 ? pickTerrain(heightAt, eye, [d[0] / length, d[1] / length, d[2] / length]) : null
      // Hidden when the line of sight meets the ground clearly before the place.
      const hidden = hit !== null && hit.distanceM < Math.hypot(x, z) - Math.max(30, 0.02 * length)
      marks.push({ position, last: i === trail.length - 1, hidden })
    })
    return marks
  }, [trail, terrain, siteLatDeg, siteLonDeg])
  const trailElements = useRef<(HTMLDivElement | null)[]>([])
  const [headingDeg, setHeadingDeg] = useState(initialAzimuthDeg)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const headingRef = useRef(initialAzimuthDeg)
  useEffect(() => {
    headingRef.current = headingDeg
  }, [headingDeg])

  const toPoint = useCallback(
    (hit: TerrainHit): AnywherePoint => sceneToLatLon(siteLatDeg, siteLonDeg, hit.x, hit.y, hit.z),
    [siteLatDeg, siteLonDeg],
  )
  const onHover = useCallback(
    (h: TerrainHover | null) => {
      const rect = mainRef.current?.getBoundingClientRect()
      if (!h || !rect) return setHover(null)
      const point = toPoint(h.hit)
      // Position inside this view, for the hint next to the cursor.
      setHover({ x: h.clientX - rect.left, y: h.clientY - rect.top, point, distanceM: h.hit.distanceM, available: coverage(point.latDeg).ok })
    },
    [toPoint],
  )
  const onDoubleClick = useCallback(
    (hit: TerrainHit) => {
      const point = toPoint(hit)
      if (onMoveTo && coverage(point.latDeg).ok) onMoveTo(point, headingRef.current)
    },
    [toPoint, onMoveTo],
  )
  const [fovDeg, setFovDeg] = useState(maxFovDeg)
  const [lookTarget, setLookTarget] = useState<LookTarget | null>(null)
  const lookAt = useCallback(
    (azimuthDeg: number, elevationDeg: number) =>
      setLookTarget((previous) => ({ azimuthDeg, elevationDeg, requestId: (previous?.requestId ?? 0) + 1 })),
    [],
  )
  // Reset view: back to the starting direction, level horizon, widest view.
  useEffect(() => {
    if (resetToken === 0) return
    lookAt(initialAzimuthDeg, 0)
    setFovDeg(maxFovDeg)
  }, [resetToken, initialAzimuthDeg, lookAt])
  const sunLabelRef = useRef<HTMLDivElement>(null)
  const earthLabelRef = useRef<HTMLDivElement>(null)

  return (
    <main ref={mainRef} className="relative flex-1 overflow-hidden bg-black">
      <Canvas
        style={{ touchAction: 'none', cursor: hover?.available && onMoveTo ? 'pointer' : 'grab' }}
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ logarithmicDepthBuffer: true }}
        camera={{ position: observerPosition, fov: maxFovDeg, near: 0.5, far: 800_000 }}
      >
        <StarSky />
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
          fovDeg={fovDeg}
          onFovChange={setFovDeg}
          lookTarget={lookTarget}
          onHeadingChange={setHeadingDeg}
        />
        {onMoveTo && <TerrainPicker terrain={terrain} onHover={onHover} onDoubleClick={onDoubleClick} />}
        {trailMarks.length > 0 && <TrailProjector marks={trailMarks} elements={trailElements} />}
      </Canvas>
      <TrailDots marks={trailMarks} elements={trailElements} />
      {onMoveTo && hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs text-white shadow-lg"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {hover.available ? 'Double-click to go to this point' : 'Horizon view not available here yet'}
          <span className="ml-1 text-white/60">· {formatDistance(hover.distanceM)}</span>
        </div>
      )}
      <div ref={sunLabelRef} className={labelClassName}>
        {labelFor('Sun', sunVisibility.state)}
      </div>
      <div ref={earthLabelRef} className={labelClassName}>
        {labelFor('Earth', earthVisibility.state)}
      </div>
      <CompassOverlay azimuthDeg={headingDeg} />
      <ViewControls
        fovDeg={fovDeg}
        onZoom={(factor) => setFovDeg((previous) => clampFov(previous * factor))}
        onLookAtSun={() => lookAt(sample.sun.azimuthDeg, sample.sun.elevationDeg)}
        onLookAtEarth={() => lookAt(sample.earth.azimuthDeg, sample.earth.elevationDeg)}
      />
    </main>
  )
}
