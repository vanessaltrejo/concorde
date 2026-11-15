import { computeZoneShares, loadEphemeris, loadZoneGrid } from './zones'

// Background thread for the south pole zone shares (about 1 s for a 6.5 day
// stay, several seconds for a long one), so the page keeps responding while
// the user moves the date or stay sliders. It loads the same files as the page
// (the browser cache serves them the second time).

export type ZoneRequest = { id: number; arrivalMs: number | null; stayDays: number }
export type ZoneReply =
  | { id: number; ok: true; sun: Float32Array; earth: Float32Array }
  | { id: number; ok: false; message: string }

self.onmessage = async (event: MessageEvent<ZoneRequest>) => {
  const { id, arrivalMs, stayDays } = event.data
  try {
    const [grid, ephemeris] = await Promise.all([loadZoneGrid(), loadEphemeris()])
    const shares = computeZoneShares(grid, ephemeris, arrivalMs, stayDays)
    const reply: ZoneReply = { id, ok: true, sun: shares.sun, earth: shares.earth }
    // Transfer the arrays instead of copying them.
    self.postMessage(reply, { transfer: [shares.sun.buffer, shares.earth.buffer] })
  } catch (error) {
    const reply: ZoneReply = { id, ok: false, message: error instanceof Error ? error.message : String(error) }
    self.postMessage(reply)
  }
}
