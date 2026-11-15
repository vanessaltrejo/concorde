// One user turn: send the conversation to /api/chat, run any tool calls in the
// browser, send the results back, until the server returns a final answer.
import type { ChatResponse, WireMessage } from './protocol'
import { runTool, type AppBridge } from './tools'

const MAX_ROUND_TRIPS = 6

export type TurnStep = { kind: 'read' | 'change'; tool: string; action?: string }

export type TurnResult = {
  history: WireMessage[]
  text: string
  status: 'answer' | 'blocked' | 'error'
  sources: string[]
  steps: TurnStep[]
  retried: boolean
  // Provider and model that answered (empty on errors).
  via: string
}

const WRITE_TOOLS = new Set([
  'setDate',
  'setStayDays',
  'setLayer',
  'selectSite',
  'openHorizonView',
  'backToOrbitalView',
  'setRequirements',
])

async function post(messages: WireMessage[]): Promise<ChatResponse> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    return (await response.json()) as ChatResponse
  } catch {
    return { type: 'error', code: 'provider', message: 'Could not reach the assistant server.' }
  }
}

export async function runTurn(
  previous: WireMessage[],
  question: string,
  bridge: AppBridge,
  onStep: (step: TurnStep) => void,
): Promise<TurnResult> {
  const history: WireMessage[] = [...previous, { role: 'user', content: question }]
  const sources = new Set<string>()
  const steps: TurnStep[] = []

  for (let trip = 0; trip < MAX_ROUND_TRIPS; trip++) {
    const reply = await post(history)
    if (reply.type === 'tool_calls') {
      history.push(reply.message)
      for (const call of reply.message.tool_calls ?? []) {
        const outcome = await runTool(call.function.name, call.function.arguments, bridge)
        outcome.sources.forEach((s) => sources.add(s))
        const step: TurnStep = {
          kind: WRITE_TOOLS.has(call.function.name) ? 'change' : 'read',
          tool: call.function.name,
          action: outcome.action,
        }
        steps.push(step)
        onStep(step)
        history.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(outcome.result) })
      }
      continue
    }
    if (reply.type === 'error') {
      // Drop the unanswered question so the next try starts clean.
      return { history: previous, text: reply.message, status: 'error', sources: [], steps, retried: false, via: '' }
    }
    history.push({ role: 'assistant', content: reply.content })
    return {
      history,
      text: reply.content,
      status: reply.type,
      sources: reply.type === 'answer' ? [...sources] : [],
      steps,
      retried: reply.type === 'answer' && reply.retried,
      via: reply.via,
    }
  }
  const text = 'That took too many steps. Please ask a simpler question.'
  history.push({ role: 'assistant', content: text })
  return { history, text, status: 'error', sources: [], steps, retried: false, via: '' }
}
