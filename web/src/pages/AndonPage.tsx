/* Andon wall display — full-screen kiosk for the méthode team.
   No nav chrome; live table of today's suivis + emergency overlay + pending panel.
   Fluid type via clamp() inline styles; respects prefers-reduced-motion via CSS. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type AlerteRead, type SuiviRead, type SymptomeRead } from '../lib/api'
import { useAndonSSE, playAlarm } from '../lib/sse'
import { t } from '../lib/i18n'
import { cn } from '../lib/cn'

// ── helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local tz
}

function fmtAge(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h ${mins % 60} min`
}

function fmtClock(d: Date): string {
  return d.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Emergency overlay ──────────────────────────────────────────────────────

interface OverlayProps {
  alerte: AlerteRead
  onDismiss: () => void
  userNames: Map<number, string>
  produitRefs: Map<number, string>
}

function EmergencyOverlay({ alerte, onDismiss, userNames, produitRefs }: OverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(10)
  const onDismissRef = useRef(onDismiss)
  useEffect(() => { onDismissRef.current = onDismiss }, [onDismiss])

  const alertId = alerte.id
  useEffect(() => {
    setSecondsLeft(10)
    playAlarm()
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(iv)
          onDismissRef.current()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [alertId])

  const isUrgente = alerte.severite === 'urgente'
  const produitRef = produitRefs.get(alerte.produit_id) ?? `#${alerte.produit_id}`
  const responsable = userNames.get(alerte.responsable_cible_id) ?? `#${alerte.responsable_cible_id}`
  const demandeur = userNames.get(alerte.demandeur_id) ?? `#${alerte.demandeur_id}`
  const progress = (secondsLeft / 10) * 100

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-danger text-cream"
      role="alertdialog"
      aria-live="assertive"
    >
      {/* Pulsing ring — suppressed by prefers-reduced-motion in CSS */}
      <div className="pointer-events-none absolute inset-0 animate-pulse opacity-20 bg-danger" />

      <div className="relative flex flex-col items-center gap-6 px-8 text-center max-w-3xl">
        {/* Title */}
        <p
          className="font-black uppercase tracking-widest text-cream/80"
          style={{ fontSize: 'clamp(1rem, 2.5vw, 1.75rem)' }}
        >
          ⚠ {t('andon.overlay.titre')} ⚠
        </p>

        {/* Severity badge */}
        {isUrgente && (
          <span
            className="rounded-full border-4 border-cream px-8 py-2 font-black uppercase tracking-widest"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 2.25rem)' }}
          >
            URGENTE
          </span>
        )}

        {/* Product */}
        <p
          className="font-bold leading-tight"
          style={{ fontSize: 'clamp(2rem, 6vw, 5rem)' }}
        >
          {produitRef}
        </p>

        {/* Chariot */}
        <p
          className="text-cream/80"
          style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}
        >
          Chariot&nbsp;{alerte.num_chariot}
        </p>

        {/* Arrow → responsable */}
        <p
          className="font-black"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 3.5rem)' }}
        >
          → {responsable.toUpperCase()}
        </p>

        {/* Demandeur */}
        <p
          className="text-cream/70"
          style={{ fontSize: 'clamp(0.875rem, 2vw, 1.5rem)' }}
        >
          {t('andon.overlay.demande')}&nbsp;: {demandeur}
        </p>

        {/* Progress bar + countdown */}
        <div className="w-full max-w-md space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-cream/20">
            <div
              className="h-full bg-cream transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-cream/60">
            {t('andon.overlay.fermeture')}&nbsp;{secondsLeft}s
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Pending actions panel ─────────────────────────────────────────────────

interface PendingPanelProps {
  alertes: AlerteRead[]
  userNames: Map<number, string>
  produitRefs: Map<number, string>
  className?: string
}

