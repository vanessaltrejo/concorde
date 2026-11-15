// Validation of the browser terrain engine against the validated per-site
// files (docs/HORIZON_ANYWHERE_PLAN.md step 8). Runs in Node on the LOCAL
// tiles (same decoders the browser uses), so no network is needed.
//
//   node --experimental-strip-types src/terrain/validate.test.ts [siteId ...]
//
// Pass mark (agreed before building): for each curated site,
//   - median |horizon difference| < 0.1° over the 1440 bins;
//   - the Sun and Earth visible-or-hidden decision (top edge above the terrain
//     horizon, the app's rule) agrees in at least 99% of the hourly samples.
// Also reported: max horizon difference, grid sizes and the largest position
// difference per grid, time and tiles loaded.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { siteSlope, TerrainEngine } from './engine.ts'
import { skyAtPoint, type Ephemeris } from '../scene/zones.ts'
import type { Manifest } from './tiles.ts'

const TILES_DIR = process.env.TERRAIN_TILES_DIR
  ? join(process.env.TERRAIN_TILES_DIR, 'tiles')
  : join(process.env.USERPROFILE ?? process.env.HOME ?? '', 'concorde-terrain-tiles-2026', 'tiles')
const DATA_DIR = join(import.meta.dirname, '..', '..', 'public', 'data')

const SITES: Record<string, { lat: number; lon: number }> = {
  'shackleton-rim': { lat: -89.7849, lon: 203.97 },
  'connecting-ridge-c1': { lat: -89.4398, lon: 222.83 },
  'connecting-ridge-c2': { lat: -89.313, lon: 245.98 },
  'apollo-11': { lat: 0.67416, lon: 23.47314 },
  'apollo-16': { lat: -8.9734, lon: 15.5011 },
  'apollo-17': { lat: 20.1911, lon: 30.7723 },
}

type Body = { azimuthDeg: number; elevationDeg: number; angularDiameterDeg: number }
type Sample = { timeUtc: string; sun: Body; earth: Body; earthIlluminatedPct: number }

function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}

function horizonAt(profile: ArrayLike<number>, azimuthDeg: number): number {
  const count = profile.length
  const x = (((azimuthDeg / 0.25) % count) + count) % count
  const k = Math.floor(x)
  const f = x - k
  return profile[k] * (1 - f) + profile[(k + 1) % count] * f
}

