import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import type { AlerteRead } from '../lib/api'

// ── Push subscription helpers ────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const reg = await navigator.serviceWorker.ready
  const { public_key } = await api.push.vapidPublicKey()
  const keyBytes = urlBase64ToUint8Array(public_key)
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes.buffer.slice(
      keyBytes.byteOffset,
      keyBytes.byteOffset + keyBytes.byteLength,
    ) as ArrayBuffer,
  })
  const j = subscription.toJSON()
  await api.push.subscribe({
    endpoint: subscription.endpoint,
    p256dh: j.keys?.p256dh ?? '',
    auth: j.keys?.auth ?? '',
  })
}

// ── Alerte card ───────────────────────────────────────────────────────────────

function MobileAlerteCard({ alerte }: { alerte: AlerteRead }) {
  const qc = useQueryClient()
  const ackMut = useMutation({
    mutationFn: () => api.alertes.ack(alerte.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertes'] }),
  })
  const [actionText, setActionText] = useState('')
  const decisionMut = useMutation({
    mutationFn: () => api.alertes.decision(alerte.id, { action_text: actionText }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertes'] }),
  })

  const isUrgente = alerte.severite === 'urgente'
  const isOpen = alerte.statut === 'ouverte' || alerte.statut === 'acquittee'

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 ${
        isUrgente && isOpen ? 'border-red-500 bg-red-50' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-base">
          {t('ecran.alerte.chariot')} {alerte.num_chariot}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${
            isUrgente ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
          }`}
        >
          {alerte.severite.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-muted">
        {t('ecran.alerte.depuis')} : {new Date(alerte.created_at).toLocaleString('fr-TN')}
      </p>
      <p className="text-xs font-medium">
        Statut :{' '}
        <span className="uppercase">{alerte.statut}</span>
      </p>

      {alerte.statut === 'ouverte' && (
        <button
          className="w-full btn-primary py-2 rounded font-bold"
          disabled={ackMut.isPending}
          onClick={() => ackMut.mutate()}
        >
          {ackMut.isPending ? t('ecran.acquitter.loading') : t('ecran.acquitter')}
        </button>
      )}

      {alerte.statut === 'acquittee' && (
        <div className="space-y-2 pt-1">
          <p className="text-sm font-medium">{t('ecran.decision.titre')}</p>
          <textarea
            className="w-full border rounded p-2 text-sm resize-none"
            rows={2}
            placeholder={t('ecran.decision.action')}
            value={actionText}
            onChange={e => setActionText(e.target.value)}
          />
          <button
            className="w-full btn-primary py-1.5 rounded text-sm font-bold disabled:opacity-50"
            disabled={!actionText.trim() || decisionMut.isPending}
            onClick={() => decisionMut.mutate()}
          >
            {decisionMut.isPending ? t('common.save') + '…' : t('ecran.decision.submit')}
          </button>
        </div>
      )}

      {alerte.statut === 'cloturee' && (
        <p className="text-sm text-green-700 font-medium">{t('ecran.cloturee')}</p>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function MethodeMobilePage() {
  const { user } = useAuth()
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'enabled' | 'denied'>('idle')

  const { data: alertes = [], isLoading } = useQuery({
    queryKey: ['alertes'],
    queryFn: () => api.alertes.list(),
    refetchInterval: 15_000,
  })

  const myAlertes = alertes.filter(
    a => a.responsable_cible_id === user?.id && a.statut !== 'expiree',
  )

  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') setPushState('enabled')
    else if (Notification.permission === 'denied') setPushState('denied')
  }, [])

  const handleEnablePush = async () => {
    setPushState('loading')
    try {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        await subscribeToPush()
        setPushState('enabled')
      } else {
        setPushState('denied')
      }
    } catch {
      setPushState('idle')
    }
  }

  return (
    <AppLayout title={t('mobile.titre')}>
    <div className="space-y-4 max-w-lg mx-auto">

      {/* Push toggle */}
      <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {pushState === 'enabled'
            ? t('mobile.push.enabled')
            : pushState === 'denied'
              ? t('mobile.push.denied')
              : t('mobile.push.enable')}
        </span>
        {pushState === 'idle' && (
          <button
            className="btn-primary text-sm px-3 py-1.5 rounded"
            onClick={handleEnablePush}
          >
            Activer
          </button>
        )}
        {pushState === 'loading' && (
          <span className="text-sm text-muted">{t('mobile.push.loading')}</span>
        )}
        {pushState === 'enabled' && (
          <span className="text-green-600 text-lg">✓</span>
        )}
      </div>

      {/* Alert list */}
      {isLoading ? (
        <p className="text-sm text-muted">{t('common.loading')}</p>
      ) : myAlertes.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">{t('mobile.noAlertes')}</p>
      ) : (
        <div className="space-y-3">
          {myAlertes.map(a => (
            <MobileAlerteCard key={a.id} alerte={a} />
          ))}
        </div>
      )}
    </div>
    </AppLayout>
  )
}
