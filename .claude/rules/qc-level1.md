# QC Level 1 — Project Layer (PMP)

> **Project rule.** Composes **on top of** `base/` (principles, way-of-working,
> commits, docs) and `clients/pmp/` (`tech-stack.md`, `visual-identity.md`,
> `theme.css`). This file owns **only the domain**. Where it doesn't say, the
> overlays decide.

**Owned by the overlays — do not restate or override here:**
- Stack, structure, infra, package managers, UTC-on-wire / `fr-TN` locale → `clients/pmp/.claude/rules/tech-stack.md`
- Color, type, components, the alarm-vs-brand rule (see §10) → `clients/pmp/.claude/rules/visual-identity.md` + `assets/theme.css`
- Engineering principles, commits, docs discipline → `base/`

---

## 1. The module in one paragraph

QC Level 1 is an **on-premise, in-production early-warning** tool. A line inspector
spots an *early symptom* (precursor) on a chariot, logs it, and **summons a chosen
méthode responsable**, who comes, acknowledges, and records a free-text decision +
outcome. It **digitizes the paper sheet `Fiche Suivi Qualité Prod` (SVI-COQ-03 v03)**
and adds a fast, traceable **escalation → décision** loop. It is a **separate
deployment** from QC Level 3 (end-of-line inspection), on the same stack, **syncable
to Level 3 later** (not now). Plant does **no injection**; stages = **peinture +
métallisation**. Symptoms are **purely human-observed** (no sensors → MQTT/Mosquitto
pruned from the stack). Currently **one master inspector** → low write concurrency.

---

## 2. Source of truth: `SVI-COQ-03`

One sheet row = one chariot control. Map exactly:

| Sheet column | Field | Notes |
|---|---|---|
| Date / Heure | `date`, `heure` | timestamp **stored UTC**, shown local (`fr-TN`) |
| Num Chariot | `num_chariot` | traceability unit |
| Nb P.O | `num_porte_objet` | **Numéro Porte-Objets** — part-carrier rack/jig ID (string, *not* a quantity) |
| Client | `client_id` | |
| Référence Article | `produit_id` | |
| Contrôle Chariot OK/NOK | `resultat` | enum `OK \| NOK` |
| Défauts détectés | join `suivi_symptome` | the precursor catalogue below |
| Commentaire / Décision | free text | captured via the decision flow (§5) |
| VISA Qualité/Prod/Méthode | `visa` records | three sign-offs |

**Precursor catalogue — seed exactly these** (`famille = surface`):
`APPLICATION`, `COULEUR`, `POUSSIERE`, `CHUTE`, `AUTRES`.
Each: `code`, `libelle_fr`, `libelle_ar?`, `ordre`, `actif`.

---

## 3. Roles

`inspecteur` — create suivi rows; raise an alerte and **choose who must come**; see ack status / manual-fallback banner.
`methode` — the responsable: receive alertes, acknowledge, record décision + outcome, sign Visa Méthode.
`qualite` / `prod` — sign their Visa (Phase 2).
`admin` — manage users, clients, produits, catalogue, settings.

Auth per `tech-stack.md` (JWT + argon2). Seed an admin.

---

## 4. Data model

SQLAlchemy 2.0 + Alembic (migrations are the only way the schema changes — `tech-stack.md`).
SQLite WAL → Postgres if needed. Every operational row carries a client-generated
`local_uuid` (idempotent offline sync) + `created_at`/`updated_at`. **All timestamps UTC.**

