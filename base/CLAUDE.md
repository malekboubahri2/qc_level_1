# Engineering Guidelines

> Auto-read by Claude Code. These are **generic** guidelines that shape how you
> work on **any** project here — web, CLI, library, service, data, embedded.
> They are not tied to a stack or a domain. Project-specific facts (what this
> repo is, its stack, its status) belong in a short section a project adds
> *below*; these guidelines stay generic underneath.

## How to work (the short version)

> Build the smallest thing that proves the point, behind clean interfaces, so
> the next change is contained. Understand first, verify always, claim nothing
> without evidence.

The full reasoning lives in the rules, which are also auto-read:

- **`.claude/rules/principles.md`** — the 5 engineering principles (modularity,
  portability, clear contracts, simplicity/YAGNI, idiomatic) + cross-cutting
  habits. They outrank convenience.
- **`.claude/rules/way-of-working.md`** — how to approach a build: understand
  first, plan in proportion, thinnest slice first, record expensive decisions,
  one contract per concern, verify before claiming done.
- **`.claude/rules/commits.md`** — Conventional Commits; small, atomic, ordered.
- **`.claude/rules/docs.md`** — docs only when asked or when code makes them
  wrong.
- **`.claude/rules/client-config.md`** — how to distil what you learn about a
  client (brand, stack, conventions, gotchas) into a reusable `clients/<client>/`
  overlay, so the config compounds across projects.

## Non-negotiables (apply everywhere)

- **Read before you edit.** Match the nearest sibling's style and idiom.
- **No hardcoded paths, hosts, ports, or secrets** in source — config instead.
- **One source of truth per concern;** don't branch the same logic per caller.
- **Validate input at boundaries; fail loudly.**
- **Verify your work** (typecheck/build/tests; check the real result) and
  **report outcomes honestly.**
- **Never commit secrets;** never push or deploy unless asked; treat `main` as
  protected.
- **Simplicity first** — add abstraction only for a second concrete need (YAGNI).
- **Ask one clarifying question** on a genuine fork, not three; otherwise act.

## When helping, prefer

- Concrete code over explanation when the design is decided.
- Pointing at an existing file over generating a new one.
- The pattern in the nearest sibling file over a new pattern.
- Tests alongside non-trivial code.
- Surfacing a principle violation explicitly instead of working around it.

---

## (Per project) — fill this in for the specific repo

When this lives in a real project, add a short section here:

```
## This project
- What it is: {{one or two sentences}}
- Stack: {{languages, frameworks, datastore, deploy target}}
- Run: {{the one command to build/run/test}}
- Status: {{current phase; what's shipped; what's next}}
- Project don'ts: {{anything specific to avoid here}}
```

Keep it short and current — it's the first thing read each session. The generic
guidelines above and the rules keep applying underneath it.
