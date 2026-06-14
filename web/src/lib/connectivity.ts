/* Connectivity detection used by the inspector page.

   Two signals are combined:
   1. navigator.onLine (instant but unreliable on LAN)
   2. A lightweight GET /api/v1/health ping (definitive but async)

   The hook returns `online: boolean` and a `check()` function for imperative
   probes (e.g. right before posting an alerte).
*/

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

const PING_INTERVAL_MS = 30_000

export function useConnectivity() {
  const [online, setOnline] = useState(navigator.onLine)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = useCallback(async (): Promise<boolean> => {
    try {
      await api.health()
      setOnline(true)
      return true
    } catch {
      setOnline(false)
      return false
    }
  }, [])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      check()
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Periodic health ping.
    timer.current = setInterval(() => { void check() }, PING_INTERVAL_MS)

    // Initial probe.
    void check()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (timer.current) clearInterval(timer.current)
    }
  }, [check])

  return { online, check }
}
