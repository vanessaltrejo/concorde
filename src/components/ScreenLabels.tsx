import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import { Vector3 } from 'three'

export type ScreenLabelTarget = {
  elementRef: RefObject<HTMLDivElement | null>
  worldPosition: [number, number, number]
}

type ScreenLabelsProps = {
  targets: ScreenLabelTarget[]
}

const projected = new Vector3()

// Moves plain HTML labels (rendered outside the canvas) to the screen position
// of 3D points every frame. Hides a label when its point is behind the camera.
export function ScreenLabels({ targets }: ScreenLabelsProps) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useFrame(() => {
    for (const { elementRef, worldPosition } of targets) {
      const element = elementRef.current
      if (!element) continue
      projected.set(...worldPosition).project(camera)
      const behind = projected.z > 1
      element.style.display = behind ? 'none' : 'block'
      if (behind) continue
      const x = ((projected.x + 1) / 2) * size.width
      const y = ((1 - projected.y) / 2) * size.height
      element.style.transform = `translate(-50%, 14px) translate(${x}px, ${y}px)`
    }
  })

  return null
}
