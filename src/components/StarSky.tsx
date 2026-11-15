import { Stars } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { CubeTextureLoader, SRGBColorSpace } from 'three'

// Real star map (Tycho-2 cube map, made for Z-up) as the scene background,
// rotated to three.js Y-up so the faces line up without seams.
export function StarSky() {
  const { scene, invalidate } = useThree()
  useEffect(() => {
    const dir = '/textures/stars-h/tycho2t3_80_'
    const tex = new CubeTextureLoader().load(
      ['px', 'mx', 'py', 'my', 'pz', 'mz'].map((f) => `${dir}${f}.jpg`),
      () => invalidate(),
    )
    tex.colorSpace = SRGBColorSpace
    // The faces follow the OpenGL cube convention (as in Cesium); three.js would
    // mirror them for image-loaded cube maps, which broke the face edges.
    tex.isRenderTargetTexture = true
    scene.background = tex
    scene.backgroundRotation.set(-Math.PI / 2, 0, 0)
    scene.backgroundIntensity = 1
    return () => {
      scene.background = null
      tex.dispose()
    }
  }, [scene, invalidate])
  return <Stars radius={400_000} depth={20_000} count={2500} factor={4000} saturation={0} fade={false} />
}
