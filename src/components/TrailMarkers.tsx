import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import { Vector3 } from 'three'

export type TrailMark = {
  position: [number, number, number] // scene meters, on the terrain
  last: boolean // the place stood on just before this one
  hidden: boolean // behind terrain seen from here
}

const projected = new Vector3()

// Keeps the trail dots (plain HTML, outside the canvas) on their terrain points
// every frame. A dot behind the camera or behind terrain is hidden.
export function TrailProjector({ marks, elements }: { marks: TrailMark[]; elements: RefObject<(HTMLDivElement | null)[]> }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  useFrame(() => {
    marks.forEach((mark, i) => {
      const element = elements.current[i]
      if (!element) return
      projected.set(...mark.position).project(camera)
      const show = !mark.hidden && projected.z <= 1
      element.style.display = show ? 'flex' : 'none'
      if (!show) return
      const x = ((projected.x + 1) / 2) * size.width
      const y = ((1 - projected.y) / 2) * size.height
      element.style.transform = `translate(${x}px, ${y}px)`
    })
  })
  return null
}

// The dots: the last place in yellow with its label, older places in blue.
export function TrailDots({ marks, elements }: { marks: TrailMark[]; elements: RefObject<(HTMLDivElement | null)[]> }) {
  return (
    <>
      {marks.map((mark, i) => (
        <div
          key={i}
          ref={(el) => {
            elements.current[i] = el
          }}
          className="pointer-events-none absolute left-0 top-0 items-center gap-1.5"
          style={{ display: 'none' }}
        >
          {/* Centered on the point: the dot is 10 px wide. */}
          <span
            className="-ml-[5px] -mt-[5px] block h-2.5 w-2.5 shrink-0 rounded-full border border-black/60 shadow"
            style={{ background: mark.last ? '#FFD400' : '#3b82f6' }}
          />
          {mark.last && (
            <span className="-mt-[5px] whitespace-nowrap rounded bg-black/70 px-1 py-px text-[10px] leading-tight text-[#FFD400]">
              last location in the horizon
            </span>
          )}
        </div>
      ))}
    </>
  )
}
