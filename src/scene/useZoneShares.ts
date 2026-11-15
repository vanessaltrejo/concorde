import { useEffect, useRef, useState } from 'react'
import type { ZoneShares } from './zones'
import type { ZoneReply, ZoneRequest } from './zoneWorker'

type Key = { arrivalMs: number | null; stayDays: number }

const keyText = (key: Key) => `${key.arrivalMs}|${key.stayDays}`
const MAX_CACHED = 40

// South pole zone shares for the current arrival and stay, computed in a Web
// Worker. While the worker is busy only the newest request is kept, so dragging
// a slider does not pile up work; the map keeps the last finished result meanwhile.
// Results are cached per arrival and stay, so going back to a value is instant.
export function useZoneShares(
  enabled: boolean,
  arrivalMs: number | null,
  stayDays: number,
): { shares: ZoneShares | null; error: string | null } {
  const sendRef = useRef<((key: Key) => void) | null>(null)
  const busyRef = useRef(false)
  const wantedRef = useRef<Key | null>(null)
  const cacheRef = useRef(new Map<string, ZoneShares>())
  const [results, setResults] = useState<Map<string, ZoneShares>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const worker = new Worker(new URL('./zoneWorker.ts', import.meta.url), { type: 'module' })
    const pending = new Map<number, Key>()
    let nextId = 0

    const send = (key: Key) => {
      const id = nextId++
      pending.set(id, key)
      busyRef.current = true
      const request: ZoneRequest = { id, arrivalMs: key.arrivalMs, stayDays: key.stayDays }
      worker.postMessage(request)
    }

    worker.onmessage = (event: MessageEvent<ZoneReply>) => {
      const reply = event.data
      const key = pending.get(reply.id)
      pending.delete(reply.id)
      busyRef.current = false
      if (!key) return
      if (reply.ok) {
        const cache = cacheRef.current
        cache.set(keyText(key), { sun: reply.sun, earth: reply.earth })
        if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string)
        setResults(new Map(cache))
      } else {
        setError(reply.message)
      }
      // Run the newest request if it changed while the worker was busy.
      const wanted = wantedRef.current
      if (wanted && !cacheRef.current.has(keyText(wanted))) send(wanted)
    }

    sendRef.current = send
    const wanted = wantedRef.current
    if (wanted && !cacheRef.current.has(keyText(wanted))) send(wanted)
    return () => {
      worker.terminate()
      sendRef.current = null
      busyRef.current = false
    }
  }, [enabled])

  useEffect(() => {
    const key = { arrivalMs, stayDays }
    wantedRef.current = key
    if (!enabled || cacheRef.current.has(keyText(key))) return
    if (!busyRef.current) sendRef.current?.(key)
  }, [enabled, arrivalMs, stayDays])

  // The exact result when it is ready, else the last finished one (stale for a moment).
  const exact = results.get(keyText({ arrivalMs, stayDays }))
  const latest = exact ?? [...results.values()].at(-1) ?? null
  return { shares: enabled ? latest : null, error }
}
