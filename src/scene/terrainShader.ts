// Terrain shading with real cast shadows.
//
// Shadows: for every pixel the shader marches over the LOLA height grids toward
// the Sun (and toward the Earth for the earthshine fill light) and finds the
// highest terrain angle in that direction. This is the same horizon method used
// for the site metrics (Mazarico et al. 2011, Glaser et al. 2018), so the 3D
// shadows follow the same data and the same disc rule as the sidebar.
//
// Surface: lunar-Lambert reflectance (McEwen 1991), a mix of Lommel-Seeliger
// (2 * mu0 / (mu0 + mu)) and Lambert (mu0), standard for lunar photometry.
//
// The three grids (near 20 m to 10 km, mid 320 m to 80 km, far 640 m to 200 km)
// are float height textures plus an inverse affine map from scene x, z to grid
// col, row. scripts/check_shadow_method.py repeats this method on the CPU and
// compares it with the validated site horizon.

export const terrainVertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vWorld = position;
  vNormal = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`

const terrainCommon = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>

uniform sampler2D nearHeights;
uniform vec4 nearInverse; // columns of the 2x2 inverse map
uniform vec2 nearOrigin;
uniform float nearSize;

uniform sampler2D midHeights;
uniform vec4 midInverse;
uniform vec2 midOrigin;
uniform float midSize;

uniform sampler2D farHeights;
uniform vec4 farInverse;
uniform vec2 farOrigin;
uniform float farSize;

uniform vec3 sunDirection;
uniform float sunRadius;
uniform float sunIntensity;

uniform vec3 earthDirection;
uniform float earthRadius;
uniform float earthIntensity;

uniform float ambientIntensity;
uniform vec3 albedo;
// 0 = near, 1 = mid, 2 = far. A grid skips pixels the finer grid already draws.
uniform float gridLevel;
uniform float shadowBias;
uniform float shadowStart;

varying vec3 vWorld;
varying vec3 vNormal;

vec2 gridUv(vec2 xz, vec4 inverseColumns, vec2 origin, float size) {
  vec2 colRow = mat2(inverseColumns.xy, inverseColumns.zw) * (xz - origin);
  return (colRow + 0.5) / size;
}

bool insideUv(vec2 uv) {
  return uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0;
}

// Terrain height at scene x, z from the finest grid that covers it.
bool heightAt(vec2 xz, out float height) {
  vec2 uv = gridUv(xz, nearInverse, nearOrigin, nearSize);
  if (insideUv(uv)) {
    height = texture2D(nearHeights, uv).r;
    return true;
  }
  uv = gridUv(xz, midInverse, midOrigin, midSize);
  if (insideUv(uv)) {
    height = texture2D(midHeights, uv).r;
    return true;
  }
  uv = gridUv(xz, farInverse, farOrigin, farSize);
  if (insideUv(uv)) {
    height = texture2D(farHeights, uv).r;
    return true;
  }
  return false;
}

// Highest terrain angle (as a tangent) seen from p toward a horizontal direction.
float horizonTangent(vec3 p, vec2 direction, float stopTangent) {
  float best = -1e6;
  float t = shadowStart;
  for (int i = 0; i < 220; i++) {
    float height;
    if (!heightAt(p.xz + direction * t, height)) break;
    best = max(best, (height - p.y - shadowBias) / t);
    // Terrain already covers the whole disc: more steps cannot change the result.
    if (best > stopTangent) break;
    t *= 1.05;
  }
  return best;
}

// Fraction of a disc above a straight horizon line (same rule as the sidebar).
float discFraction(float centerElevation, float horizonElevation, float radius) {
  float d = clamp((centerElevation - horizonElevation) / radius, -1.0, 1.0);
  return 1.0 - (acos(d) - d * sqrt(1.0 - d * d)) / PI;
}

float lightVisibility(vec3 p, vec3 lightDirection, float radius) {
  float horizontal = length(lightDirection.xz);
  if (horizontal < 1e-5) return 1.0;
  float elevation = asin(clamp(lightDirection.y, -1.0, 1.0));
  if (elevation < -0.2) return 0.0;
  float top = elevation + radius;
  float stopTangent = top < 1.5 ? tan(top) : 1e6;
  float horizon = atan(horizonTangent(p, lightDirection.xz / horizontal, stopTangent));
  return discFraction(elevation, horizon, radius);
}

`

