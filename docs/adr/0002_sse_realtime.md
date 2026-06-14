# ADR-0002 — SSE for real-time alerte delivery to the office screen

**Status:** Accepted  
**Date:** 2026-06-14  
**Deciders:** Malek Boubahri (project lead), Claude Code (impl)

## Context

`qc-level1.md §5` names the office-screen kiosk as the **primary, reliable
delivery channel** for escalation alertes, via "SSE (matches Level 3)".
Alternatives were:

| Option | Pros | Cons |
|---|---|---|
| SSE (chosen) | Native browser API; HTTP/1.1 compatible; auto-reconnect; no extra protocol | Single-direction; one uvicorn process (fits our scale) |
| WebSocket | Bidirectional | Heavier; overkill for server→client push; harder to proxy via Caddy |
| Long-poll | Universal | Adds per-request latency; more server-side complexity |
| Web Push | Works on closed tab | Requires internet + gateway; "best-effort" per §5 |

For the single-inspector, single-process, LAN-intranet deployment that is
QC Level 1, SSE is the right fit.

## Decision

Use **Server-Sent Events** (`GET /api/v1/events`, `Content-Type:
text/event-stream`) for all server → browser push in this deployment:

- In-process `EventBroker` (asyncio Queues) — no external broker needed.
- JWT token accepted via `?token=` query param because `EventSource` does not
  support custom headers; the risk surface is identical to bearer-header on a
  LAN with Caddy TLS termination.
- Heartbeat comment (`: heartbeat`) every 15 s to keep TCP alive through
  proxies.
- Clients reconnect automatically on disconnect; the office screen fetches
  `GET /alertes?statut=ouverte` on reconnect to resync state.

## Web Push addition (Phase 2)

Web Push for `methode` phone notifications is **in addition to** SSE, not
instead of it. It is implemented behind a swappable `NotificationSender`
interface (`pywebpush` + VAPID now; self-hosted `ntfy`/UnifiedPush later).
An ADR will be written when Phase 2 begins.

## Consequences

- SSE requires one open TCP connection per connected browser tab. At the
  expected concurrency (2–5 screens) this is negligible.
- If the process restarts, all SSE connections drop; clients auto-reconnect
  within ~3 s (EventSource default). The PWA connectivity check on the
  inspector page detects this and shows the manual-alert banner in the gap.
- Scaling beyond one uvicorn process would require moving `EventBroker` to
  Redis Pub/Sub. That is an ADR for later.
