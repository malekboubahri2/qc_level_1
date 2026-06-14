import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, CheckCircle, Clock, WifiOff } from 'lucide-react'
import { AppLayout } from '../components/AppLayout'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { StatusBadge } from '../components/StatusBadge'
import { api, type AlerteRead, type SuiviRead } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useConnectivity } from '../lib/connectivity'
import { t } from '../lib/i18n'
import { clearSyncedSuivis, getPendingSuivis, queueSuivi } from '../lib/idb'
import { cn } from '../lib/cn'

// ── Page state machine ───────────────────────────────────────────────────────

type PageState =
  | { tag: 'form' }
  | { tag: 'alerting'; suivi: SuiviRead }
  | { tag: 'pending'; alerte: AlerteRead }
  | { tag: 'acked'; alerte: AlerteRead }
  | { tag: 'expired'; alerte: AlerteRead }

// ── Suivi form schema ────────────────────────────────────────────────────────

const suiviSchema = z.object({
  num_chariot: z.string().min(1, 'Requis'),
  num_porte_objet: z.string().min(1, 'Requis'),
  client_id: z.coerce.number().min(1, 'Requis'),
  produit_id: z.coerce.number().min(1, 'Requis'),
  resultat: z.enum(['OK', 'NOK']),
  commentaire_decision: z.string().optional(),
  symptome_ids: z.array(z.number()).default([]),
})

type SuiviFormValues = z.infer<typeof suiviSchema>

// ── Alerte form schema ───────────────────────────────────────────────────────

const alerteSchema = z.object({
  responsable_cible_id: z.coerce.number().min(1, 'Requis'),
  severite: z.enum(['normale', 'urgente']),
})

type AlerteFormValues = z.infer<typeof alerteSchema>

// ── Offline banner ───────────────────────────────────────────────────────────

function OfflineBanner() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-danger px-5 py-4 text-cream shadow-elevated">
      <WifiOff className="shrink-0" size={22} />
      <p className="text-sm font-bold uppercase tracking-wider">{t('offline.banner')}</p>
    </div>
  )
}

// ── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ createdAt, timeoutSecs = 120 }: { createdAt: string; timeoutSecs?: number }) {
  const [left, setLeft] = useState(() => {
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000
    return Math.max(0, timeoutSecs - Math.floor(elapsed))
  })

  useEffect(() => {
    if (left <= 0) return
    const id = setInterval(() => setLeft((p) => Math.max(0, p - 1)), 1000)
    return () => clearInterval(id)
  }, [left])

  const pct = (left / timeoutSecs) * 100
  const barColor = left > 60 ? 'bg-success' : left > 30 ? 'bg-warning' : 'bg-danger'

  return (
    <div className="space-y-1">
      <p className="text-sm text-ink-muted">
        {t('alerte.countdown')}&nbsp;:{' '}
        <span className="font-bold text-ink">{left}s</span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-cream-subtle">
        <div className={cn('h-2 rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Suivi form component ─────────────────────────────────────────────────────

function SuiviForm({ onSubmitted }: { onSubmitted: (suivi: SuiviRead) => void }) {
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: api.clients.list })
  const { data: produits = [] } = useQuery({ queryKey: ['produits'], queryFn: api.produits.list })
  const { data: symptomes = [] } = useQuery({ queryKey: ['symptomes'], queryFn: api.symptomes.list })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SuiviFormValues>({
    resolver: zodResolver(suiviSchema),
    defaultValues: { resultat: 'OK', symptome_ids: [] },
  })

  const clientId = Number(watch('client_id'))
  const filteredProduits = produits.filter(
    (p) => p.actif && (!clientId || p.client_id === clientId || p.client_id === null),
  )
  const activeSymptomes = symptomes.filter((s) => s.actif)
  const symptomeIds = watch('symptome_ids') ?? []

  const { check } = useConnectivity()
  const [savedOffline, setSavedOffline] = useState(false)

  const onSubmit: SubmitHandler<SuiviFormValues> = async (values) => {
    const now = new Date()
    const local_uuid = crypto.randomUUID()
    const payload = {
      local_uuid,
      date: now.toISOString().slice(0, 10),
      heure: now.toISOString().slice(11, 19),
      num_chariot: values.num_chariot,
      num_porte_objet: values.num_porte_objet,
      client_id: Number(values.client_id),
      produit_id: Number(values.produit_id),
      resultat: values.resultat,
      commentaire_decision: values.commentaire_decision || null,
      symptomes: activeSymptomes
        .filter((s) => symptomeIds.includes(s.id))
        .map((s) => ({ symptome_id: s.id, present: true })),
    }

    await queueSuivi(payload)

    const isOnline = await check()
    if (isOnline) {
      try {
        const suivi = await api.suivis.create(payload)
        await clearSyncedSuivis([local_uuid])
        onSubmitted(suivi)
        return
      } catch { /* fall through */ }
    }
    setSavedOffline(true)
  }

  if (savedOffline) {
    return (
      <Card className="space-y-4 text-center">
        <CheckCircle className="mx-auto text-warning" size={40} />
        <p className="font-semibold text-ink">{t('suivi.savedOffline')}</p>
        <Button onClick={() => setSavedOffline(false)}>{t('alerte.nouveau')}</Button>
      </Card>
    )
  }

  const selectCls =
    'w-full rounded-lg border border-brand/20 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40'

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-semibold text-ink-heading">{t('suivi.titre')}</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">
              {t('suivi.numChariot')}
            </label>
            <Input {...register('num_chariot')} placeholder="CH-001" />
            {errors.num_chariot && <p className="mt-1 text-xs text-danger">{errors.num_chariot.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">
              {t('suivi.numPorteObjet')}
            </label>
            <Input {...register('num_porte_objet')} placeholder="PO-42" />
            {errors.num_porte_objet && <p className="mt-1 text-xs text-danger">{errors.num_porte_objet.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">{t('suivi.client')}</label>
          <select {...register('client_id')} className={selectCls}>
            <option value="">— Sélectionner —</option>
            {clients.filter((c) => c.actif).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          {errors.client_id && <p className="mt-1 text-xs text-danger">{errors.client_id.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">{t('suivi.produit')}</label>
          <select {...register('produit_id')} className={selectCls}>
            <option value="">— Sélectionner —</option>
            {filteredProduits.map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.libelle}</option>)}
          </select>
          {errors.produit_id && <p className="mt-1 text-xs text-danger">{errors.produit_id.message}</p>}
        </div>

        {/* OK / NOK */}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">{t('suivi.resultat')}</label>
          <div className="flex gap-3">
            {(['OK', 'NOK'] as const).map((val) => {
              const active = watch('resultat') === val
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setValue('resultat', val)}
                  className={cn(
                    'flex-1 rounded-lg border-2 py-3 text-sm font-bold transition-colors',
                    active && val === 'OK' && 'border-success bg-success/10 text-success',
                    active && val === 'NOK' && 'border-danger bg-danger/10 text-danger',
                    !active && 'border-brand/20 text-ink-muted hover:border-brand/40',
                  )}
                >
                  {t(`suivi.resultat.${val}`)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Symptom checkboxes */}
        {activeSymptomes.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">{t('suivi.symptomes')}</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {activeSymptomes.map((s) => {
                const checked = symptomeIds.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                      checked ? 'border-brand bg-brand/5 text-brand' : 'border-brand/20 text-ink hover:border-brand/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={checked}
                      onChange={(e) =>
                        setValue(
                          'symptome_ids',
                          e.target.checked ? [...symptomeIds, s.id] : symptomeIds.filter((id) => id !== s.id),
                        )
                      }
                    />
                    {s.libelle_fr}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">{t('suivi.commentaire')}</label>
          <textarea
            {...register('commentaire_decision')}
            rows={2}
            className="w-full rounded-lg border border-brand/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="Observation…"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('suivi.submitting') : t('suivi.submit')}
        </Button>
      </form>
    </Card>
  )
}

// ── Alerte modal ─────────────────────────────────────────────────────────────

function AlerteModal({
  suivi,
  onConfirm,
  onCancel,
}: {
  suivi: SuiviRead
  onConfirm: (a: AlerteRead) => void
  onCancel: () => void
}) {
  const { data: utilisateurs = [] } = useQuery({ queryKey: ['utilisateurs'], queryFn: api.utilisateurs.list })
  const methodes = utilisateurs.filter((u) => u.role === 'methode' && u.actif)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AlerteFormValues>({
    resolver: zodResolver(alerteSchema),
    defaultValues: { severite: 'normale' },
  })

  const [deliveryError, setDeliveryError] = useState<string | null>(null)
  const { check } = useConnectivity()

  const onSubmit: SubmitHandler<AlerteFormValues> = async (values) => {
    setDeliveryError(null)
    const isOnline = await check()
    if (!isOnline) { setDeliveryError(t('offline.banner')); return }
    try {
      const alerte = await api.alertes.create({
        local_uuid: crypto.randomUUID(),
        suivi_id: suivi.id,
        produit_id: suivi.produit_id,
        num_chariot: suivi.num_chariot,
        severite: values.severite,
        responsable_cible_id: Number(values.responsable_cible_id),
      })
      onConfirm(alerte)
    } catch {
      setDeliveryError(t('offline.banner'))
    }
  }

  const selectCls =
    'w-full rounded-lg border border-brand/20 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4">
      <Card className="w-full max-w-md space-y-5">
        <h2 className="text-lg font-semibold text-ink-heading">{t('alerte.titre')}</h2>

        {deliveryError && (
          <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
            <WifiOff size={18} />
            {deliveryError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">{t('alerte.responsable')}</label>
            <select {...register('responsable_cible_id')} className={selectCls}>
              <option value="">— Sélectionner —</option>
              {methodes.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
            {errors.responsable_cible_id && <p className="mt-1 text-xs text-danger">{errors.responsable_cible_id.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">{t('alerte.severite')}</label>
            <div className="flex gap-3">
              {(['normale', 'urgente'] as const).map((val) => {
                const active = watch('severite') === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setValue('severite', val)}
                    className={cn(
                      'flex-1 rounded-lg border-2 py-3 text-sm font-bold transition-colors',
                      active && val === 'urgente' && 'border-danger bg-danger/10 text-danger',
                      active && val === 'normale' && 'border-brand bg-brand/10 text-brand',
                      !active && 'border-brand/20 text-ink-muted hover:border-brand/40',
                    )}
                  >
                    {t(`alerte.severite.${val}`)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? t('alerte.sending') : t('alerte.submit')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ── Pending ACK panel ────────────────────────────────────────────────────────

function PendingAck({
  alerte,
  onAcked,
  onExpired,
}: {
  alerte: AlerteRead
  onAcked: (a: AlerteRead) => void
  onExpired: (a: AlerteRead) => void
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const updated = await api.alertes.get(alerte.id)
        if (updated.statut === 'acquittee') onAcked(updated)
        else if (updated.statut === 'expiree') onExpired(updated)
      } catch { /* retry */ }
    }
    intervalRef.current = setInterval(() => void poll(), 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [alerte.id, onAcked, onExpired])

  return (
    <Card className="space-y-4 text-center">
      <Clock className="mx-auto text-brand" size={40} style={{ animation: 'spin 2s linear infinite' }} />
      <p className="font-semibold text-ink">{t('alerte.pending')}</p>
      <Countdown createdAt={alerte.created_at} />
      <StatusBadge tone="info">{t('ecran.statut.ouverte')}</StatusBadge>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function InspecteurPage() {
  const [state, setState] = useState<PageState>({ tag: 'form' })
  const { online } = useConnectivity()
  const { user } = useAuth()

  // Background sync: flush IDB queue when online.
  useEffect(() => {
    if (!online) return
    void (async () => {
      const pending = await getPendingSuivis()
      if (!pending.length) return
      try {
        const synced = await api.suivis.sync(pending)
        await clearSyncedSuivis(synced.map((s) => s.local_uuid))
      } catch { /* retry later */ }
    })()
  }, [online])

  const showBanner = !online || state.tag === 'expired'

  return (
    <AppLayout title={t('page.inspecteur')}>
      <div className="mx-auto max-w-xl space-y-6">
        {showBanner && <OfflineBanner />}

        {state.tag === 'form' && (
          <>
            <SuiviForm onSubmitted={(suivi) => setState({ tag: 'alerting', suivi })} />
            <p className="text-center text-xs text-ink-muted">
              {user?.nom} · {t(`role.${user?.role ?? 'inspecteur'}`)}
            </p>
          </>
        )}

        {state.tag === 'alerting' && (
          <>
            <Card className="border border-success/30 bg-success/5 text-center">
              <CheckCircle className="mx-auto mb-2 text-success" size={32} />
              <p className="font-semibold text-ink">{t('suivi.saved')}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {t('suivi.numChariot')}: <strong>{state.suivi.num_chariot}</strong>
                &ensp;·&ensp;{t('suivi.resultat')}: <strong>{state.suivi.resultat}</strong>
              </p>
            </Card>

            <div className="flex gap-3">
              <Button variant="danger" size="lg" className="flex-1 text-base font-bold">
                {t('alerte.button')}
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setState({ tag: 'form' })}>
                {t('alerte.nouveau')}
              </Button>
            </div>

            <AlerteModal
              suivi={state.suivi}
              onConfirm={(a) => setState({ tag: 'pending', alerte: a })}
              onCancel={() => setState({ tag: 'form' })}
            />
          </>
        )}

        {state.tag === 'pending' && (
          <>
            <PendingAck
              alerte={state.alerte}
              onAcked={(a) => setState({ tag: 'acked', alerte: a })}
              onExpired={(a) => setState({ tag: 'expired', alerte: a })}
            />
            <Button variant="ghost" size="sm" className="w-full text-ink-muted" onClick={() => setState({ tag: 'form' })}>
              {t('alerte.nouveau')}
            </Button>
          </>
        )}

        {state.tag === 'acked' && (
          <Card className="space-y-4 text-center">
            <CheckCircle className="mx-auto text-success" size={48} />
            <p className="text-lg font-bold text-success">{t('alerte.acquittee')}</p>
            <StatusBadge tone="success">{t('ecran.statut.acquittee')}</StatusBadge>
            <Button onClick={() => setState({ tag: 'form' })} className="w-full">{t('alerte.nouveau')}</Button>
          </Card>
        )}

        {state.tag === 'expired' && (
          <Card className="space-y-4 border-2 border-danger text-center">
            <AlertTriangle className="mx-auto text-danger" size={48} />
            <p className="text-lg font-bold text-danger">{t('alerte.expiree')}</p>
            <p className="text-sm font-bold uppercase tracking-wider text-danger">
              {t('offline.banner')}
            </p>
            <Button onClick={() => setState({ tag: 'form' })} className="w-full">{t('alerte.nouveau')}</Button>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
