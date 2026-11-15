// Run: node api/_lib/router.test.ts
import assert from 'node:assert/strict'
import { classify, providerOrder, type RoutingEnv } from './router.ts'

const simple = [
  'How do I use this app?',
  'What am I looking at?',
  'Show me November 20 at noon',
  'Open the horizon view for Connecting Ridge C1',
  'Make the stay 10 days',
  'When does the Earth set?',
  '¿Cuánto dura la estancia?',
]
const complex = [
  'Which sites have Sun the whole stay and at least 25% Earth link?',
  'Compare Shackleton rim and Apollo 16 for Earth link',
  'Is Shackleton rim safe to land?',
  '¿Es seguro aterrizar en Apollo 11?',
  'What slope limit does NASA use? Explain why.',
  '¿Cuál sitio es mejor para comunicación?',
  'Can I use 8° as the slope limit?',
]
for (const q of simple) assert.equal(classify(q), 'simple', q)
for (const q of complex) assert.equal(classify(q), 'complex', q)

const keys = new Set(['gemini', 'groq'])
const env: RoutingEnv = {
  routing: undefined,
  fixed: 'gemini',
  simple: 'gemini',
  complex: 'groq',
  hasKey: (p) => keys.has(p),
  all: ['gemini', 'groq', 'openrouter'],
}
assert.deepEqual(providerOrder('simple', env), ['gemini', 'groq'])
assert.deepEqual(providerOrder('complex', env), ['groq', 'gemini'])
assert.deepEqual(providerOrder('complex', { ...env, routing: 'off' }), ['gemini', 'groq'])
keys.delete('groq')
assert.deepEqual(providerOrder('complex', env), ['gemini']) // no Groq key: Gemini only

console.log(`router.test.ts: ${simple.length + complex.length + 4} checks passed`)
