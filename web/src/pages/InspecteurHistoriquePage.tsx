import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ClipboardList, CheckCircle, AlertTriangle, LogOut, WifiOff } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useConnectivity } from '../lib/connectivity'
import { t } from '../lib/i18n'
import { cn } from '../lib/cn'

function since30Days(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export function InspecteurHistoriquePage() {
  const { user, logout } = useAuth()
  const { online } = useConnectivity()
  const navigate = useNavigate()
  const [depuis, setDepuis] = useState(since30Days)

  const { data: suivis = [], isLoading } = useQuery({
    queryKey: ['suivis', 'mine', user?.id],
    queryFn: () => api.suivis.list({ inspecteur_id: user?.id }),
    enabled: !!user,
  })

  const { data: symptomeCatalogue = [] } = useQuery({
    queryKey: ['symptomes'],
    queryFn: api.symptomes.list,
  })
  const symptomeById = Object.fromEntries(symptomeCatalogue.map(s => [s.id, s.libelle_fr]))

  const filtered = suivis.filter(s => s.date >= depuis)
  const totalOk = filtered.filter(s => s.resultat === 'OK').length
  const totalNok = filtered.filter(s => s.resultat === 'NOK').length

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      {/* Same header as inspector wizard */}
      <header className="bg-brand text-ink-inverse shrink-0">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/inspecteur')}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-cream/10 hover:bg-cream/20 active:scale-95 transition-all"
              aria-label="Retour"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold">{t('app.title')}</span>
              <span className="text-cream/60 text-sm">— Mes contrôles</span>
              {!online && <WifiOff size={14} className="text-warning" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-cream/10 px-2 py-0.5 rounded">{user?.nom}</span>
            <button
              onClick={logout}
              className="text-cream/70 hover:text-cream p-1.5 rounded active:bg-cream/10"
            >
              <LogOut size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 max-w-4xl mx-auto w-full space-y-5">

        {/* Date filter */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-ink-heading">
            <ClipboardList size={20} strokeWidth={1.5} />
            <h1 className="text-xl font-bold">Mes contrôles</h1>
          </div>
          <label className="text-sm font-medium text-ink-heading flex items-center gap-2">
            Depuis
            <input
              type="date"
              value={depuis}
              onChange={e => setDepuis(e.target.value)}
              className="border border-cream-subtle bg-white rounded-lg px-3 py-1.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </label>
        </div>

        {/* Summary chips */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white shadow-card text-sm font-medium text-ink-muted">
              Total <span className="font-bold text-ink ml-1">{filtered.length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success/10 text-sm font-medium text-success">
              <CheckCircle size={15} strokeWidth={2} />
              OK <span className="font-bold ml-1">{totalOk}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-danger/10 text-sm font-medium text-danger">
              <AlertTriangle size={15} strokeWidth={2} />
              NOK <span className="font-bold ml-1">{totalNok}</span>
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-card overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-4 bg-cream-subtle rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-muted">
              <ClipboardList size={32} strokeWidth={1} />
              <p className="text-sm">Aucun contrôle enregistré sur cette période.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cream-subtle border-b border-cream-subtle">
                    {['Date', 'Heure', 'Chariot', 'Nb P.O.', 'Résultat', 'Défauts'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => {
                    const activeSymptomes = s.symptomes.filter(sym => sym.present)
                    return (
                      <tr
                        key={s.id}
                        className={cn(
                          'border-b border-cream-subtle last:border-0 transition-colors',
                          s.resultat === 'NOK' ? 'bg-danger/5' : idx % 2 === 0 ? 'bg-white' : 'bg-cream/30',
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-mono whitespace-nowrap">{s.date}</td>
                        <td className="px-4 py-3 text-sm font-mono whitespace-nowrap text-ink-muted">
                          {s.heure.slice(0, 5)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold whitespace-nowrap">
                          {s.num_chariot}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-mono">
                          {s.num_porte_objet}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold',
                            s.resultat === 'OK' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
                          )}>
                            {s.resultat === 'OK'
                              ? <CheckCircle size={11} strokeWidth={2.5} />
                              : <AlertTriangle size={11} strokeWidth={2.5} />}
                            {s.resultat}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-muted max-w-40">
                          {activeSymptomes.length > 0
                            ? activeSymptomes.map(sym => symptomeById[sym.symptome_id] ?? String(sym.symptome_id)).join(', ')
                            : <span className="text-ink-muted/40">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
