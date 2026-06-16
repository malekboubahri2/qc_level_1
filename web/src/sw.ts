/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope
export {}

// vite-plugin-pwa replaces self.__WB_MANIFEST with actual entries at build time.
// Must use `self.__WB_MANIFEST` (property access) so the minifier doesn't rename it.
type ManifestEntry = { url: string; revision: string | null }
const WB_MANIFEST: ManifestEntry[] = (self as unknown as { __WB_MANIFEST: ManifestEntry[] }).__WB_MANIFEST

const CACHE = 'qc-level1-v1'

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Best-effort: a slow/failed cache must not block SW activation.
      .then(cache => cache.addAll(WB_MANIFEST.map(e => e.url)).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// ── Fetch: pass API/SSE through, cache-first for everything else ──────────────

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Safari routes blob:, data:, etc. through the SW — skip anything non-HTTP
  // to avoid "returned response is null" errors.
  if (!request.url.startsWith('http')) return

  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // Always resolve to a real Response — never undefined/null.
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
        .then((r) => r ?? fetch('/index.html'))
        .catch(() => new Response('Offline', { status: 503 })),
    )
    return
  }

  event.respondWith(
    caches
      .match(request)
      .then((cached) => cached ?? fetch(request))
      .catch(() => new Response('', { status: 503, statusText: 'Offline' })),
  )
})

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data: { type?: string; alerte_id?: number; num_chariot?: string; severite?: string; produit_ref?: string }
  try { data = event.data.json() } catch { return }

  let title = 'QC Niveau 1'
  let body = ''

  if (data.type === 'alerte.created') {
    const sev = data.severite === 'urgente' ? '🔴 URGENTE' : '🟡 Normale'
    title = `⚠️ ${data.produit_ref ?? 'Alerte'}`
    body = sev
  } else if (data.type === 'alerte.expired') {
    const sev = data.severite === 'urgente' ? ' 🔴' : ''
    title = `🔔 Rappel — ${data.produit_ref ?? 'Alerte'}${sev}`
    body = "Pas d'acquittement — alerter manuellement"
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `alerte-${data.alerte_id ?? 'x'}`,
      data: { url: '/methode/mobile', alerte_id: data.alerte_id },
    } as NotificationOptions),
  )
})

// ── Notification click: focus existing window or open the app ─────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = (event.notification.data as { url?: string })?.url ?? '/methode/mobile'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        return self.clients.openWindow(url)
      }),
  )
})
