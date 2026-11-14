import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import type { TerrainGrid } from '../types'

type TerrainMeshProps = {
  grid: TerrainGrid
}

function buildTerrainGeometry({ gridSize, vertices }: TerrainGrid): BufferGeometry {
  const indices: number[] = []
  for (let row = 0; row < gridSize - 1; row++) {
    for (let col = 0; col < gridSize - 1; col++) {
      const a = row * gridSize + col
      const nextCol = a + 1
      const nextRow = a + gridSize
      const diagonal = nextRow + 1
      // Winding checked against the data: (a, nextRow, nextCol) faces up.
      indices.push(a, nextRow, nextCol, nextCol, nextRow, diagonal)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// Real LOLA terrain around the site (scripts/build_terrain.py).
export function TerrainMesh({ grid }: TerrainMeshProps) {
  const geometry = useMemo(() => buildTerrainGeometry(grid), [grid])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#9a9a9a" roughness={1} metalness={0} />
    </mesh>
  )
}
