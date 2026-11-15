// Web Worker: computes the horizon and the 3D grids for one point from the
// terrain tiles, off the main thread. One worker per point; it is closed
// afterwards, which frees the decoded tiles (the browser keeps the raw tiles
// in its HTTP cache, so reopening a nearby point does not download them again).
import { TerrainEngine, type AnywhereResult } from './engine.ts'
import type { Manifest } from './tiles.ts'

export type WorkerRequest = { baseUrl: string; lonDeg: number; latDeg: number }
export type WorkerMessage =
  | { type: 'progress'; text: string }
  | { type: 'done'; result: AnywhereResult }
  | { type: 'error'; message: string }

function unavailable(status: number): Error {
  return new Error(
    `Terrain tiles are unavailable (HTTP ${status}). The free daily limit may be reached; it resets at 00:00 UTC. The curated sites still work.`,
  )
}

async function fetchTile(url: string): Promise<ArrayBuffer | null> {
  const response = await fetch(url)
  if (response.status === 404) return null
  if (!response.ok) throw unavailable(response.status)
  return response.arrayBuffer()
}

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage: (m: WorkerMessage, t: Transferable[]) => void }).postMessage(message, transfer)

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { baseUrl, lonDeg, latDeg } = event.data
  try {
    post({ type: 'progress', text: 'Loading the terrain index' })
    const response = await fetch(`${baseUrl}/manifest.json`)
    if (!response.ok) throw unavailable(response.status)
    const manifest = (await response.json()) as Manifest
    const engine = new TerrainEngine(manifest, baseUrl, fetchTile)
    const result = await engine.compute(lonDeg, latDeg, (text) => post({ type: 'progress', text }))
    post({ type: 'done', result }, [
      result.horizonDeg.buffer,
      result.near.positions.buffer,
      result.mid.positions.buffer,
      result.far.positions.buffer,
    ])
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