function PendingPanel({ alertes, userNames, produitRefs, className }: PendingPanelProps) {
  const pending = alertes
    .filter((a) => a.statut === 'ouverte' || a.statut === 'acquittee')
    .sort((a, b) => {
      if (a.severite !== b.severite) return a.severite === 'urgente' ? -1 : 1
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      <h2
        className="mb-3 font-bold text-ink-heading shrink-0"
        style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}
      >
        {t('andon.pending.titre')}
        {pending.length > 0 && (
          <span className="ml-2 rounded-full bg-danger px-2 py-0.5 text-xs text-cream font-semibold">
            {pending.length}
          </span>
        )}
      </h2>

      {pending.length === 0 ? (
        <p
          className="text-ink-muted italic"
          style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
        >
          {t('andon.pending.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 overflow-y-auto">
          {pending.map((a) => {
            const isUrgente = a.statut === 'ouverte' && a.severite === 'urgente'
            return (
              <li
                key={a.id}
                className={cn(
                  'rounded-xl border p-3 space-y-1',
                  isUrgente
                    ? 'border-danger/40 bg-danger/8'
                    : 'border-cream-subtle bg-white',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-bold text-ink-heading truncate"
                    style={{ fontSize: 'clamp(0.875rem, 1.4vw, 1.125rem)' }}
                  >
                    {produitRefs.get(a.produit_id) ?? `#${a.produit_id}`}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                      a.statut === 'ouverte'
                        ? 'bg-danger/10 text-danger'
                        : 'bg-success/10 text-success',
                    )}
                  >
                    {a.statut === 'ouverte' ? 'OUVERTE' : 'ACQ.'}
                  </span>
                </div>
                <p
                  className="text-ink-muted truncate"
                  style={{ fontSize: 'clamp(0.7rem, 1.1vw, 0.875rem)' }}
                >
                  Chariot&nbsp;{a.num_chariot} · {userNames.get(a.demandeur_id) ?? '?'} → {userNames.get(a.responsable_cible_id) ?? '?'}
                </p>
                <p
                  className="text-ink-muted/70"
                  style={{ fontSize: 'clamp(0.65rem, 1vw, 0.8rem)' }}
                >
                  {t('andon.pending.depuis')}&nbsp;{fmtAge(a.created_at)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Suivi table ────────────────────────────────────────────────────────────

interface SuiviTableProps {
  suivis: SuiviRead[]
  newIds: Set<number>
  symptomesMap: Map<number, SymptomeRead>
  className?: string
}

function SuiviTable({ suivis, newIds, symptomesMap, className }: SuiviTableProps) {
  const MAX_ROWS = 20

  const th = 'px-3 py-2 text-left font-semibold text-ink-heading whitespace-nowrap'
  const td = 'px-3 py-2 align-middle'

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      <h2
        className="mb-3 font-bold text-ink-heading shrink-0"
        style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}
      >
        {t('andon.suivis.titre')}
      </h2>

      {suivis.length === 0 ? (
        <p
          className="text-ink-muted italic"
          style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}
        >
          {t('andon.suivis.empty')}
        </p>
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.95rem)' }}>
            <thead className="sticky top-0 z-10 bg-cream">
              <tr className="border-b-2 border-cream-subtle">
                <th className={th}>{t('andon.col.heure')}</th>
                <th className={th}>{t('andon.col.chariot')}</th>
                <th className={th}>{t('andon.col.npo')}</th>
                <th className={th}>{t('andon.col.ref')}</th>
                <th className={th}>{t('andon.col.client')}</th>
                <th className={th}>{t('andon.col.resultat')}</th>
                <th className={th}>{t('andon.col.defauts')}</th>
                <th className={th}>{t('andon.col.inspecteur')}</th>
              </tr>
            </thead>
            <tbody>
              {suivis.slice(0, MAX_ROWS).map((s) => {
                const defauts = s.symptomes
                  .filter((ss) => ss.present)
                  .map((ss) => symptomesMap.get(ss.symptome_id)?.code ?? `#${ss.symptome_id}`)
                return (
                  <tr
                    key={s.id}
                    className={cn(
                      'border-b border-cream-subtle',
                      s.resultat === 'NOK' ? 'bg-danger/5' : 'bg-white/60',
                      newIds.has(s.id) && 'andon-row-new',
                    )}
                  >
                    <td className={cn(td, 'font-mono tabular-nums text-ink-muted')}>
                      {s.heure.slice(0, 5)}
                    </td>
                    <td className={cn(td, 'font-semibold text-ink')}>{s.num_chariot}</td>
                    <td className={cn(td, 'text-ink-muted')}>{s.num_porte_objet}</td>
                    <td className={cn(td, 'font-medium text-ink truncate max-w-[12ch]')}>
                      {s.produit_reference ?? '-'}
                    </td>
                    <td className={cn(td, 'text-ink-muted truncate max-w-[10ch]')}>
                      {s.client_nom ?? '-'}
                    </td>
                    <td className={td}>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-bold text-xs',
                          s.resultat === 'OK'
                            ? 'bg-success/15 text-success'
                            : 'bg-danger/15 text-danger',
                        )}
                      >
                        {s.resultat}
                      </span>
                    </td>
                    <td className={cn(td, 'text-ink-muted')}>
                      {defauts.length > 0
                        ? defauts.join(', ')
                        : <span className="text-ink-muted/40">—</span>}
                    </td>
                    <td className={cn(td, 'text-ink-muted truncate max-w-[10ch]')}>
                      {s.inspecteur_nom ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export function AndonPage() {
  const today = todayISO()
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  const { suivis, alertes, connected, alertQueue, setAlertQueue, newSuiviIds } =
    useAndonSSE(today)

  // Emergency overlay: show first queued alert
  const currentOverlay = alertQueue[0] ?? null
  const dismissOverlay = useCallback(() => {
    setAlertQueue((prev) => prev.slice(1))
  }, [setAlertQueue])

  // Reference data
  const { data: users = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => api.utilisateurs.list(),
    staleTime: 5 * 60_000,
  })
  const { data: produits = [] } = useQuery({
    queryKey: ['produits'],
    queryFn: () => api.produits.list(),
    staleTime: 5 * 60_000,
  })
  const { data: symptomes = [] } = useQuery({
    queryKey: ['symptomes'],
    queryFn: () => api.symptomes.list(),
    staleTime: 60 * 60_000,
  })

  const userNames = new Map(users.map((u) => [u.id, u.nom]))
  const produitRefs = new Map(produits.map((p) => [p.id, p.reference]))
  const symptomesMap = new Map(symptomes.map((s) => [s.id, s]))

  return (
    <div className="h-dvh w-screen overflow-hidden bg-cream flex flex-col select-none">
      {/* Emergency overlay — rendered above everything */}
      {currentOverlay && (
        <EmergencyOverlay
          alerte={currentOverlay}
          onDismiss={dismissOverlay}
          userNames={userNames}
          produitRefs={produitRefs}
        />
      )}

      {/* Header */}
      <header className="bg-brand text-cream shrink-0 flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="PMP"
            className="h-7 w-auto rounded bg-white/90 px-1.5 py-0.5 object-contain"
          />
          <span className="font-bold" style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1.25rem)' }}>
            {t('andon.titre')}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* SSE connection dot */}
          <span className="flex items-center gap-1.5 text-cream/70" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.875rem)' }}>
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                connected ? 'bg-success animate-pulse' : 'bg-danger',
              )}
            />
            {connected ? t('andon.connected') : t('andon.disconnected')}
          </span>

          {/* Live clock */}
          <span
            className="font-mono tabular-nums text-cream/90"
            style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)' }}
          >
            {fmtClock(clock)}
          </span>
        </div>
      </header>

      {/* Body: table (left) + pending panel (right) */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <SuiviTable
          suivis={suivis}
          newIds={newSuiviIds}
          symptomesMap={symptomesMap}
          className="flex-[3] min-w-0"
        />
        <div className="w-px bg-cream-subtle shrink-0" />
        <PendingPanel
          alertes={alertes}
          userNames={userNames}
          produitRefs={produitRefs}
          className="flex-[1] min-w-[220px] max-w-xs"
        />
      </div>
    </div>
  )
}
