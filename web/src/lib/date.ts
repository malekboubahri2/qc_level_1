/**
 * Parse a server timestamp as UTC.
 *
 * SQLite strips timezone info, so the server returns naive ISO strings like
 * "2026-06-16T10:30:00.123456". Safari (per ECMAScript) treats these as
 * *local* time rather than UTC, causing elapsed-time calculations to be
 * wrong by the local UTC offset. Appending 'Z' forces UTC interpretation.
 */
export function parseServerDate(ts: string): Date {
  if (!ts) return new Date(NaN)
  if (ts.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(ts)) return new Date(ts)
  return new Date(ts + 'Z')
}

export function elapsedSeconds(ts: string): number {
  return Math.max(0, Math.floor((Date.now() - parseServerDate(ts).getTime()) / 1000))
}

export function fmtElapsed(ts: string): string {
  const s = elapsedSeconds(ts)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}
