import { Billboard } from '@react-three/drei'
import { useLoader, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { ShaderMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three'
import type { SkySample } from '../types'
import { earthFrame } from '../scene/earthOrientation'
import { directionFromSky, discDiameterM, skyPointM } from '../scene/skyMath'

type EarthDiscProps = {
  sample: SkySample
  observerPosition: [number, number, number]
}

// NASA Blue Marble Next Generation (December 2004), resized to 2048 x 1024.
const earthTextureUrl = '/textures/earth_bmng_200412_2048.jpg'

// The Earth's disc as a sphere seen from the site:
// - lit from the real direction of the Sun, so the phase comes from geometry
//   (lit fraction matches JPL Horizons "Illu%" within 0.13 points);
// - textured with the side of the Earth that really faces the Moon
//   (sub-observer longitude from Horizons, pole from the RA/DEC rotation).
// The night side keeps a dim floor so the Earth is never invisible (visual aid).
const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D earthMap;
uniform vec3 sunDirection;
uniform vec3 earthPole;
uniform vec3 towardSubObserver;
uniform vec3 eastOfSubObserver;
uniform float subObserverLon;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  // Sphere normal in view space (the billboard faces the camera), then in scene axes.
  vec3 nView = vec3(p, sqrt(1.0 - r2));
  vec3 n = normalize((vec4(nView, 0.0) * viewMatrix).xyz);
  float lat = asin(clamp(dot(n, earthPole), -1.0, 1.0));
  float lon = subObserverLon + atan(dot(n, eastOfSubObserver), dot(n, towardSubObserver));
  vec2 mapUv = vec2(fract(lon / (2.0 * PI) + 0.5), lat / PI + 0.5);
  vec3 surface = texture2D(earthMap, mapUv).rgb;

  float lit = smoothstep(-0.04, 0.06, dot(n, sunDirection));
  float limb = 0.8 + 0.2 * nView.z;
  vec3 color = mix(surface * 0.16 + vec3(0.01, 0.02, 0.05), surface * limb, lit);
  float edge = 1.0 - smoothstep(0.96, 1.0, r2);
  gl_FragColor = vec4(color, edge);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function prepareTexture(texture: Texture): Texture {
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function applySample(material: ShaderMaterial, sample: SkySample): void {
  const frame = earthFrame(sample)
  material.uniforms.sunDirection.value.set(...directionFromSky(sample.sun))
  material.uniforms.earthPole.value.set(...frame.pole)
  material.uniforms.towardSubObserver.value.set(...frame.towardSubObserver)
  material.uniforms.eastOfSubObserver.value.set(...frame.eastOfSubObserver)
  material.uniforms.subObserverLon.value = frame.subObserverLonRad
}

export function EarthDisc({ sample, observerPosition }: EarthDiscProps) {
  const invalidate = useThree((state) => state.invalidate)
  const loaded = useLoader(TextureLoader, earthTextureUrl)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        uniforms: {
          earthMap: { value: prepareTexture(loaded) },
          sunDirection: { value: new Vector3(0, 1, 0) },
          earthPole: { value: new Vector3(0, 1, 0) },
          towardSubObserver: { value: new Vector3(1, 0, 0) },
          eastOfSubObserver: { value: new Vector3(0, 0, 1) },
          subObserverLon: { value: 0 },
        },
      }),
    [loaded],
  )

  useEffect(() => {
    applySample(material, sample)
    invalidate()
  }, [material, sample, invalidate])

  const sizeM = discDiameterM(sample.earth.angularDiameterDeg)
  return (
    <Billboard position={skyPointM(sample.earth, observerPosition)}>
      <mesh material={material}>
        <planeGeometry args={[sizeM, sizeM]} />
      </mesh>
    </Billboard>
  )
}
