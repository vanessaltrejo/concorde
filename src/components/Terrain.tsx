import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color, HalfFloatType, LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderTarget } from 'three'
import type { SkySample, TerrainData, TerrainGrid } from '../types'
import { directionFromSky } from '../scene/skyMath'
import { buildGridGeometry, buildHeightTexture, inverseAffine } from '../scene/terrainGrid'
import { bakeFragmentShader, bakeVertexShader, terrainFragmentShader, terrainVertexShader } from '../scene/terrainShader'

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
  const gl = useThree((state) => state.gl)

  const { geometries, materials, shared, bake } = useMemo(() => {
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
      useBaked: { value: 0 },
    }
    // Shadows are baked into one half-float texture per grid when the GPU can
    // render to it; otherwise the shader marches per pixel exactly as before.
    const canBake = gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float')
    sharedUniforms.useBaked.value = canBake ? 1 : 0
    const levels = [
      { grid: terrain.near, u: near, start: terrain.near.spacingM, bias: 0.5 },
      { grid: terrain.mid, u: mid, start: terrain.mid.spacingM, bias: 20 },
      { grid: terrain.far, u: far, start: terrain.far.spacingM, bias: 40 },
    ]
    const targets = canBake
      ? levels.map(
          ({ grid }) =>
            new WebGLRenderTarget(grid.size, grid.size, {
              type: HalfFloatType,
              format: RGBAFormat,
              minFilter: LinearFilter,
              magFilter: LinearFilter,
              depthBuffer: false,
              generateMipmaps: false,
            }),
        )
      : []
    const makeMaterial = (level: number) =>
      new ShaderMaterial({
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        uniforms: {
          ...sharedUniforms,
          gridLevel: { value: level },
          shadowStart: { value: levels[level].start },
          shadowBias: { value: levels[level].bias },
          shadowMap: { value: targets[level]?.texture ?? null },
          ownInverse: levels[level].u.inverse,
          ownOrigin: levels[level].u.origin,
          ownSize: levels[level].u.size,
        },
      })
    const bakeUniforms = {
      ...sharedUniforms,
      shadowStart: { value: 0 },
      shadowBias: { value: 0 },
      bakeAffine: { value: new Vector4() },
      bakeOrigin: { value: new Vector2() },
      bakeHeightSize: { value: new Vector2() },
      bakeHeights: { value: near.heights.value },
    }
    const bakeMaterial = new ShaderMaterial({
      vertexShader: bakeVertexShader,
      fragmentShader: bakeFragmentShader,
      uniforms: bakeUniforms,
      depthTest: false,
      depthWrite: false,
    })
    const bakeScene = new Scene()
    const bakeQuad = new Mesh(new PlaneGeometry(2, 2), bakeMaterial)
    bakeQuad.frustumCulled = false
    bakeScene.add(bakeQuad)
    const bakeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    return {
      geometries: [buildGridGeometry(terrain.near), buildGridGeometry(terrain.mid), buildGridGeometry(terrain.far)],
      // Start the shadow march about one cell away, with a height bias, so a
      // surface does not shadow itself (larger on coarser grids).
      materials: [makeMaterial(0), makeMaterial(1), makeMaterial(2)],
      shared: sharedUniforms,
      bake: {
        enabled: canBake,
        run: () => {
          const previous = gl.getRenderTarget()
          levels.forEach(({ grid, u, start, bias }, i) => {
            const [a, b, c, d, e, f] = grid.affine
            bakeUniforms.bakeAffine.value.set(a, b, d, e)
            bakeUniforms.bakeOrigin.value.set(c, f)
            bakeUniforms.bakeHeightSize.value.set(grid.size, grid.size)
            bakeUniforms.bakeHeights.value = u.heights.value
            bakeUniforms.shadowStart.value = start
            bakeUniforms.shadowBias.value = bias
            gl.setRenderTarget(targets[i])
            gl.render(bakeScene, bakeCamera)
          })
          gl.setRenderTarget(previous)
        },
        dispose: () => {
          targets.forEach((t) => t.dispose())
          bakeMaterial.dispose()
          bakeQuad.geometry.dispose()
        },
      },
    }
  }, [terrain])

  useEffect(() => () => bake.dispose(), [bake])

  useEffect(() => {
    applySample(shared, sample)
    if (bake.enabled) bake.run()
    invalidate()
  }, [sample, shared, bake, invalidate])

  return (
    <>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={materials[i]} />
      ))}
    </>
  )
}
