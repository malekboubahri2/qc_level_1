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

export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const reg = await navigator.serviceWorker.ready
  const { public_key } = await api.push.vapidPublicKey()
  const keyBytes = urlBase64ToUint8Array(public_key)

  // Unsubscribe from any existing subscription first (handles VAPID key rotation).
  const existing = await reg.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes.buffer.slice(
      keyBytes.byteOffset,
      keyBytes.byteOffset + keyBytes.byteLength,
    ) as ArrayBuffer,
  })
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
