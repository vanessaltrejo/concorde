import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Raycaster, Vector2 } from 'three'
import type { TerrainData } from '../types'
import { makeHeightAt, pickTerrain, type TerrainHit } from '../scene/terrainPick'

export type TerrainHover = { clientX: number; clientY: number; hit: TerrainHit }

type TerrainPickerProps = {
  terrain: TerrainData
  // Terrain point under the cursor (null when the cursor is on the sky or dragging).
  onHover: (hover: TerrainHover | null) => void
  onDoubleClick: (hit: TerrainHit) => void
}

// Finds the terrain point under the cursor ("double-click to go there").
// Lives inside the Canvas to use its camera; the 3D scene is not changed.
export function TerrainPicker({ terrain, onHover, onDoubleClick }: TerrainPickerProps) {
  const camera = useThree((state) => state.camera)
  const domElement = useThree((state) => state.gl.domElement)
  const heightAt = useMemo(() => makeHeightAt(terrain), [terrain])

  useEffect(() => {
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    let frame = 0
    let last: PointerEvent | MouseEvent | null = null

    const hitAt = (e: { clientX: number; clientY: number }): TerrainHit | null => {
      const rect = domElement.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const { origin, direction } = raycaster.ray
      return pickTerrain(heightAt, [origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z])
    }

    // At most one terrain search per animation frame while the cursor moves.
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons !== 0) {
        onHover(null) // dragging to look around
        return
      }
      last = e
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!last) return
        const hit = hitAt(last)
        onHover(hit ? { clientX: last.clientX, clientY: last.clientY, hit } : null)
      })
    }
    const onLeave = () => {
      last = null
      onHover(null)
    }
    const onDblClick = (e: MouseEvent) => {
      const hit = hitAt(e)
      if (hit) onDoubleClick(hit)
    }

    domElement.addEventListener('pointermove', onPointerMove)
    domElement.addEventListener('pointerleave', onLeave)
    domElement.addEventListener('dblclick', onDblClick)
    return () => {
      cancelAnimationFrame(frame)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerleave', onLeave)
      domElement.removeEventListener('dblclick', onDblClick)
    }
  }, [camera, domElement, heightAt, onHover, onDoubleClick])

  return null
}
