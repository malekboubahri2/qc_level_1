# PMP Client Overlay

Client-specific configuration for **PMP** (Peinture et Métallisation sur
Plastique), layered on top of the generic `base/`. The base shapes *how* Claude
works on any project; this overlay adds *who the client is* — brand, stack, and
conventions.

## Contents

```
clients/pmp/
├── CLAUDE.md                       ← PMP client profile (identity, defaults, per-project stub)
├── .claude/rules/
│   ├── visual-identity.md          ← PMP brand contract (auto-read)
│   └── tech-stack.md               ← PMP preferred/locked stack (auto-read)
└── assets/
    └── theme.css                   ← PMP Tailwind v4 @theme tokens (drop into dashboard/src/index.css)
```

## Apply it to a PMP project

Layer base + this overlay into the project repo:

```bash
# 1. generic base (any project)
cp -r base/CLAUDE.md base/.claude  /path/to/project/

# 2. PMP overlay
cp clients/pmp/.claude/rules/*  /path/to/project/.claude/rules/
#    merge clients/pmp/CLAUDE.md's "PMP defaults" + a "This project" section
#    into the project's root CLAUDE.md (below the generic guidelines)

# 3. brand tokens for the web app (if there's a dashboard)
cp clients/pmp/assets/theme.css  /path/to/project/dashboard/src/index.css
```

Result: Claude auto-reads the generic guidelines **and** the PMP brand + stack
rules, so it builds in PMP's voice on PMP's stack without being told each time.

## Adding another client

Copy `clients/pmp/` to `clients/<new-client>/` and replace the brand,
tech-stack, and profile with that client's. The `base/` never changes — it's
the same for everyone.
