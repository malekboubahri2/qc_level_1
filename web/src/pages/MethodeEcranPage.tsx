/* Office-screen kiosk for méthode responsables.
   ADR-0001: active-alert state uses stronger contrast + motion + sound (alarm
   exception). All other states stay on-brand (cream/teal). */

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle, ClipboardList, WifiOff } from 'lucide-react'
import { AppLayout } from '../components/AppLayout'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { api, type AlerteRead, type ProduitRead, type UtilisateurRead } from '../lib/api'
import { useAuth } from '../lib/auth'
import { t } from '../lib/i18n'
import { useAlertesSSE, playAlarm } from '../lib/sse'
import { cn } from '../lib/cn'

// ── Decision form ────────────────────────────────────────────────────────────

const decisionSchema = z.object({
  action_text: z.string().min(1, 'Requis'),
  resultat_text: z.string().optional(),
})

type DecisionValues = z.infer<typeof decisionSchema>

function DecisionForm({
  alerteId,
  onClosed,
}: {
  alerteId: number
  onClosed: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DecisionValues>({ resolver: zodResolver(decisionSchema) })

  const onSubmit: SubmitHandler<DecisionValues> = async (values) => {
    await api.alertes.decision(alerteId, {
      action_text: values.action_text,
      resultat_text: values.resultat_text || null,
    })
    onClosed()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3 border-t border-brand/10 pt-4">
      <p className="text-sm font-semibold text-ink-heading">{t('ecran.decision.titre')}</p>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">
          {t('ecran.decision.action')}
        </label>
        <textarea
          {...register('action_text')}
          rows={2}
          className="w-full rounded-lg border border-brand/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder="Action effectuée…"
        />
        {errors.action_text && <p className="mt-1 text-xs text-danger">{errors.action_text.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">
          {t('ecran.decision.resultat')}
        </label>
        <textarea
          {...register('resultat_text')}
          rows={2}
          className="w-full rounded-lg border border-brand/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder="Observation / résultat…"
        />
      </div>
      <Button type="submit" size="sm" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.save') + '…' : t('ecran.decision.submit')}
      </Button>
    </form>
  )
}

// ── Alerte card ───────────────────────────────────────────────────────────────

function AlerteCard({
  alerte,
  produits,
  utilisateurs,
  onUpdated,
}: {
  alerte: AlerteRead
  produits: ProduitRead[]
  utilisateurs: UtilisateurRead[]
  onUpdated: (a: AlerteRead) => void
}) {
  const { user } = useAuth()
  const [showDecision, setShowDecision] = useState(false)
  const [acking, setAcking] = useState(false)

  const produit = produits.find((p) => p.id === alerte.produit_id)
  const demandeur = utilisateurs.find((u) => u.id === alerte.demandeur_id)

  const elapsed = Math.floor((Date.now() - new Date(alerte.created_at).getTime()) / 1000)
  const elapsedStr =
    elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}min ${elapsed % 60}s`

  const isUrgent = alerte.severite === 'urgente'
  const isOpen = alerte.statut === 'ouverte'
  const isAcquittee = alerte.statut === 'acquittee'
  const isClosed = alerte.statut === 'cloturee' || alerte.statut === 'expiree'

  const handleAck = async () => {
    setAcking(true)
    try {
      const updated = await api.alertes.ack(alerte.id)
      onUpdated(updated)
      setShowDecision(true)
    } catch { /* UI will reflect error on next poll */ }
    finally { setAcking(false) }
  }

  // Tone badge
  const statusTone =
    alerte.statut === 'cloturee'
      ? 'success'
      : alerte.statut === 'expiree'
        ? 'danger'
        : alerte.statut === 'acquittee'
          ? 'warning'
          : isUrgent
            ? 'danger'
            : 'info'

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-5 transition-all',
        // ADR-0001: alarm exception for open/urgent alertes
        isOpen && isUrgent && 'animate-pulse border-danger bg-danger text-cream',
        isOpen && !isUrgent && 'border-warning bg-warning/10',
        isAcquittee && 'border-brand bg-brand/5',
        isClosed && 'border-cream-subtle bg-cream/50 opacity-75',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isOpen && isUrgent && <AlertTriangle size={18} className="text-cream" />}
            {isOpen && !isUrgent && <Bell size={18} className="text-warning" />}
            <span
              className={cn(
                'text-base font-bold',
                isOpen && isUrgent ? 'text-cream' : 'text-ink-heading',
              )}
            >
              {t('ecran.alerte.chariot')}: {alerte.num_chariot}
            </span>
            <StatusBadge tone={statusTone}>
              {t(`ecran.statut.${alerte.statut}`)}
            </StatusBadge>
          </div>
          <p className={cn('text-sm', isOpen && isUrgent ? 'text-cream/80' : 'text-ink-muted')}>
            {produit ? `${produit.reference} — ${produit.libelle}` : `Produit #${alerte.produit_id}`}
          </p>
        </div>
        <div className={cn('text-right text-xs', isOpen && isUrgent ? 'text-cream/70' : 'text-ink-muted')}>
          <p>{t('ecran.alerte.depuis')}: {elapsedStr}</p>
          {demandeur && <p className="mt-0.5">{t('ecran.alerte.demande')}: {demandeur.nom}</p>}
        </div>
      </div>

      {/* ACK button — only for methode users on open alertes */}
      {isOpen && (user?.role === 'methode' || user?.role === 'admin') && (
        <Button
          variant="primary"
          size="lg"
          className={cn(
            'mt-4 w-full text-base font-bold',
            isUrgent && 'bg-cream text-danger hover:bg-cream/90',
          )}
          onClick={handleAck}
          disabled={acking}
        >
          {acking ? t('ecran.acquitter.loading') : t('ecran.acquitter')}
        </Button>
      )}

      {/* Decision form — appears after ACK or on acquittee alertes */}
      {isAcquittee && (showDecision || alerte.statut === 'acquittee') && (
        <DecisionForm
          alerteId={alerte.id}
          onClosed={() => setShowDecision(false)}
        />
      )}

      {alerte.statut === 'cloturee' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-success">
          <CheckCircle size={16} />
          <span>{t('ecran.cloturee')}</span>
        </div>
      )}
    </div>
  )
}

