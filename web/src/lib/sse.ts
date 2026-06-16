/* SSE client hook for the office screen.

   Uses native EventSource. Because EventSource does not support custom headers
   the JWT is passed as a ?token= query parameter (ADR-0002).

   The hook manages reconnection automatically (EventSource retries by itself),
   fetches the current alerte list on connect/reconnect to resync state, and
   applies incremental SSE events on top.
*/

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type AlerteRead, type SuiviRead } from './api'

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

/* Combined SSE hook for the Andon wall — handles suivi.created + all alerte.* events. */
export function useAndonSSE(todayDate: string) {
  const [suivis, setSuivis] = useState<SuiviRead[]>([])
  const [alertes, setAlertes] = useState<AlerteRead[]>([])
  const [connected, setConnected] = useState(false)
  // Queue of alertes to flash on the emergency overlay (newest last shown first)
  const [alertQueue, setAlertQueue] = useState<AlerteRead[]>([])
  // IDs of suivi rows that just arrived and should animate
  const [newSuiviIds, setNewSuiviIds] = useState<Set<number>>(new Set())

  const resync = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api.suivis.list({ date: todayDate }),
        api.alertes.list(),
      ])
      setSuivis(s)
      setAlertes(a)
    } catch { /* retry on next reconnect */ }
  }, [todayDate])

  useEffect(() => {
    const es = new EventSource(api.sseUrl())

    es.addEventListener('open', () => {
      setConnected(true)
      void resync()
    })
    es.addEventListener('error', () => setConnected(false))

    es.addEventListener('suivi.created', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SuiviRead
        if (data.date !== todayDate) return
        setSuivis((prev) => prev.some((s) => s.id === data.id) ? prev : [data, ...prev])
        setNewSuiviIds((prev) => new Set([...prev, data.id]))
        setTimeout(
          () => setNewSuiviIds((prev) => { const n = new Set(prev); n.delete(data.id); return n }),
          1600,
        )
      } catch { /* malformed */ }
    })

    es.addEventListener('alerte.created', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as AlerteRead
        setAlertes((prev) => prev.some((a) => a.id === data.id) ? prev : [data, ...prev])
        setAlertQueue((prev) => [...prev, data])
      } catch { /* malformed */ }
    })

    es.addEventListener('alerte.acknowledged', (e: MessageEvent) => {
      try {
        const { id, acknowledged_at, acknowledged_by } = JSON.parse(e.data) as {
          id: number; acknowledged_at: string; acknowledged_by: number
        }
        setAlertes((prev) =>
          prev.map((a) => a.id === id ? { ...a, statut: 'acquittee', acknowledged_at, acknowledged_by } : a),
        )
        setAlertQueue((prev) => prev.filter((a) => a.id !== id))
      } catch { /* malformed */ }
    })

    es.addEventListener('alerte.closed', (e: MessageEvent) => {
      try {
        const { id, closed_at, decision_id } = JSON.parse(e.data) as {
          id: number; closed_at: string; decision_id: number
        }
        setAlertes((prev) =>
          prev.map((a) => a.id === id ? { ...a, statut: 'cloturee', closed_at, decision_id } : a),
        )
        setAlertQueue((prev) => prev.filter((a) => a.id !== id))
      } catch { /* malformed */ }
    })

    es.addEventListener('alerte.expired', (e: MessageEvent) => {
      try {
        const { id } = JSON.parse(e.data) as { id: number }
        setAlertes((prev) => prev.map((a) => a.id === id ? { ...a, statut: 'expiree' } : a))
        setAlertQueue((prev) => prev.filter((a) => a.id !== id))
      } catch { /* malformed */ }
    })

    return () => es.close()
  }, [resync, todayDate])

  // Safety-net poll when SSE is disconnected
  useEffect(() => {
    if (connected) return
    const id = setInterval(() => void resync(), 30_000)
    return () => clearInterval(id)
  }, [connected, resync])

  return { suivis, alertes, connected, alertQueue, setAlertQueue, newSuiviIds }
}

/* Web Audio beep — sharp, used by the méthode office screen. */
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

/* Soft three-note descending chime (G5→E5→C5) — used by the Andon overlay. */
export function playAndonChime() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime

    const chime = (freq: number, start: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4)
      osc.start(start)
      osc.stop(start + 1.4)
    }

    chime(784, now)        // G5
    chime(659, now + 0.38) // E5
    chime(523, now + 0.76) // C5

    setTimeout(() => ctx.close(), 3000)
  } catch { /* AudioContext unavailable */ }
}
