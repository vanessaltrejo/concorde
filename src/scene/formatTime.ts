const minuteMs = 60_000
const hourMs = 60 * minuteMs
const dayMs = 24 * hourMs

// "3 d 4 h", "5 h 12 min", "8 min".
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / minuteMs)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  if (ms >= dayMs) return `${days} d ${hours} h`
  if (ms >= hourMs) return `${hours} h ${minutes} min`
  return `${Math.max(minutes, 1)} min`
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "Nov 20, 17:40 UTC". Formatted by hand so the browser time zone is never used.
export function formatUtc(ms: number): string {
  const date = new Date(Math.round(ms / minuteMs) * minuteMs)
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  return `${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}, ${hh}:${mm} UTC`
}

// "Nov 14" for period labels.
export function formatUtcDay(ms: number): string {
  const date = new Date(ms)
  return `${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}`
}
