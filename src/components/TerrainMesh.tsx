import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import { fakeHeightM, terrainSegments, terrainSizeM } from '../scene/fakeTerrain'

function buildTerrainGeometry(): BufferGeometry {
  const rowCount = terrainSegments + 1
  const step = terrainSizeM / terrainSegments
  const half = terrainSizeM / 2
  const positions = new Float32Array(rowCount * rowCount * 3)
  const indices: number[] = []

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < rowCount; col++) {
      const x = -half + col * step
      const z = -half + row * step
      const i = (row * rowCount + col) * 3
      positions[i] = x
      positions[i + 1] = fakeHeightM(x, z)
      positions[i + 2] = z
    }
  }

  for (let row = 0; row < terrainSegments; row++) {
    for (let col = 0; col < terrainSegments; col++) {
      const a = row * rowCount + col
      const b = a + 1
      const c = a + rowCount
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function TerrainMesh() {
  const geometry = useMemo(() => buildTerrainGeometry(), [])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#9a9a9a" roughness={1} metalness={0} />
    </mesh>
  )
}
