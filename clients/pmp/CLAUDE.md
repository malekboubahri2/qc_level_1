# PMP Client Profile

> **Client overlay — PMP (Peinture et Métallisation sur Plastique).** Apply this
> *on top of* the generic `base/`. The base guidelines (principles,
> way-of-working, commits, docs) still govern; this layer adds PMP's identity,
> stack, and brand. Copy this file's contents into a PMP project's root
> `CLAUDE.md` (below the generic guidelines), and copy the two PMP rules into the
> project's `.claude/rules/`.

## Who PMP is

PMP — Peinture et Métallisation sur Plastique — a paint/finishing plant. The
software exists to digitalize and instrument plant operations. Plant floor,
French-speaking; the brand voice is **industrial luxury** (deep teal expertise,
gold craftsmanship, warm cream — never beige-enterprise, never startup-toy).

## PMP defaults (unless a project says otherwise)

- **Stack:** see `.claude/rules/tech-stack.md` — FastAPI + SQLite + Docker
  server; React + Vite + Tailwind + shadcn dashboard; STM32/TouchGFX firmware
  only when embedded; Caddy + Mosquitto + Compose infra.
- **Brand:** see `.claude/rules/visual-identity.md` and `assets/theme.css`.
  Cream backgrounds, teal headings, gold used *sparingly*, muted status colors,
  Inter + JetBrains-Mono-for-data, the gold focus ring. **Brand is a feature** —
  if a screen looks generic, return to the brand rule.
- **The web surface is the selling point.** Invest in interactive, animated,
  polished UX; keep motion primitives in `lib/`, out of business logic.
- **Locale & time:** UI in French (`fr-TN`); UTC on the wire, local only in the
  UI layer.
- **Deploy target:** typically a Raspberry Pi / ARM box on the plant LAN, the
  full stack in Docker, reached over Caddy-terminated HTTPS.

## (Per project) — fill this in

```
## This project
- What it is: {{one or two sentences}}
- Primary surface / selling point: {{usually the web dashboard / PWA}}
- Components: {{server / dashboard / firmware / infra — which exist}}
- Run: {{the one command}}
- Status: {{current phase; shipped; next}}
- Project don'ts: {{anything specific to avoid here}}
```

Keep it short and current — it's the first thing read each session.
