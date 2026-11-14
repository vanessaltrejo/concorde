import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

type LookControlsProps = {
  initialAzimuthDeg: number
  initialElevationDeg: number
  onHeadingChange: (azimuthDeg: number) => void
}

const degreesPerPixel = 0.15
const maxElevationDeg = 85

function wrapAzimuth(azimuthDeg: number): number {
  return ((azimuthDeg % 360) + 360) % 360
}

// Drag to look around. The camera never moves, it only rotates.
export function LookControls({
  initialAzimuthDeg,
  initialElevationDeg,
  onHeadingChange,
}: LookControlsProps) {
  const camera = useThree((state) => state.camera)
  const domElement = useThree((state) => state.gl.domElement)
  const view = useRef({ azimuthDeg: initialAzimuthDeg, elevationDeg: initialElevationDeg })

  useEffect(() => {
    const applyView = () => {
      const { azimuthDeg, elevationDeg } = view.current
      // Camera looks toward -Z (north) by default. A positive Y rotation
      // turns it toward west, so azimuth uses the negative angle.
      camera.rotation.set((elevationDeg * Math.PI) / 180, (-azimuthDeg * Math.PI) / 180, 0, 'YXZ')
      onHeadingChange(azimuthDeg)
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
      // Grab-the-world feel: drag right turns the view left.
      const nextElevation = view.current.elevationDeg + dy * degreesPerPixel
      view.current = {
        azimuthDeg: wrapAzimuth(view.current.azimuthDeg - dx * degreesPerPixel),
        elevationDeg: Math.max(-maxElevationDeg, Math.min(maxElevationDeg, nextElevation)),
      }
      applyView()
    }

    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      domElement.releasePointerCapture(e.pointerId)
    }

    applyView()
    domElement.addEventListener('pointerdown', onPointerDown)
    domElement.addEventListener('pointermove', onPointerMove)
    domElement.addEventListener('pointerup', onPointerUp)
    domElement.addEventListener('pointercancel', onPointerUp)

    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
    }
  }, [camera, domElement, onHeadingChange])

  return null
}
