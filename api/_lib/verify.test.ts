// Run: node api/_lib/verify.test.ts  (Node 24 runs TypeScript directly)
import assert from 'node:assert/strict'
import { allowedValues, extractNumbers, hasSafetyVerdict, verifyNumbers } from './verify.ts'

const tool = JSON.stringify({
  earth: { discVisiblePercent: 51.7, elevationDeg: 1.23, next: { timeUtc: '2026-12-01 02:34 UTC' } },
  site: { latitudeDeg: -89.7849 },
  stay: { sunPercent: 100, earthPercent: 49.6, days: 6.5 },
})
const allowed = allowedValues([tool, 'User: what about a 10 degree slope?'])

const cases: [string, boolean][] = [
  ['About 52% of the Earth disc is visible.', true], // 51.7 rounded
  ['51.7% of the disc', true],
  ['Earthset at 2026-12-01 02:34 UTC.', true],
  ['The site is at 89.78° S.', true], // sign dropped, rounded
  ['Earth link for 50% of the stay.', true], // 49.6 rounded
  ['A 6.5 day stay with Sun 100% of the time.', true],
  ['Slope limit 10°.', true], // from the user's message
  ['El 51,7% del disco', true], // Spanish decimal comma
  ['1. Open the Horizon view\n2. Press Look at Earth', true], // list markers
  ['The 3D view and site C1.', true], // glued to letters
  ['About 60% of the disc is visible.', false],
  ['Earthset at 03:10 UTC.', false],
  ['Slope is 7.5°.', false],
]

for (const [answer, expected] of cases) {
  const result = verifyNumbers(answer, allowed)
  assert.equal(result.ok, expected, `${answer} -> ${JSON.stringify(result)}`)
}

assert.deepEqual(extractNumbers('Shackleton rim, -89.7849°, 203.97° E'), ['-89.7849', '203.97'])
assert.equal(hasSafetyVerdict('This site is safe for landing.'), true)
assert.equal(hasSafetyVerdict('El sitio es seguro.'), true)
assert.equal(hasSafetyVerdict("I'm not a landing-safety engineer, but the data shows..."), false)

console.log(`verify.test.ts: ${cases.length + 4} checks passed`)
