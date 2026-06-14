import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import type { SuiviRead } from '../lib/api'

function VisaRow({ suivi, myVisa }: { suivi: SuiviRead; myVisa: 'qualite' | 'prod' | null }) {
  const qc = useQueryClient()
  const signMut = useMutation({
    mutationFn: (type: 'qualite' | 'prod') => api.suivis.visa(suivi.id, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suivis'] }),
  })

  const hasSigned = (type: string) => suivi.visas.some(v => v.type === type)

  return (
    <tr className="border-b border-cream-subtle last:border-0 hover:bg-cream-subtle/50 transition-colors odd:bg-white even:bg-cream/30">
      <td className="px-4 py-3 text-sm font-mono text-xs">{suivi.date}</td>
      <td className="px-4 py-3 text-sm font-mono text-xs">{suivi.num_chariot}</td>
      <td className="px-4 py-3 text-sm font-mono text-xs">{suivi.num_porte_objet}</td>
      <td className="px-4 py-3 text-sm">
        <span className={`font-bold ${suivi.resultat === 'NOK' ? 'text-danger' : 'text-success'}`}>
          {suivi.resultat}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        {hasSigned('qualite') ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />{t('visa.signed')}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">{t('visa.notSigned')}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {hasSigned('prod') ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />{t('visa.signed')}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">{t('visa.notSigned')}</span>
        )}
      </td>
      {myVisa && (
        <td className="px-4 py-3">
          {hasSigned(myVisa) ? (
            <span className="text-xs font-medium text-success">{t('visa.signed')}</span>
          ) : (
            <button
              disabled={signMut.isPending}
              onClick={() => signMut.mutate(myVisa)}
              className="px-3 py-1.5 text-xs font-semibold bg-brand hover:bg-brand-dark text-cream rounded-lg transition-colors disabled:opacity-40"
            >
              {signMut.isPending ? '…' : t('visa.sign')}
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

export function VisaPage() {
  const { user } = useAuth()
  const [depuis, setDepuis] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })

  const { data: suivis = [], isLoading } = useQuery({
    queryKey: ['suivis', depuis],
    queryFn: () => api.suivis.list(),
  })

  const myVisa: 'qualite' | 'prod' | null =
    user?.role === 'qualite' ? 'qualite' : user?.role === 'prod' ? 'prod' : null

  const roleLabel = user?.role === 'qualite' ? t('role.qualite') : t('role.prod')

  return (
    <AppLayout title={`${t('visa.titre')} — ${roleLabel}`}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-3xl font-bold text-ink-heading">{t('visa.titre')}</h1>
          <label className="text-sm font-medium text-ink-heading flex items-center gap-2">
            {t('kpis.depuis')}
            <input
              type="date"
              className="border border-cream-subtle bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              value={depuis}
              onChange={e => setDepuis(e.target.value)}
            />
          </label>
        </div>

        <div className="bg-white rounded-lg shadow-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-cream-subtle">
            <ClipboardCheck size={20} strokeWidth={1.5} className="text-brand" />
            <h2 className="text-lg font-semibold text-ink-heading">{roleLabel}</h2>
          </div>

          {isLoading ? (
            <div className="px-6 py-8 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-4 bg-cream-subtle rounded animate-pulse" />)}
            </div>
          ) : suivis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-ink-muted">
              <ClipboardCheck size={24} strokeWidth={1.5} />
              <p className="text-sm">Aucun suivi enregistré sur cette période.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cream-subtle border-b border-cream-subtle">
                    {['Date', 'Chariot', 'Porte-Obj.', 'Résultat', t('visa.qualite'), t('visa.prod'), ...(myVisa ? ['Action'] : [])].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suivis.map(s => (
                    <VisaRow key={s.id} suivi={s} myVisa={myVisa} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