function visible(body: Body, profile: ArrayLike<number>): boolean {
  return body.elevationDeg + body.angularDiameterDeg / 2 - horizonAt(profile, body.azimuthDeg) > 0
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(TILES_DIR, 'manifest.json'), 'utf8')) as Manifest
  const fetchTile = async (url: string) => {
    const rel = url.replace('file://', '')
    try {
      const buf = readFileSync(join(TILES_DIR, rel))
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    } catch {
      return null
    }
  }
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SITES)
  const eph = JSON.parse(readFileSync(join(DATA_DIR, 'ephemeris.json'), 'utf8')) as { startUtc: string; stepHours: number; rows: number[][] }
  const ephemeris: Ephemeris = { startMs: Date.parse(eph.startUtc), stepMs: eph.stepHours * 3_600_000, rows: eph.rows }
  let failures = 0
  for (const id of ids) {
    const site = SITES[id]
    const engine = new TerrainEngine(manifest, 'file://', fetchTile)
    const t0 = performance.now()
    const result = await engine.compute(site.lon, site.lat)
    const seconds = ((performance.now() - t0) / 1000).toFixed(1)

    const ref = JSON.parse(readFileSync(join(DATA_DIR, id, 'horizon.json'), 'utf8')) as { elevationDeg: number[] }
    const diffs = ref.elevationDeg.map((v, k) => Math.abs(v - result.horizonDeg[k]))
    const med = median(diffs)
    const max = Math.max(...diffs)

    const sky = JSON.parse(readFileSync(join(DATA_DIR, id, 'sky.json'), 'utf8')) as { samples: Sample[] }
    let agree = 0
    for (const s of sky.samples) {
      if (visible(s.sun, ref.elevationDeg) === visible(s.sun, result.horizonDeg)) agree++
      if (visible(s.earth, ref.elevationDeg) === visible(s.earth, result.horizonDeg)) agree++
    }
    const agreePct = (100 * agree) / (2 * sky.samples.length)

    // Sky for any point (geometry) vs this site's own Horizons table.
    let maxSkyPos = 0
    let maxDiam = 0
    let maxIllum = 0
    let skyAgree = 0
    sky.samples.forEach((s, i) => {
      assert.equal(Date.parse(s.timeUtc), ephemeris.startMs + i * ephemeris.stepMs)
      const g = skyAtPoint(ephemeris, i, site.lon, site.lat)
      for (const k of ['sun', 'earth'] as const) {
        // Azimuth is meaningless right at the zenith; weight it by cos(elevation).
        const dAz = angleDiff(g[k].azimuthDeg, s[k].azimuthDeg) * Math.cos((s[k].elevationDeg * Math.PI) / 180)
        maxSkyPos = Math.max(maxSkyPos, dAz, Math.abs(g[k].elevationDeg - s[k].elevationDeg))
        maxDiam = Math.max(maxDiam, Math.abs(g[k].angularDiameterDeg - s[k].angularDiameterDeg))
        // Same horizon, sky from geometry vs sky from Horizons: same decision?
        if (visible(g[k], ref.elevationDeg) === visible(s[k], ref.elevationDeg)) skyAgree++
      }
      maxIllum = Math.max(maxIllum, Math.abs(g.earthIlluminatedPct - s.earthIlluminatedPct))
    })
    const skyAgreePct = (100 * skyAgree) / (2 * sky.samples.length)

    const meta = JSON.parse(readFileSync(join(DATA_DIR, id, 'terrain.json'), 'utf8')) as {
      grids: Record<'near' | 'mid' | 'far', { size: number; spacingM: number; file: string }>
    }
    const gridNotes: string[] = []
    for (const name of ['near', 'mid', 'far'] as const) {
      const g = meta.grids[name]
      const ours = result[name]
      const buf = readFileSync(join(DATA_DIR, id, g.file))
      const refPos = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
      let maxPos = 0
      if (g.size === ours.size) {
        for (let i = 0; i < refPos.length; i += 3) {
          const d = Math.hypot(refPos[i] - ours.positions[i], refPos[i + 1] - ours.positions[i + 1], refPos[i + 2] - ours.positions[i + 2])
          if (d > maxPos) maxPos = d
        }
      }
      const sizeOk = g.size === ours.size && Math.abs(g.spacingM - ours.spacingM) < 1e-6
      gridNotes.push(`${name} ${ours.size}x${ours.size}@${ours.spacingM.toFixed(0)}m ${sizeOk ? `maxΔ ${maxPos.toFixed(2)} m` : `SIZE MISMATCH (ref ${g.size}@${g.spacingM})`}`)
      if (!sizeOk) failures++
    }

    // Sky pass mark: the same visible/hidden decision in at least 99% of hours,
    // positions within 0.05° (Phase 6 measured 0.006°), lit fraction within 1 point.
    // Slope: same plane fit as scripts/site_slopes.py, vs public/data/site_slopes.json.
    const slopes = JSON.parse(readFileSync(join(DATA_DIR, 'site_slopes.json'), 'utf8')) as { sites: Record<string, { slopeDeg: number; baselineM: number }> }
    const refSlope = slopes.sites[id]
    const ourSlope = siteSlope(result.near)
    const slopeOk = !refSlope || (ourSlope !== null && Math.abs(ourSlope.slopeDeg - refSlope.slopeDeg) <= 0.01 && ourSlope.baselineM === refSlope.baselineM)
    const pass = med < 0.1 && agreePct >= 99 && skyAgreePct >= 99 && maxSkyPos < 0.05 && maxIllum < 1 && slopeOk
    if (!pass) failures++
    console.log(
      `${pass ? 'PASS' : 'FAIL'} ${id}: horizon median Δ ${med.toFixed(4)}° max Δ ${max.toFixed(3)}° (bin ${diffs.indexOf(max)}), ` +
        `visible/hidden agreement ${agreePct.toFixed(2)}%, ground ${result.groundHeightM.toFixed(2)} m, ` +
        `${result.tilesLoaded} tiles, ${seconds} s\n     ${gridNotes.join(' | ')}\n` +
        `     sky vs Horizons: position max Δ ${maxSkyPos.toFixed(4)}°, diameter max Δ ${maxDiam.toFixed(5)}°, ` +
        `Earth lit max Δ ${maxIllum.toFixed(3)} pts, decisions agree ${skyAgreePct.toFixed(2)}%
` +
        `     slope ${ourSlope?.slopeDeg}° @ ${ourSlope?.baselineM} m vs site_slopes.json ${refSlope?.slopeDeg}° @ ${refSlope?.baselineM} m`,
    )
  }
  assert.equal(failures, 0, `${failures} check(s) failed`)
  console.log('validate: all sites pass')
}

await main()
