// One client for every provider: Gemini, Groq and OpenRouter all serve the
// OpenAI chat-completions format. Which provider answers is chosen per
// question by router.ts; the next one in the list is the fallback.
import type { ToolCall, ToolDef, WireMessage } from '../../src/assistant/protocol.js'
import { classify, providerOrder, type Complexity } from './router.js'

type ProviderConfig = { label: string; baseUrl: string; keyEnv: string; modelEnv: string; defaultModel: string }

// Default model names: Gemini checked 2026-11-15 (its API named
// gemini-3.5-flash-lite as the replacement for 2.5); Groq and OpenRouter not
// verified for this account. Override with AI_MODEL_GEMINI / AI_MODEL_GROQ / AI_MODEL_OPENROUTER.
const PROVIDERS: Record<string, ProviderConfig> = {
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    modelEnv: 'AI_MODEL_GEMINI',
    defaultModel: 'gemini-3.5-flash-lite',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'AI_MODEL_GROQ',
    defaultModel: 'openai/gpt-oss-120b',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'AI_MODEL_OPENROUTER',
    defaultModel: 'openai/gpt-oss-120b:free',
  },
}

export type ModelMessage = { role: 'system'; content: string } | WireMessage

export type ModelReply = { content: string | null; toolCalls: ToolCall[]; provider: string; via: string }

export class ProviderError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function env(name: string): string | undefined {
  return process.env[name] || undefined
}

function modelFor(name: string, config: ProviderConfig): string {
  // AI_MODEL (old single setting) still applies to the fixed provider.
  return env(config.modelEnv) ?? (name === (env('AI_PROVIDER') ?? 'gemini') ? env('AI_MODEL') : undefined) ?? config.defaultModel
}

// Providers to try for this question, in order (only those with a key).
export function routeFor(question: string): { complexity: Complexity; order: string[] } {
  const complexity = classify(question)
  const order = providerOrder(complexity, {
    routing: env('AI_ROUTING'),
    fixed: (env('AI_PROVIDER') ?? 'gemini').toLowerCase(),
    simple: (env('AI_SIMPLE_PROVIDER') ?? 'gemini').toLowerCase(),
    complex: (env('AI_COMPLEX_PROVIDER') ?? 'groq').toLowerCase(),
    hasKey: (p) => Boolean(PROVIDERS[p] && env(PROVIDERS[p].keyEnv)),
    all: Object.keys(PROVIDERS),
  })
  return { complexity, order }
}

async function callProvider(name: string, messages: ModelMessage[], tools: ToolDef[], toolChoice: 'auto' | 'none'): Promise<ModelReply> {
  const config = PROVIDERS[name]
  const key = config ? env(config.keyEnv) : undefined
  if (!config || !key) throw new ProviderError(503, `No key for provider "${name}"`)
  const model = modelFor(name, config)
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    // No tools offered (the rewrite step): send neither field, some providers reject an empty list.
    body: JSON.stringify({
      model,
      messages,
      ...(tools.length ? { tools, tool_choice: toolChoice } : {}),
      temperature: 0.2,
      max_tokens: 700,
    }),
  })
  if (!response.ok) throw new ProviderError(response.status, `${config.label}: ${(await response.text()).slice(0, 500)}`)
  const json = (await response.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
  }
  const message = json.choices?.[0]?.message
  if (!message) throw new ProviderError(502, `${config.label}: the model returned no message`)
  return { content: message.content ?? null, toolCalls: message.tool_calls ?? [], provider: name, via: `${config.label} · ${model}` }
}

// Tries each provider in order; any failure (quota, server error, unknown
// model, network) moves on to the next. If all fail, a quota error wins, so
// the user sees the quota message.
export async function complete(
  order: string[],
  messages: ModelMessage[],
  tools: ToolDef[],
  toolChoice: 'auto' | 'none' = 'auto',
): Promise<ModelReply> {
  if (!order.length) throw new ProviderError(503, 'No model key is set')
  const errors: ProviderError[] = []
  for (const name of order) {
    try {
      return await callProvider(name, messages, tools, toolChoice)
    } catch (error) {
      const e = error instanceof ProviderError ? error : new ProviderError(502, `${name}: ${String(error)}`)
      console.warn(`[api/chat] ${name} failed (${e.status}), trying the next provider`, e.message.slice(0, 300))
      errors.push(e)
    }
  }
  throw errors.find((e) => e.status === 429) ?? errors[errors.length - 1]
}