export const terrainFragmentShader = /* glsl */ `
${terrainCommon}
uniform sampler2D shadowMap;
uniform float useBaked;
uniform vec4 ownInverse;
uniform vec2 ownOrigin;
uniform float ownSize;

// Lunar-Lambert reflectance with weight L = 0.5 between the two terms.
float lunarLambert(vec3 n, vec3 l, vec3 v) {
  float mu0 = max(dot(n, l), 0.0);
  float mu = max(dot(n, v), 0.05);
  float lunarWeight = 0.5;
  return lunarWeight * 2.0 * mu0 / (mu0 + mu) + (1.0 - lunarWeight) * mu0;
}

void main() {
  #include <logdepthbuf_fragment>

  if (gridLevel > 0.5 && insideUv(gridUv(vWorld.xz, nearInverse, nearOrigin, nearSize))) discard;
  if (gridLevel > 1.5 && insideUv(gridUv(vWorld.xz, midInverse, midOrigin, midSize))) discard;

  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);

  // Shadow visibility baked once per Sun/Earth position (r = Sun, g = Earth).
  vec2 baked = texture2D(shadowMap, gridUv(vWorld.xz, ownInverse, ownOrigin, ownSize)).rg;
  bool useBake = useBaked > 0.5;

  float sunLight = 0.0;
  if (sunIntensity > 0.0 && dot(n, sunDirection) > 0.0) {
    float vis = useBake ? baked.r : lightVisibility(vWorld, sunDirection, sunRadius);
    sunLight = sunIntensity * lunarLambert(n, sunDirection, v) * vis;
  }
  float earthLight = 0.0;
  if (earthIntensity > 0.0 && dot(n, earthDirection) > 0.0) {
    float vis = useBake ? baked.g : lightVisibility(vWorld, earthDirection, earthRadius);
    earthLight = earthIntensity * lunarLambert(n, earthDirection, v) * vis;
  }

  vec3 color = albedo * (sunLight + earthLight + ambientIntensity);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// Bake pass: one texel per height-grid cell. Stores how much of the Sun disc
// (r) and of the Earth disc (g) the terrain leaves visible from that cell. The
// camera does not change this, so it runs only when the Sun or Earth moves.
export const bakeVertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const bakeFragmentShader = /* glsl */ `
${terrainCommon.replace('#include <logdepthbuf_pars_fragment>', '')}
uniform vec4 bakeAffine; // a, b, d, e: scene xz = [[a, b], [d, e]] * (col, row) + origin
uniform vec2 bakeOrigin;
uniform vec2 bakeHeightSize;
uniform sampler2D bakeHeights;

void main() {
  vec2 colRow = floor(gl_FragCoord.xy);
  vec2 xz = vec2(bakeAffine.x * colRow.x + bakeAffine.y * colRow.y, bakeAffine.z * colRow.x + bakeAffine.w * colRow.y) + bakeOrigin;
  float height = texture2D(bakeHeights, (colRow + 0.5) / bakeHeightSize).r;
  vec3 p = vec3(xz.x, height, xz.y);
  float sunVis = sunIntensity > 0.0 ? lightVisibility(p, sunDirection, sunRadius) : 0.0;
  float earthVis = earthIntensity > 0.0 ? lightVisibility(p, earthDirection, earthRadius) : 0.0;
  gl_FragColor = vec4(sunVis, earthVis, 0.0, 1.0);
}
`
