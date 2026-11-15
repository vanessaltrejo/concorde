// Strict number check (AI-13): every number in the model's answer must match a
// number from a tool result, the user's own messages or the app guide. No
// imports, so `node api/_lib/verify.test.ts` can run it directly.

export type VerifyResult = { ok: boolean; unverified: string[] }

// A number not glued to letters ("3D", "C1" and "LRO_WAC" are skipped).
const NUMBER_RE = /(?<![\p{L}\p{N}_.])[-−]?\d+(?:[.,]\d+)*(?![\p{L}\p{N}_])/gu

type Parsed = { value: number; decimals: number }

// "1,000" may be a thousand (English) or 1.000 (Spanish): keep every reading.
function readings(token: string): Parsed[] {
  const t = token.replace('−', '-')
  const out: Parsed[] = []
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) {
    const plain = t.replace(/,/g, '')
    out.push({ value: Number(plain), decimals: (plain.split('.')[1] ?? '').length })
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    const plain = t.replace(/\./g, '').replace(',', '.')
    out.push({ value: Number(plain), decimals: (plain.split('.')[1] ?? '').length })
  }
  const simple = /^-?\d+([.,]\d+)?$/.exec(t)
  if (simple) out.push({ value: Number(t.replace(',', '.')), decimals: (simple[1] ?? '').length - (simple[1] ? 1 : 0) })
  return out.filter((p) => Number.isFinite(p.value))
}

export function extractNumbers(text: string): string[] {
  return text.match(NUMBER_RE) ?? []
}

// Numbers that may appear in an answer. Signs are dropped too ("89.78° S").
export function allowedValues(sources: string[]): number[] {
  const values = new Set<number>()
  for (const source of sources) {
    for (const token of extractNumbers(source)) {
      for (const { value } of readings(token)) {
        values.add(value)
        values.add(Math.abs(value))
      }
    }
  }
  return [...values]
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

// Markdown list markers ("1. ", "2) ") are numbering, not data.
function stripListMarkers(text: string): string {
  return text.replace(/^\s*\d+[.)]\s/gm, '')
}

export function verifyNumbers(answer: string, allowed: number[]): VerifyResult {
  const unverified: string[] = []
  for (const token of extractNumbers(stripListMarkers(answer))) {
    const ok = readings(token).some(({ value, decimals }) =>
      allowed.some((v) => Math.abs(roundTo(v, decimals) - value) < 1e-9 || Math.abs(roundTo(Math.abs(v), decimals) - Math.abs(value)) < 1e-9),
    )
    if (!ok) unverified.push(token)
  }
  return { ok: unverified.length === 0, unverified }
}

// A verdict the app never gives (rule: never say a site is "safe").
const VERDICT_RE = /\b(is|are|it's|looks|seems|would be)\s+(very\s+)?safe\b|\bes\s+(muy\s+)?segur[oa]\b/i

export function hasSafetyVerdict(answer: string): boolean {
  return VERDICT_RE.test(answer)
}
