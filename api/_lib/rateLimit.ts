// Per-visitor limit for the shared demo link (AI-5). In memory: each server
// instance keeps its own count, so on Vercel this is a soft limit. A durable
// limit needs a store (team decision, see docs/AI_ASSISTANT_PLAN.md).

const WINDOW_MS = 60 * 60 * 1000
const hits = new Map<string, number[]>()

export function checkRateLimit(visitor: string, limit: number, now = Date.now()): { ok: boolean; retryAfterMin: number } {
  const recent = (hits.get(visitor) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= limit) {
    hits.set(visitor, recent)
    return { ok: false, retryAfterMin: Math.ceil((WINDOW_MS - (now - recent[0])) / 60_000) }
  }
  recent.push(now)
  hits.set(visitor, recent)
  // Keep memory bounded on a long-lived instance.
  if (hits.size > 5000) hits.clear()
  return { ok: true, retryAfterMin: 0 }
}
