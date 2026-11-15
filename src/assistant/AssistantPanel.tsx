import { useEffect, useRef, useState } from 'react'
import { runTurn, type TurnStep } from './client'
import type { WireMessage } from './protocol'
import { listen, speechSupported, type Recognition } from './speech'
import type { AppBridge } from './tools'

type ChatItem =
  | { role: 'user'; text: string }
  | {
      role: 'assistant'
      text: string
      status: 'answer' | 'blocked' | 'error'
      sources: string[]
      steps: TurnStep[]
      retried: boolean
      via: string
    }

const TOOL_LABELS: Record<string, string> = {
  getAppState: 'app state',
  explainCurrentView: 'current view',
  listSites: 'site list',
  getSiteMetrics: 'site metrics',
  evaluateRequirements: 'requirements check',
  listLayers: 'map layers',
  getThreshold: 'thresholds',
}

const EXAMPLES = [
  'What am I looking at?',
  'Is the Earth visible from Shackleton rim on Nov 17 at 00:00 UTC?',
  '¿Qué sitios cumplen 100% de Sol y 25% de enlace con la Tierra?',
  'Show me the slope layer',
]

type AssistantPanelProps = {
  bridge: AppBridge
  // Shows a banner on screen for every change the assistant makes (AI-2).
  onAnnounce: (text: string) => void
  open: boolean
  onToggle: () => void
}

// Side panel over either view (AI-12). Answers come only from the app's tools;
// the server drops any answer with a number no tool gave (AI-13).
export function AssistantPanel({ bridge, onAnnounce, open, onToggle }: AssistantPanelProps) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [history, setHistory] = useState<WireMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [liveSteps, setLiveSteps] = useState<TurnStep[]>([])
  const [listening, setListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState(() => (navigator.language.toLowerCase().startsWith('es') ? 'es-MX' : 'en-US'))
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recognitionRef = useRef<Recognition | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [items, liveSteps])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  async function ask(question: string) {
    const text = question.trim()
    if (!text || busy) return
    setItems((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setBusy(true)
    setLiveSteps([])
    const result = await runTurn(history, text, bridge, (step) => {
      setLiveSteps((prev) => [...prev, step])
      if (step.kind === 'change' && step.action) onAnnounce(step.action)
    })
    setHistory(result.history)
    setItems((prev) => [...prev, { role: 'assistant', ...result }])
    setLiveSteps([])
    setBusy(false)
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    setVoiceError(null)
    const recognition = listen(
      voiceLang,
      (text, final) => {
        setInput(text)
        if (final) void ask(text)
      },
      (error) => {
        setListening(false)
        recognitionRef.current = null
        if (error && error !== 'no-speech' && error !== 'aborted') setVoiceError(`Voice input failed (${error}).`)
      },
    )
    recognitionRef.current = recognition
    setListening(recognition !== null)
  }

  return (
    <aside
      aria-label="Assistant"
      className={
        'absolute inset-y-0 right-0 z-20 flex w-[24rem] max-w-full flex-col border-l border-[#444] bg-[#262626]/97 text-gray-100 shadow-2xl transition-transform duration-300 ease-out ' +
        (open ? '' : 'translate-x-full')
      }
    >
      <div inert={!open} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-[#444] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Assistant</h2>
          <p className="text-[11px] text-gray-400">Reads and changes the app for you. Planning aid, not flight grade.</p>
        </div>
        <button type="button" onClick={onToggle} aria-label="Close assistant" className="rounded px-2 text-gray-400 hover:bg-[#333] hover:text-white">
          ✕
        </button>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 text-sm">
        {items.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400">Ask about the site, the Sun, the Earth link or how to use the app. Try:</p>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void ask(example)}
                className="rounded border border-[#444] px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-[#333]"
              >
                {example}
              </button>
            ))}
          </div>
        )}
        {items.map((item, i) =>
          item.role === 'user' ? (
            <p key={i} className="self-end whitespace-pre-wrap rounded-lg bg-[#3d3d3d] px-3 py-2">
              {item.text}
            </p>
          ) : (
            <AssistantMessage key={i} item={item} />
          ),
        )}
        {busy && (
          <div className="text-xs text-gray-400">
            <StepList steps={liveSteps} />
            <p>{liveSteps.length ? 'Writing the answer…' : 'Thinking…'}</p>
          </div>
        )}
      </div>

      <form
        className="flex flex-col gap-2 border-t border-[#444] px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(input)
        }}
      >
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void ask(input)
              }
            }}
            rows={2}
            placeholder={listening ? 'Listening…' : 'Ask a question (English or Español)'}
            aria-label="Question"
            className="min-w-0 flex-1 resize-none rounded border border-[#444] bg-[#1e1e1e] px-2 py-1.5 text-sm outline-none focus:border-gray-400"
          />
          <div className="flex flex-col gap-1">
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded bg-[#3d3d3d] px-3 py-1 text-xs hover:bg-[#4a4a4a] disabled:opacity-40"
            >
              Send
            </button>
            {speechSupported && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={busy}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice input' : 'Voice input'}
                title={listening ? 'Stop' : 'Speak'}
                className={'rounded px-3 py-1 text-xs disabled:opacity-40 ' + (listening ? 'bg-[#D55E00] text-white' : 'bg-[#3d3d3d] hover:bg-[#4a4a4a]')}
              >
                {listening ? '■ Stop' : '🎤 Speak'}
              </button>
            )}
          </div>
        </div>
        {speechSupported && (
          <label className="flex items-center gap-2 text-[11px] text-gray-400">
            Voice language
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              className="rounded border border-[#444] bg-[#1e1e1e] px-1 py-0.5 text-gray-200"
            >
              <option value="en-US">English</option>
              <option value="es-MX">Español</option>
            </select>
          </label>
        )}
        {voiceError && <p className="text-[11px] text-gray-300">{voiceError}</p>}
        <p className="text-[10px] leading-snug text-gray-500">
          Answers come from the app's NASA data through tools; numbers are checked before they are shown. Questions go to an
          AI provider and, on the free tier, may be used to improve its products.
          {speechSupported && ' Voice: the browser sends audio to its speech service (Google in Chrome, Apple in Safari).'}
        </p>
      </form>
      </div>
    </aside>
  )
}

function StepList({ steps }: { steps: TurnStep[] }) {
  if (!steps.length) return null
  return (
    <ul className="mb-1 flex flex-col gap-0.5 text-[11px] text-gray-400">
      {steps.map((step, i) => (
        <li key={i}>
          {step.kind === 'read'
            ? `· Read ${TOOL_LABELS[step.tool] ?? step.tool}`
            : step.action
              ? `↻ ${step.action}`
              : `✕ ${step.tool}: nothing changed`}
        </li>
      ))}
    </ul>
  )
}

function AssistantMessage({ item }: { item: Extract<ChatItem, { role: 'assistant' }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StepList steps={item.steps} />
      <p className={'whitespace-pre-wrap ' + (item.status === 'answer' ? '' : 'text-gray-300 italic')}>{item.text}</p>
      {item.status === 'answer' && (
        <div className="flex flex-wrap items-center gap-1">
          {item.sources.map((source) => (
            <span key={source} className="rounded-full border border-[#56B4E9]/60 px-2 py-0.5 text-[10px] text-[#9fd3f2]">
              {source}
            </span>
          ))}
          <span className="text-[10px] text-gray-500" title="Every number in this answer was found in the app's tool results or the app guide.">
            ✓ numbers checked
          </span>
          {item.via && (
            <span className="text-[10px] text-gray-500" title={`Answered by ${item.via}`}>
              · via {item.via.split(' · ')[0]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
