import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three'
import type { SkySample, TerrainData, TerrainGrid } from '../types'
import { directionFromSky } from '../scene/skyMath'
import { buildGridGeometry, buildHeightTexture, inverseAffine } from '../scene/terrainGrid'
import { terrainFragmentShader, terrainVertexShader } from '../scene/terrainShader'

type TerrainProps = {
  terrain: TerrainData
  sample: SkySample
}

// Brightness of direct sunlight (visual scale, not physical units).
const sunIntensity = 1.7
// Earthshine fill light. Real earthshine is far too faint to see next to
// sunlight; this is a visual aid from the Earth's real direction and phase.
const earthshineVisualIntensity = 0.5
// Floor so shadowed terrain stays dark gray and never blends with the black
// sky (visual aid; real shadowed regolith is close to black).
const ambientIntensity = 0.075
// Lunar highland regolith, neutral gray (linear color).
const regolithAlbedo = new Color(0.42, 0.42, 0.42)

const degToRad = Math.PI / 180

function gridUniforms(grid: TerrainGrid) {
  const { columns, origin } = inverseAffine(grid)
  return {
    heights: { value: buildHeightTexture(grid) },
    inverse: { value: new Vector4(...columns) },
    origin: { value: new Vector2(...origin) },
    size: { value: grid.size },
  }
}

type LightUniforms = {
  sunDirection: { value: Vector3 }
  sunRadius: { value: number }
  earthDirection: { value: Vector3 }
  earthRadius: { value: number }
  earthIntensity: { value: number }
}

// Shader uniforms are mutable three.js objects by design; updating them in
// place avoids rebuilding the materials on every time step.
function applySample(uniforms: LightUniforms, sample: SkySample): void {
  uniforms.sunDirection.value.set(...directionFromSky(sample.sun))
  uniforms.sunRadius.value = (sample.sun.angularDiameterDeg / 2) * degToRad
  uniforms.earthDirection.value.set(...directionFromSky(sample.earth))
  uniforms.earthRadius.value = (sample.earth.angularDiameterDeg / 2) * degToRad
  uniforms.earthIntensity.value = earthshineVisualIntensity * (sample.earthIlluminatedPct / 100)
}

// Near (20 m), mid (320 m) and far (640 m) LOLA terrain with real cast shadows.
export function Terrain({ terrain, sample }: TerrainProps) {
  const invalidate = useThree((state) => state.invalidate)

  const { geometries, materials, shared } = useMemo(() => {
    const near = gridUniforms(terrain.near)
    const mid = gridUniforms(terrain.mid)
    const far = gridUniforms(terrain.far)
    const sharedUniforms = {
      nearHeights: near.heights,
      nearInverse: near.inverse,
      nearOrigin: near.origin,
      nearSize: near.size,
      midHeights: mid.heights,
      midInverse: mid.inverse,
      midOrigin: mid.origin,
      midSize: mid.size,
      farHeights: far.heights,
      farInverse: far.inverse,
      farOrigin: far.origin,
      farSize: far.size,
      sunDirection: { value: new Vector3(0, 1, 0) },
      sunRadius: { value: 0 },
      sunIntensity: { value: sunIntensity },
      earthDirection: { value: new Vector3(0, 1, 0) },
      earthRadius: { value: 0 },
      earthIntensity: { value: 0 },
      ambientIntensity: { value: ambientIntensity },
      albedo: { value: regolithAlbedo },
    }
    const makeMaterial = (gridLevel: number, shadowStart: number, shadowBias: number) =>
      new ShaderMaterial({
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        uniforms: {
          ...sharedUniforms,
          gridLevel: { value: gridLevel },
          shadowStart: { value: shadowStart },
          shadowBias: { value: shadowBias },
        },
      })
    return {
      geometries: [buildGridGeometry(terrain.near), buildGridGeometry(terrain.mid), buildGridGeometry(terrain.far)],
      // Start the shadow march about one cell away, with a height bias, so a
      // surface does not shadow itself (larger on coarser grids).
      materials: [
        makeMaterial(0, terrain.near.spacingM, 0.5),
        makeMaterial(1, terrain.mid.spacingM, 20),
        makeMaterial(2, terrain.far.spacingM, 40),
      ],
      shared: sharedUniforms,
    }
  }, [terrain])

  useEffect(() => {
    applySample(shared, sample)
    invalidate()
  }, [sample, shared, invalidate])

  return (
    <>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={materials[i]} />
      ))}
    </>
  )
}