```
client(id, code, nom, actif)
produit(id, reference, libelle, client_id?, type_traitement[peinture|metallisation|les_deux], actif)
utilisateur(id, nom, role[inspecteur|methode|qualite|prod|admin], secret_hash(argon2), telephone?, actif)
push_subscription(id, utilisateur_id, endpoint, p256dh, auth, user_agent, created_at)
symptome_catalogue(id, code, libelle_fr, libelle_ar?, famille='surface', ordre, actif)

suivi_qualite_prod(id, local_uuid, date, heure,
                   num_chariot, num_porte_objet, client_id, produit_id,
                   resultat[OK|NOK], commentaire_decision?,
                   inspecteur_id, niveau3_ref?,        -- nullable; FUTURE Level-3 link
                   created_at, updated_at)
suivi_symptome(id, suivi_id, symptome_id, present[bool], note?)
visa(id, suivi_id, type[qualite|prod|methode], utilisateur_id, signed_at)

alerte(id, local_uuid, suivi_id, produit_id, num_chariot,
       severite[normale|urgente], demandeur_id, responsable_cible_id,
       statut[ouverte|acquittee|cloturee|expiree],
       created_at, acknowledged_at?, acknowledged_by?, closed_at?, decision_id?)
decision(id, alerte_id, suivi_id, responsable_id, action_text, resultat_text?, decided_at)
```

Derived metrics (not stored): `temps_de_reponse = acknowledged_at − created_at`;
`temps_de_resolution = closed_at − created_at`; Taux NC prod = NOK / total;
Pareto précurseurs by produit / chariot / période.

---

## 5. The escalation loop (the heart)

State machine:
```
ouverte ─(méthode acks)─▶ acquittee ─(decision recorded)─▶ cloturee
   └─(no ack within T, default 120s)─▶ expiree ─▶ inspector told to ALERT MANUALLY
```

