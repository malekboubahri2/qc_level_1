/* SSE client hook for the office screen.

   Uses native EventSource. Because EventSource does not support custom headers
   the JWT is passed as a ?token= query parameter (ADR-0002).

   The hook manages reconnection automatically (EventSource retries by itself),
   fetches the current alerte list on connect/reconnect to resync state, and
   applies incremental SSE events on top.
*/

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type AlerteRead } from './api'

export function useAlertesSSE() {
  const [alertes, setAlertes] = useState<AlerteRead[]>([])
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const resync = useCallback(async () => {
    try {
      const list = await api.alertes.list()
      setAlertes(list)
    } catch {
      /* will retry on next reconnect */
    }
  }, [])

  useEffect(() => {
    const url = api.sseUrl()
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('open', () => {
      setConnected(true)
      void resync()
    })

    es.addEventListener('error', () => {
      setConnected(false)
    })

    es.addEventListener('alerte.created', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as AlerteRead
        setAlertes((prev) => {
          if (prev.some((a) => a.id === data.id)) return prev
          return [data, ...prev]
        })
      } catch { /* malformed frame */ }
    })

    es.addEventListener('alerte.acknowledged', (e: MessageEvent) => {
      try {
        const { id, acknowledged_at, acknowledged_by } = JSON.parse(e.data) as {
          id: number; acknowledged_at: string; acknowledged_by: number
        }
        setAlertes((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, statut: 'acquittee', acknowledged_at, acknowledged_by }
              : a,
          ),
        )
      } catch { /* malformed frame */ }
    })

    es.addEventListener('alerte.closed', (e: MessageEvent) => {
      try {
        const { id, closed_at, decision_id } = JSON.parse(e.data) as {
          id: number; closed_at: string; decision_id: number
        }
        setAlertes((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, statut: 'cloturee', closed_at, decision_id }
              : a,
          ),
        )
      } catch { /* malformed frame */ }
    })

    es.addEventListener('alerte.expired', (e: MessageEvent) => {
      try {
        const { id } = JSON.parse(e.data) as { id: number }
        setAlertes((prev) =>
          prev.map((a) => (a.id === id ? { ...a, statut: 'expiree' } : a)),
        )
      } catch { /* malformed frame */ }
    })

    return () => {
      es.close()
      esRef.current = null
    }
  }, [resync])

  return { alertes, setAlertes, connected }
}

/* Web Audio beep — no external file, works in all modern browsers. */
export function playAlarm() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => ctx.close()
  } catch {
    /* AudioContext unavailable in some test environments */
  }
}