// ── Connection indicator ──────────────────────────────────────────────────────

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          connected ? 'animate-pulse bg-success' : 'bg-danger',
        )}
      />
      <span className="text-xs text-ink-muted">
        {connected ? t('common.connected') : <span className="flex items-center gap-1"><WifiOff size={12} /> SSE</span>}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MethodeEcranPage() {
  const { alertes, setAlertes, connected } = useAlertesSSE()
  const prevCountRef = useRef(0)

  const { data: produits = [] } = useQuery({ queryKey: ['produits'], queryFn: api.produits.list })
  const { data: utilisateurs = [] } = useQuery({ queryKey: ['utilisateurs'], queryFn: api.utilisateurs.list })

  // Play alarm whenever the number of open alertes increases.
  const openCount = alertes.filter((a) => a.statut === 'ouverte').length
  useEffect(() => {
    if (openCount > prevCountRef.current) playAlarm()
    prevCountRef.current = openCount
  }, [openCount])

  const activeAlertes = alertes.filter((a) => a.statut !== 'cloturee')
  const closedAlertes = alertes.filter((a) => a.statut === 'cloturee')

  const handleUpdated = (updated: AlerteRead) => {
    setAlertes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  // Background: dark if there's an urgent open alerte (ADR-0001 alarm exception).
  const urgentOpen = alertes.some((a) => a.statut === 'ouverte' && a.severite === 'urgente')

  return (
    <AppLayout title={t('page.methode.ecran')}>
      <div
        className={cn(
          'min-h-[60vh] rounded-xl p-4 transition-colors duration-500',
          urgentOpen ? 'bg-danger/5' : 'bg-transparent',
        )}
      >
        {/* Header bar */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink-heading">{t('ecran.titre')}</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/methode/historique"
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand transition-colors"
            >
              <ClipboardList size={16} strokeWidth={1.5} />
              Historique
            </Link>
            <ConnectionDot connected={connected} />
          </div>
        </div>

        {activeAlertes.length === 0 && closedAlertes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-ink-muted">
            <CheckCircle size={48} className="mb-4 text-brand/30" />
            <p className="text-lg">{t('ecran.empty')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAlertes.map((a) => (
              <AlerteCard
                key={a.id}
                alerte={a}
                produits={produits}
                utilisateurs={utilisateurs}
                onUpdated={handleUpdated}
              />
            ))}
            {closedAlertes.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
                  {closedAlertes.length} alerte(s) clôturée(s)
                </summary>
                <div className="mt-3 space-y-3">
                  {closedAlertes.map((a) => (
                    <AlerteCard
                      key={a.id}
                      alerte={a}
                      produits={produits}
                      utilisateurs={utilisateurs}
                      onUpdated={handleUpdated}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
