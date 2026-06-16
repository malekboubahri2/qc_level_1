import { api } from './api'

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Délai dépassé (${label})`)), ms),
    ),
  ])
}

export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push non supporté par ce navigateur')
  }

  const reg = await withTimeout(navigator.serviceWorker.ready, 30_000, 'service worker')
  const { public_key } = await api.push.vapidPublicKey()
  const keyBytes = urlBase64ToUint8Array(public_key)

  // Unsubscribe from any existing subscription first (handles VAPID key rotation).
  const existing = await reg.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  const subscription = await withTimeout(
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength,
      ) as ArrayBuffer,
    }),
    15_000,
    'push gateway',
  )
  const j = subscription.toJSON()
  await api.push.subscribe({
    endpoint: subscription.endpoint,
    p256dh: j.keys?.p256dh ?? '',
    auth: j.keys?.auth ?? '',
  })
}

/** Check whether the browser has an active push subscription registered. */
export async function hasPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub !== null
  } catch {
    return false
  }
}

export function initialPushState(): 'idle' | 'checking' | 'enabled' | 'denied' {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'granted') return 'checking'
  return 'idle'
}
