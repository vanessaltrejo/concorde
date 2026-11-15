// Voice input with the browser's Web Speech API (AI-8). Free, no key, no server.
// Chrome sends the audio to Google and Safari to Apple; Firefox has no support,
// so the mic button is hidden there.

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }

type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> }

export type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  stop: () => void
}

type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = typeof window !== 'undefined' && ctor() !== null

// Starts listening. `onText` gets the running transcript (interim, then final).
export function listen(lang: string, onText: (text: string, final: boolean) => void, onDone: (error?: string) => void): Recognition | null {
  const Ctor = ctor()
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.lang = lang
  recognition.interimResults = true
  recognition.continuous = false
  recognition.onresult = (event) => {
    let text = ''
    let final = false
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript
      final = event.results[i].isFinal
    }
    onText(text, final)
  }
  recognition.onerror = (event) => onDone(event.error)
  recognition.onend = () => onDone()
  recognition.start()
  return recognition
}
