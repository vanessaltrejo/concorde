// One client for every provider: Gemini, Groq and OpenRouter all serve the
// OpenAI chat-completions format. Swap with the AI_PROVIDER env var.
import type { ToolCall, ToolDef, WireMessage } from '../../src/assistant/protocol.js'

type ProviderConfig = { baseUrl: string; keyEnv: string; defaultModel: string }

// Default model names are not verified for this account: set AI_MODEL after
// checking the provider console.
const PROVIDERS: Record<string, ProviderConfig> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash-lite',
  },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', defaultModel: 'openai/gpt-oss-120b' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', defaultModel: 'openai/gpt-oss-120b:free' },
}

export type ModelMessage = { role: 'system'; content: string } | WireMessage

export type ModelReply = { content: string | null; toolCalls: ToolCall[] }

export class ProviderError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function providerConfig(): (ProviderConfig & { name: string; key: string | undefined; model: string }) {
  const name = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase()
  const config = PROVIDERS[name]
  if (!config) throw new ProviderError(500, `Unknown AI_PROVIDER "${name}"`)
  return { ...config, name, key: process.env[config.keyEnv], model: process.env.AI_MODEL || config.defaultModel }
}

export async function complete(
  messages: ModelMessage[],
  tools: ToolDef[],
  toolChoice: 'auto' | 'none' = 'auto',
): Promise<ModelReply> {
  const config = providerConfig()
  if (!config.key) throw new ProviderError(503, `${config.keyEnv} is not set`)
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools,
      tool_choice: toolChoice,
      temperature: 0.2,
      max_tokens: 700,
    }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new ProviderError(response.status, text.slice(0, 500))
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
  }
  const message = json.choices?.[0]?.message
  if (!message) throw new ProviderError(502, 'The model returned no message')
  return { content: message.content ?? null, toolCalls: message.tool_calls ?? [] }
}
