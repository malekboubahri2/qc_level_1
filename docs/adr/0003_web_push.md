# ADR-0003 — Web Push via VAPID (swappable sender interface)

**Status:** Accepted  
**Date:** 2025-01-15  
**Deciders:** PMP / QC Level 1

---

## Context

The escalation loop requires the méthode responsable to be notified when a
new alerte is raised. The primary, reliable channel is the SSE office screen
(ADR-0002). A phone notification is a secondary, best-effort channel: the
phone may be on cellular only, or the plant Wi-Fi may be unavailable.

Web Push (W3C) fits the stack (browser-native, no native app) but adds an
external dependency: the push gateway (FCM/VAPID relay). Self-hosted
alternatives (ntfy, UnifiedPush) exist but require additional infra.

This is explicitly labelled **"si possible"** in the domain spec (§5) and
**beyond the locked stack** — hence this ADR.

---

## Decision

1. **Implement Web Push via `pywebpush` + VAPID** (Elliptic Curve P-256,
   keys generated once and persisted to the `/data` Docker volume so they
   survive restarts).

2. **Abstract the transport behind `NotificationSender`**, a Python Protocol:

   ```python
   class NotificationSender(Protocol):
       def send(self, endpoint: str, p256dh: str, auth: str, payload: dict) -> None: ...
   ```

   Active implementation is swappable at runtime via `set_sender()`.
   Current concrete impl: `VapidSender` (pywebpush).
   Future swap: a self-hosted ntfy/UnifiedPush sender requires only a new class.

3. **Subscription model** (`push_subscription` table, migration 0003):
   upsert by endpoint so key rotation doesn't duplicate rows.

4. **Best-effort, never blocking**: the sender catches all exceptions and
   logs a warning. Push failure never causes a 5xx or blocks the alerte
   creation response.

5. **Delivery guarantee remains on the SSE office screen** (ADR-0002).
   Push is an opportunistic supplement. The `OfflineBanner` and manual-alert
   fallback (§5, §9) cover all cases where push or SSE fails.

6. **Escalation on expiry**: when a scheduler expires an `ouverte` alerte
   (timeout T = 120s), `notify_all_methode` broadcasts to every active
   méthode user's subscriptions — this is the "louder alarm" mentioned in §5.

---

## Consequences

- `pywebpush` is now a server dependency. It in turn needs `cryptography`.
- VAPID public key is exposed unauthenticated at `GET /api/v1/push/vapid-public-key`
  so the PWA can register subscriptions without a prior auth flow.
- If the plant has no internet, FCM-relayed pushes silently drop. The
  SSE office screen is unaffected (LAN-only). This is acceptable.
- Swapping to ntfy requires: (a) a new `NtfySender` class, (b) one
  `set_sender(NtfySender(...))` call in `lifespan`, (c) no DB or schema change.

---

## Alternatives considered

| Option | Verdict |
|---|---|
| Self-hosted ntfy/UnifiedPush now | Deferred — extra infra beyond locked stack; swappable later |
| Long-poll instead of push | Rejected — battery-unfriendly on phones |
| Skip phone notifications entirely | Possible fallback if VAPID relay unavailable; SSE screen suffices |
