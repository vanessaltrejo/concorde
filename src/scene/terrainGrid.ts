import { BufferAttribute, BufferGeometry, DataTexture, FloatType, LinearFilter, RedFormat } from 'three'
import type { TerrainGrid } from '../types'

// Inverse of the approximate map (col, row) -> scene (x, z), as the two
// columns of a 2x2 matrix (for a GLSL mat2) plus the origin.
export function inverseAffine(grid: TerrainGrid): { columns: [number, number, number, number]; origin: [number, number] } {
  const [a, b, c, d, e, f] = grid.affine
  const det = a * e - b * d
  return { columns: [e / det, -d / det, -b / det, a / det], origin: [c, f] }
}

export function buildGridGeometry(grid: TerrainGrid): BufferGeometry {
  const { size, positions } = grid
  const indices = new Uint32Array((size - 1) * (size - 1) * 6)
  let k = 0
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const a = row * size + col
      const nextCol = a + 1
      const nextRow = a + size
      // Winding checked against the data: (a, nextRow, nextCol) faces up.
      indices.set([a, nextRow, nextCol, nextCol, nextRow, nextRow + 1], k)
      k += 6
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return geometry
}

function bilinearHeight(grid: TerrainGrid, col: number, row: number): number {
  const { size, positions } = grid
  const c = Math.min(Math.max(col, 0), size - 1.001)
  const r = Math.min(Math.max(row, 0), size - 1.001)
  const c0 = Math.floor(c)
  const r0 = Math.floor(r)
  const fc = c - c0
  const fr = r - r0
  const y = (cc: number, rr: number) => positions[(rr * size + cc) * 3 + 1]
  return (
    y(c0, r0) * (1 - fc) * (1 - fr) +
    y(c0 + 1, r0) * fc * (1 - fr) +
    y(c0, r0 + 1) * (1 - fc) * fr +
    y(c0 + 1, r0 + 1) * fc * fr
  )
}

// Height texture for shadow lookups. Texel (col, row) holds the terrain height
// at the scene point the affine map gives for (col, row). The exact node
// positions differ a little from the affine map (curvature makes deep terrain
// lean), so each texel is resampled at the node that really sits there.
export function buildHeightTexture(grid: TerrainGrid): DataTexture {
  const { size, positions, affine } = grid
  const [a, b, c, d, e, f] = affine
  const { columns } = inverseAffine(grid)
  const heights = new Float32Array(size * size)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * size + col
      const dx = positions[i * 3] - (a * col + b * row + c)
      const dz = positions[i * 3 + 2] - (d * col + e * row + f)
      // Shift in grid units that moves the exact node back onto the affine point.
      const dCol = columns[0] * dx + columns[2] * dz
      const dRow = columns[1] * dx + columns[3] * dz
      heights[i] = bilinearHeight(grid, col - dCol, row - dRow)
    }
  }
  const texture = new DataTexture(heights, size, size, RedFormat, FloatType)
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}
