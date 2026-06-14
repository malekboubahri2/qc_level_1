import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import type { SuiviRead } from '../lib/api'

function VisaRow({ suivi }: { suivi: SuiviRead }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const role = user?.role as 'qualite' | 'prod' | 'methode' | undefined

  const myVisa = role === 'qualite' ? 'qualite' : role === 'prod' ? 'prod' : null

  const signMut = useMutation({
    mutationFn: (type: 'qualite' | 'prod') => api.suivis.visa(suivi.id, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suivis'] }),
  })

  const hasSigned = (type: string) =>
    suivi.visas.some(v => v.type === type)

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 px-3 text-sm">{suivi.date}</td>
      <td className="py-2 px-3 text-sm font-mono">{suivi.num_chariot}</td>
      <td className="py-2 px-3 text-sm font-mono">{suivi.num_porte_objet}</td>
      <td className={`py-2 px-3 text-sm font-bold ${suivi.resultat === 'NOK' ? 'text-red-600' : 'text-green-700'}`}>
        {suivi.resultat}
      </td>
      <td className="py-2 px-3 text-sm">
        <span className={hasSigned('qualite') ? 'text-green-600' : 'text-muted'}>
          {hasSigned('qualite') ? t('visa.signed') : t('visa.notSigned')}
        </span>
      </td>
      <td className="py-2 px-3 text-sm">
        <span className={hasSigned('prod') ? 'text-green-600' : 'text-muted'}>
          {hasSigned('prod') ? t('visa.signed') : t('visa.notSigned')}
        </span>
      </td>
      {myVisa && (
        <td className="py-2 px-3">
          {hasSigned(myVisa) ? (
            <span className="text-green-600 text-sm font-medium">{t('visa.signed')}</span>
          ) : (
            <button
              className="btn-primary text-xs px-2 py-1 rounded disabled:opacity-50"
              disabled={signMut.isPending}
              onClick={() => signMut.mutate(myVisa)}
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

  const roleLabel =
    user?.role === 'qualite' ? t('role.qualite') : t('role.prod')

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-primary">
          {t('visa.titre')} — {roleLabel}
        </h1>
        <label className="text-sm font-medium">
          {t('kpis.depuis')}
          <input
            type="date"
            className="ml-2 border rounded px-2 py-1 text-sm"
            value={depuis}
            onChange={e => setDepuis(e.target.value)}
          />
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">{t('common.loading')}</p>
      ) : suivis.length === 0 ? (
        <p className="text-sm text-muted">{t('kpis.tauxNc.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="bg-primary text-primary-foreground text-xs uppercase">
              <tr>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Chariot</th>
                <th className="py-2 px-3">Porte-Obj.</th>
                <th className="py-2 px-3">Résultat</th>
                <th className="py-2 px-3">{t('visa.qualite')}</th>
                <th className="py-2 px-3">{t('visa.prod')}</th>
                {(user?.role === 'qualite' || user?.role === 'prod') && (
                  <th className="py-2 px-3">Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {suivis.map(s => (
                <VisaRow key={s.id} suivi={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
