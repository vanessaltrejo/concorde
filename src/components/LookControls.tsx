import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera } from 'three'
import type { Camera } from 'three'
import { clampFov, maxFovDeg } from '../scene/viewLimits'

export type LookTarget = {
  azimuthDeg: number
  elevationDeg: number
  // Changes on every request so the same target can be requested twice.
  requestId: number
}

type LookControlsProps = {
  initialAzimuthDeg: number
  initialElevationDeg: number
  fovDeg: number
  onFovChange: (fovDeg: number) => void
  lookTarget: LookTarget | null
  onHeadingChange: (azimuthDeg: number) => void
}

// Drag speed at the widest view; it scales with the field of view so dragging
// feels the same when zoomed in.
const degreesPerPixelAtMaxFov = 0.15
const maxElevationDeg = 85

type View = { azimuthDeg: number; elevationDeg: number }

function wrapAzimuth(azimuthDeg: number): number {
  return ((azimuthDeg % 360) + 360) % 360
}

// three.js cameras are mutable objects by design.
function applyRotation(camera: Camera, { azimuthDeg, elevationDeg }: View): void {
  // Camera looks toward -Z (north) by default. A positive Y rotation turns it
  // toward west, so azimuth uses the negative angle.
  camera.rotation.set((elevationDeg * Math.PI) / 180, (-azimuthDeg * Math.PI) / 180, 0, 'YXZ')
}

function applyFov(camera: Camera, fovDeg: number): void {
  if (!(camera instanceof PerspectiveCamera)) return
  camera.fov = fovDeg
  camera.updateProjectionMatrix()
}

// Drag to look around, mouse wheel or trackpad pinch to zoom (field of view).
// The camera never moves, it only rotates.
export function LookControls({
  initialAzimuthDeg,
  initialElevationDeg,
  fovDeg,
  onFovChange,
  lookTarget,
  onHeadingChange,
}: LookControlsProps) {
  const camera = useThree((state) => state.camera)
  const domElement = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const view = useRef<View>({ azimuthDeg: initialAzimuthDeg, elevationDeg: initialElevationDeg })
  const fovRef = useRef(fovDeg)

  useEffect(() => {
    fovRef.current = fovDeg
    applyFov(camera, fovDeg)
    invalidate()
  }, [camera, fovDeg, invalidate])

  useEffect(() => {
    if (!lookTarget) return
    view.current = {
      azimuthDeg: wrapAzimuth(lookTarget.azimuthDeg),
      elevationDeg: Math.max(-maxElevationDeg, Math.min(maxElevationDeg, lookTarget.elevationDeg)),
    }
    applyRotation(camera, view.current)
    onHeadingChange(view.current.azimuthDeg)
    invalidate()
  }, [camera, lookTarget, onHeadingChange, invalidate])

  useEffect(() => {
    const update = () => {
      applyRotation(camera, view.current)
      onHeadingChange(view.current.azimuthDeg)
      // The canvas only renders on demand.
      invalidate()
    }

    let lastX = 0
    let lastY = 0
    let dragging = false

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      domElement.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      const degreesPerPixel = degreesPerPixelAtMaxFov * (fovRef.current / maxFovDeg)
      // Grab-the-world feel: drag right turns the view left.
      const nextElevation = view.current.elevationDeg + dy * degreesPerPixel
      view.current = {
        azimuthDeg: wrapAzimuth(view.current.azimuthDeg - dx * degreesPerPixel),
        elevationDeg: Math.max(-maxElevationDeg, Math.min(maxElevationDeg, nextElevation)),
      }
      update()
    }

    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      domElement.releasePointerCapture(e.pointerId)
    }

    // Wheel down zooms out, wheel up zooms in. Trackpad pinch arrives as a
    // wheel event with ctrlKey, which gets a stronger factor.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const strength = e.ctrlKey ? 0.01 : 0.0015
      onFovChange(clampFov(fovRef.current * Math.exp(e.deltaY * strength)))
    }

    update()
    domElement.addEventListener('pointerdown', onPointerDown)
    domElement.addEventListener('pointermove', onPointerMove)
    domElement.addEventListener('pointerup', onPointerUp)
    domElement.addEventListener('pointercancel', onPointerUp)
    domElement.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
      domElement.removeEventListener('wheel', onWheel)
    }
  }, [camera, domElement, onHeadingChange, onFovChange, invalidate])

  return null
}
