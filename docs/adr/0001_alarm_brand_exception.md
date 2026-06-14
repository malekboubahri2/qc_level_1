# ADR-0001 — Sanctioned "état d'alerte" exception to brand palette

**Status:** Accepted  
**Date:** 2026-06-14  
**Deciders:** Malek Boubahri (project lead), Claude Code (impl)

## Context

`visual-identity.md` mandates muted, on-brand status colours (cream, teal,
warm-grey) across all surfaces. However `qc-level1.md §10` flags a conflict:
the `MethodeEcranPage` alarm — the *primary delivery channel* for escalation
alerts — must grab attention **reliably and immediately** in a workshop
environment with ambient light, distance, and noise. Muted tones defeat that
purpose.

## Decision

The **active-alert office screen** (`/methode/ecran` while at least one
`ouverte` or `acquittee` alerte exists) is granted a sanctioned exception.
It may use:

- A `bg-danger` / amber / red background pulsing animation on the alert card.
- An audible alarm generated via `AudioContext` (no external asset).
- Bold, high-contrast text (white on red) that breaks the cream/teal palette.

All **other** surfaces — including the ack-confirmed and closed states of the
same screen — remain strictly on-brand.

## Consequences

- `MethodeEcranPage` introduces motion and sound that are absent everywhere
  else in the app. Transitions between alert and non-alert states must be
  visually clean so the "exception" never leaks into calm states.
- Future brand changes must explicitly revisit this ADR and confirm the
  exception is still warranted.
- The `danger` colour token already exists in `Button.tsx`; it is reused here
  rather than inventing a new token.
