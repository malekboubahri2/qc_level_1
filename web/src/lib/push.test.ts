import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.hoisted ensures these fn references exist when vi.mock's factory runs.
const { mockVapidPublicKey, mockApiSubscribe } = vi.hoisted(() => ({
  mockVapidPublicKey: vi.fn(),
  mockApiSubscribe: vi.fn(),
}))

vi.mock('./api', () => ({
  api: {
    push: {
      vapidPublicKey: mockVapidPublicKey,
      subscribe: mockApiSubscribe,
    },
  },
}))

import { subscribeToPush, hasPushSubscription, initialPushState } from './push'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSub(endpoint = 'https://fcm.example.com/sub/1'): PushSubscription {
  return {
    endpoint,
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({ endpoint, keys: { p256dh: 'dGVzdA==', auth: 'dGVzdA==' } }),
  } as unknown as PushSubscription
}

// Valid 65-byte uncompressed EC P-256 public key in base64url (no padding).
const FAKE_VAPID_PUB = 'BNrrdij4UKFzUcOcymwqnFBwwdvao9vB-7LckQQ9Rd6RUq6IOzQWQRgyAXRn79907oVbyx_KuPz2-QUNAkDstDM'

function mockSW(subscription: PushSubscription | null = null, subscribeImpl?: () => Promise<PushSubscription>) {
  const reg = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(subscription),
      subscribe: subscribeImpl
        ? vi.fn().mockImplementation(subscribeImpl)
        : vi.fn().mockResolvedValue(makeSub()),
    },
  } as unknown as ServiceWorkerRegistration

  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(reg) },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'PushManager', {
    value: class {},
    configurable: true,
    writable: true,
  })

  return reg
}

// ── initialPushState ──────────────────────────────────────────────────────────

describe('initialPushState', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'default' },
      configurable: true,
      writable: true,
    })
  })

  it('returns denied when Notification API absent', () => {
    const orig = globalThis.Notification
    // @ts-expect-error intentionally removing Notification
    delete globalThis.Notification
    expect(initialPushState()).toBe('denied')
    Object.defineProperty(globalThis, 'Notification', { value: orig, configurable: true, writable: true })
  })

  it('returns checking when permission is granted', () => {
    Object.defineProperty(globalThis, 'Notification', { value: { permission: 'granted' }, configurable: true, writable: true })
    expect(initialPushState()).toBe('checking')
  })

  it('returns denied when permission is denied', () => {
    Object.defineProperty(globalThis, 'Notification', { value: { permission: 'denied' }, configurable: true, writable: true })
    expect(initialPushState()).toBe('denied')
  })

  it('returns idle when permission is default', () => {
    Object.defineProperty(globalThis, 'Notification', { value: { permission: 'default' }, configurable: true, writable: true })
    expect(initialPushState()).toBe('idle')
  })
})

// ── hasPushSubscription ───────────────────────────────────────────────────────

describe('hasPushSubscription', () => {
  it('returns false when no active subscription', async () => {
    mockSW(null)
    expect(await hasPushSubscription()).toBe(false)
  })

  it('returns true when subscription exists', async () => {
    mockSW(makeSub())
    expect(await hasPushSubscription()).toBe(true)
  })

  it('returns false when PushManager absent', async () => {
    // @ts-expect-error intentionally removing PushManager
    delete globalThis.PushManager
    expect(await hasPushSubscription()).toBe(false)
  })
})

// ── subscribeToPush ───────────────────────────────────────────────────────────

describe('subscribeToPush', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSW()
    mockVapidPublicKey.mockResolvedValue({ public_key: FAKE_VAPID_PUB })
    mockApiSubscribe.mockResolvedValue({ id: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('throws when PushManager unsupported', async () => {
    // @ts-expect-error intentionally removing PushManager
    delete globalThis.PushManager
    await expect(subscribeToPush()).rejects.toThrow('Push non supporté')
  })

  it('times out if serviceWorker.ready hangs', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: new Promise(() => { /* never */ }) },
      configurable: true,
      writable: true,
    })
    // Attach rejection handler BEFORE advancing timers so rejection is never unhandled.
    const assertion = expect(subscribeToPush()).rejects.toThrow('service worker')
    await vi.advanceTimersByTimeAsync(9_000)
    await assertion
  })

  it('times out if pushManager.subscribe hangs', async () => {
    mockSW(null, () => new Promise(() => { /* never */ }))
    const assertion = expect(subscribeToPush()).rejects.toThrow('push gateway')
    await vi.advanceTimersByTimeAsync(16_000)
    await assertion
  })

  it('unsubscribes existing subscription before re-subscribing', async () => {
    const existing = makeSub('https://fcm.example.com/old')
    const reg = mockSW(existing)
    await vi.runAllTimersAsync()
    await subscribeToPush()
    expect(existing.unsubscribe).toHaveBeenCalled()
    expect(reg.pushManager.subscribe).toHaveBeenCalled()
  })

  it('sends the subscription to the server', async () => {
    mockSW()
    await vi.runAllTimersAsync()
    await subscribeToPush()
    expect(mockApiSubscribe).toHaveBeenCalledWith({
      endpoint: 'https://fcm.example.com/sub/1',
      p256dh: 'dGVzdA==',
      auth: 'dGVzdA==',
    })
  })
})
