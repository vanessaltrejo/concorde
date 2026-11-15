// POST /api/chat: Vercel serverless function (also served by `npm run dev`
// through the plugin in vite.config.ts). It holds the model key, calls the
// model with the app's tools, and checks every number in the final answer.
// Tools run in the browser: this function only returns their calls.
import { TOOL_DEFS, TOOL_NAMES, type ChatResponse, type WireMessage } from '../src/assistant/protocol.js'
import { APP_GUIDE, SYSTEM_PROMPT } from './_lib/prompt.js'
import { complete, ProviderError, type ModelMessage } from './_lib/provider.js'
import { checkRateLimit } from './_lib/rateLimit.js'
import { allowedValues, hasSafetyVerdict, verifyNumbers } from './_lib/verify.js'

const MAX_MESSAGES = 40
const MAX_USER_CHARS = 2000
const MAX_TOOL_CHARS = 12_000

const BLOCKED_TEXT =
  "I couldn't check every number in my answer against the app's data, so I'm not showing it. Try asking about one site or one value at a time."

function json(body: ChatResponse, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function badRequest(message: string): Response {
  return json({ type: 'error', code: 'bad_request', message }, 400)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Accept only the three message shapes the panel sends, within size limits.
function parseMessages(body: unknown): WireMessage[] | string {
  if (!isRecord(body) || !Array.isArray(body.messages)) return 'messages must be an array'
  const out: WireMessage[] = []
  for (const m of body.messages.slice(-MAX_MESSAGES)) {
    if (!isRecord(m)) return 'bad message'
    if (m.role === 'user' && typeof m.content === 'string') {
      out.push({ role: 'user', content: m.content.slice(0, MAX_USER_CHARS) })
    } else if (m.role === 'tool' && typeof m.tool_call_id === 'string' && typeof m.content === 'string') {
      out.push({ role: 'tool', tool_call_id: m.tool_call_id, content: m.content.slice(0, MAX_TOOL_CHARS) })
    } else if (m.role === 'assistant') {
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls.filter(isToolCall) : []
      out.push({
        role: 'assistant',
        content: typeof m.content === 'string' ? m.content : null,
        ...(calls.length ? { tool_calls: calls } : {}),
      })
    } else return 'bad message'
  }
  // Trimming may cut a turn in half; the model needs a user message first.
  while (out.length && out[0].role !== 'user') out.shift()
  return out.length ? out : 'no user message'
}

function isToolCall(value: unknown): value is NonNullable<Extract<WireMessage, { role: 'assistant' }>['tool_calls']>[number] {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isRecord(value.function) &&
    typeof value.function.name === 'string' &&
    typeof value.function.arguments === 'string'
  )
}

function errorResponse(error: unknown): Response {
  if (error instanceof ProviderError) {
    if (error.status === 503)
      return json({ type: 'error', code: 'no_key', message: 'The assistant is not configured yet (no model key on the server).' }, 503)
    if (error.status === 429)
      return json(
        { type: 'error', code: 'quota', message: "The assistant's free quota is used up for now. Please try again later." },
        429,
      )
    console.error('[api/chat] provider error', error.status, error.message)
  } else console.error('[api/chat]', error)
  return json({ type: 'error', code: 'provider', message: 'The AI provider did not answer. Please try again.' }, 502)
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Body must be JSON')
  }
  const messages = parseMessages(body)
  if (typeof messages === 'string') return badRequest(messages)

  // Only a new question counts toward the limit, not tool round trips.
  if (messages[messages.length - 1].role === 'user') {
    const visitor = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
    const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 30
    const rate = checkRateLimit(visitor, limit)
    if (!rate.ok)
      return json(
        {
          type: 'error',
          code: 'rate_limited',
          message: `You reached the demo limit of ${limit} questions per hour. Try again in ${rate.retryAfterMin} min.`,
        },
        429,
      )
  }

  const model: ModelMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
  try {
    const reply = await complete(model, TOOL_DEFS)
    const calls = reply.toolCalls.filter((c) => TOOL_NAMES.includes(c.function.name))
    if (calls.length) return json({ type: 'tool_calls', message: { role: 'assistant', content: reply.content, tool_calls: calls } })

    // Numbers may come from tool results, the user's own words or the app guide.
    const allowed = allowedValues([
      APP_GUIDE,
      ...messages.filter((m) => m.role === 'tool' || m.role === 'user').map((m) => m.content ?? ''),
    ])
    const first = check(reply.content ?? '', allowed)
    if (first.ok) return json({ type: 'answer', content: reply.content ?? '', retried: false })

    // One retry, told exactly what failed, with no more tool calls.
    const retry = await complete(
      [
        ...model,
        { role: 'assistant', content: reply.content ?? '' },
        {
          role: 'user',
          content: `Automatic check, not the user: ${first.problem} Rewrite the answer using only values from the tool results above, or say you don't have that data.`,
        },
      ],
      TOOL_DEFS,
      'none',
    )
    const second = check(retry.content ?? '', allowed)
    if (second.ok && retry.content) return json({ type: 'answer', content: retry.content, retried: true })
    return json({ type: 'blocked', content: BLOCKED_TEXT, unverified: second.unverified })
  } catch (error) {
    return errorResponse(error)
  }
}

function check(answer: string, allowed: number[]): { ok: boolean; unverified: string[]; problem: string } {
  const numbers = verifyNumbers(answer, allowed)
  const verdict = hasSafetyVerdict(answer)
  const problems: string[] = []
  if (!numbers.ok) problems.push(`these numbers are not in any tool result: ${numbers.unverified.join(', ')}.`)
  if (verdict) problems.push('the answer calls a site "safe", which the app never does.')
  return { ok: numbers.ok && !verdict && answer.trim().length > 0, unverified: numbers.unverified, problem: problems.join(' ') }
}