**Channels, in priority order:**
1. **Office screen — RELIABLE / primary.** Always-on kiosk page in the méthode room (PC). New alerte → audible alarm + prominent visual (chariot, produit, symptom(s), severity, who was summoned) + **ACQUITTER** button. Delivered over **SSE** (matches Level 3 + `tech-stack.md`); ACK is a normal `POST`. This is the channel we trust.
2. **Phone Web Push — BEST-EFFORT ("si possible").** Push to `responsable_cible`'s subscribed phone PWA. ⚠️ Needs the phone to have internet (cellular) and the server to reach a push gateway. Never the guaranteed path. **This is an addition beyond the locked stack → record an ADR**; implement behind a swappable sender interface (`pywebpush`+VAPID now, self-hosted UnifiedPush/ntfy as a possible later swap).
3. **Manual fallback — GUARANTEED (requirement #7).** The inspector PWA **verifies delivery** before claiming success. If the POST fails, **or** the SSE stream is down, **or** a `/health` ping fails → show a red, unmissable banner: **« RÉSEAU INSTABLE — ALERTER MANUELLEMENT (appel / de vive voix) »**. The suivi row still queues locally for sync, but the system **never silently pretends the alert was delivered.**

**Online vs offline rule (critical):**
- **Suivi rows = offline-first** — queue in IndexedDB, sync on reconnect, idempotent via `local_uuid`.
- **Alertes = online-only** — never queue an alert as if sent; on any doubt, force the manual fallback.

**Timeout:** server-side scheduler; an `ouverte` alerte not acknowledged within `T`
(setting, default 120s) → `expiree`, louder office alarm, optional backup notification,
inspector sees the manual-alert banner.

---

## 6. API surface (`/api/v1`)

Schemas + router→service→model structure per `tech-stack.md` (Create/Update/Read schemas; no logic in routers). Return server timestamps on create so the client never invents a "delivered" state.

- Auth: `login`, `refresh`, `me`
- Reference CRUD: `clients`, `produits`, `utilisateurs`, `symptomes`
- Suivi: `POST/GET /suivis`, `GET /suivis/{id}`, `PATCH /suivis/{id}`, `POST /suivis/sync` (batch upsert by `local_uuid`), `POST /suivis/{id}/visa`
- Alertes: `POST /alertes`, `GET /alertes`, `GET /alertes/{id}`, `PATCH /alertes/{id}/ack`, `POST /alertes/{id}/decision` (internal `expire`)
- Push: `POST/DELETE /push/subscribe`
- Realtime: `GET /events` (SSE) — channels: `alertes` (office screen) + per-responsable
- KPIs: `taux-nc`, `precurseurs`, `temps-reponse`
- `GET /health` (used by the PWA connectivity check)
- `GET /export/suivi.pdf` (Phase 2 — same audit format as Level 3)

---

## 7. Frontend — one React PWA, role-based routes

Stack, build, and all brand/styling per the overlays (Vite + TS + Tailwind + shadcn/ui + TanStack Query + React Router + Zod/react-hook-form + Recharts + PWA). This file specifies only the **domain views and behavior**:

- **`/inspecteur`** (line tablet, kiosk, offline-first): form mirroring the sheet — Heure (auto), Num Chariot, N° Porte-Objets, Client, Référence Article, OK/NOK, tap precursors, Commentaire. Prominent **« ALERTER »**: pick severity + **choose the responsable** + confirm → then **« En attente d'acquittement »** + countdown, or the red **manual-alert** banner on delivery failure.
- **`/methode/ecran`** (office PC, fullscreen kiosk): live alert board, audible alarm on new alerte, **ACQUITTER**, then inline **Décision (action) + Résultat (outcome)** → closes the alerte.
- **`/methode/mobile`** (phone PWA): enable-notifications prompt → register push; receive, open to alert, **ACQUITTER**, optional decision.
- **`/admin`**: manage reference data + settings (timeout `T`, etc.).
- **`/kpis`**: Taux NC prod, Pareto précurseurs, response-time, recurring symptoms.

Localisation: `fr-TN` default (per `tech-stack.md`); strings in i18n files so AR can be added later. Service worker handles offline caching + push events + notification-click focus.

---

## 8. Build phases (do in order; stop after each for review)

- **Phase 0 — Scaffold:** repo layout, FastAPI + DB + Alembic + auth + roles, seed (admin + 5 precursors + demo client/produit), reference CRUD, PWA shell with role routing + brand applied, Docker + Caddy HTTPS local, `/health`.
- **Phase 1 — Core loop:** suivi logging (offline-first + idempotent sync), Visa Méthode, alerte create with responsable choice + severity, SSE office screen with alarm + ACK, decision capture, **connectivity check + manual-alert fallback**, response-time recorded, server-side timeout→expiree.
- **Phase 2 — Notifications, KPIs, audit:** Web Push + `/methode/mobile` (behind the sender interface; ADR), KPI dashboards, PDF export matching Level 3, Visa Qualité/Prod, escalation-to-backup on timeout.
- **Phase 3 — Level 3 sync (later):** shared reference data (produits/clients/utilisateurs) and optional `niveau3_ref` linkage.

---

## 9. Domain guardrails (project-specific only — generic ones live in `base/`)

- Every operational write is idempotent by `local_uuid`; never lose a queued suivi.
- **Never mark an alerte delivered/acknowledged without server confirmation.** On any doubt → instruct manual alerting.
- Alerting is **online-only**; suivi is **offline-first**. Do not blur the two.
- HTTPS is required for the service worker + Web Push — rely on Caddy's internal CA (`tech-stack.md`).

---

## 10. Decisions to confirm (don't block Phase 0)

1. **Alarm vs brand (needs the brand owner).** `visual-identity.md` mandates muted status colors. The escalation alarm is the opposite case: a rare exception that *should* grab attention. Proposal: a sanctioned **"état d'alerte" exception** — the active-alert office screen may use stronger contrast + motion + sound; everything else stays on-brand. Confirm before building the alarm screen.
2. Line-tablet legibility of cream/teal under workshop lighting — validate on the real device.
3. Granularity: is one suivi row one **chariot**, or one **porte-objet** within a chariot?
4. Do méthode phones have cellular data, or plant Wi-Fi only?
5. Visa workflow: who must sign, and when (at close, or later)?
6. Timeout `T` default + whether a backup responsable exists for escalation.
7. Audit-record retention period.
