// Chooses the model provider per question. No imports, so
// `node api/_lib/router.test.ts` can run it directly.
//
// Simple questions (how-to, "show me", one change) go to the fast provider
// with the bigger free quota; complex ones (compare, best, safe/viable,
// requirements, why) go to the stronger model. The other provider is the
// fallback when the first one fails (quota, server error).

export type Complexity = 'simple' | 'complex'

const COMPLEX_RE = new RegExp(
  [
    // English
    'compar', '\\bvs\\.?\\b', 'versus', '\\bwhich (sites?|one|is)\\b', '\\bbest\\b', '\\bbetter\\b', '\\bworst\\b', '\\brank',
    '\\bsafe', 'viab', 'recommend', '\\bwhy\\b', 'explain', '\\bshould\\b', 'requirement', 'threshold', 'criteri',
    '\\bmeet', '\\blimit', 'trade-?off', 'difference', '\\bplan\\b',
    // Spanish
    'cu[aá]l(es)?\\b', '\\bmejor', '\\bpeor', 'segur', 'recomiend', 'por ?qu[eé]', 'expl[ií]ca', 'deber[ií]a',
    'requisit', 'umbral', 'cumpl', 'diferencia',
  ].join('|'),
  'i',
)

// Long questions usually ask for several things at once.
const LONG_QUESTION_CHARS = 180

export function classify(question: string): Complexity {
  return question.length > LONG_QUESTION_CHARS || COMPLEX_RE.test(question) ? 'complex' : 'simple'
}

export type RoutingEnv = {
  routing: string | undefined // 'auto' (default) or 'off'
  fixed: string // AI_PROVIDER, used when routing is off
  simple: string // AI_SIMPLE_PROVIDER
  complex: string // AI_COMPLEX_PROVIDER
  hasKey: (provider: string) => boolean
  all: string[] // every known provider, for the fallback list
}

// Providers to try, in order. Only providers with a key are listed.
export function providerOrder(complexity: Complexity, env: RoutingEnv): string[] {
  const auto = (env.routing ?? 'auto').toLowerCase() !== 'off'
  const first = !auto ? env.fixed : complexity === 'complex' ? env.complex : env.simple
  const second = complexity === 'complex' ? env.simple : env.complex
  const order = [first, second, env.fixed, ...env.all]
  return [...new Set(order)].filter((p) => env.hasKey(p))
}
