import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ClipboardList, CheckCircle, AlertTriangle,
  Clock, LogOut, WifiOff,
} from 'lucide-react'
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

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m${rem}s` : `${m}m`
}

function statutBadge(statut: string) {
  const map: Record<string, { label: string; cls: string }> = {
    cloturee:  { label: 'Clôturée',   cls: 'bg-success/10 text-success' },
    acquittee: { label: 'Acquittée',  cls: 'bg-info/10 text-info' },
    ouverte:   { label: 'Ouverte',    cls: 'bg-warning/10 text-warning' },
    expiree:   { label: 'Expirée',    cls: 'bg-danger/10 text-danger' },
  }
  const { label, cls } = map[statut] ?? { label: statut, cls: 'bg-ink-muted/10 text-ink-muted' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', cls)}>
      {label}
    </span>
  )
}

export function MethodeHistoriquePage() {
  const { user, logout } = useAuth()
  const { online } = useConnectivity()
  const navigate = useNavigate()
  const [depuis, setDepuis] = useState(since30Days)

  const { data: alertes = [], isLoading } = useQuery({
    queryKey: ['alertes', 'mine', user?.id],
    queryFn: () => api.alertes.list({ responsable_cible_id: user?.id }),
    enabled: !!user,
  })

  const filtered = alertes.filter(a => a.created_at.slice(0, 10) >= depuis)
  const cloturees = filtered.filter(a => a.statut === 'cloturee').length
  const expirees  = filtered.filter(a => a.statut === 'expiree').length

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      {/* Header */}
      <header className="bg-brand text-ink-inverse shrink-0">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-cream/10 hover:bg-cream/20 active:scale-95 transition-all"
              aria-label="Retour"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold">{t('app.title')}</span>
              <span className="text-cream/60 text-sm">— Mes interventions</span>
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

      <main className="flex-1 px-5 py-6 max-w-5xl mx-auto w-full space-y-5">

        {/* Date filter */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-ink-heading">
            <ClipboardList size={20} strokeWidth={1.5} />
            <h1 className="text-xl font-bold">Mes interventions</h1>
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
              Clôturées <span className="font-bold ml-1">{cloturees}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-danger/10 text-sm font-medium text-danger">
              <AlertTriangle size={15} strokeWidth={2} />
              Expirées <span className="font-bold ml-1">{expirees}</span>
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
              <p className="text-sm">Aucune intervention sur cette période.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cream-subtle border-b border-cream-subtle">
                    {['Date', 'Heure', 'Chariot', 'Sévérité', 'Statut', 'Tps réponse', 'Action enregistrée', 'Résultat'].map(h => (
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
                  {filtered.map((a, idx) => {
                    const responseMs = a.acknowledged_at
                      ? new Date(a.acknowledged_at).getTime() - new Date(a.created_at).getTime()
                      : null
                    return (
                      <tr
                        key={a.id}
                        className={cn(
                          'border-b border-cream-subtle last:border-0 transition-colors',
                          a.statut === 'expiree' ? 'bg-danger/5'
                            : idx % 2 === 0 ? 'bg-white' : 'bg-cream/30',
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-mono whitespace-nowrap">
                          {a.created_at.slice(0, 10)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono whitespace-nowrap text-ink-muted">
                          {new Date(a.created_at).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold whitespace-nowrap">
                          {a.num_chariot}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
                            a.severite === 'urgente' ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand',
                          )}>
                            {a.severite === 'urgente'
                              ? <AlertTriangle size={10} strokeWidth={2.5} className="mr-1" />
                              : <Clock size={10} strokeWidth={2.5} className="mr-1" />}
                            {a.severite.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">{statutBadge(a.statut)}</td>
                        <td className="px-4 py-3 text-sm font-mono tabular-nums text-ink-muted">
                          {responseMs !== null
                            ? formatDuration(responseMs)
                            : <span className="text-ink-muted/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink max-w-48">
                          {a.action_text ?? <span className="text-ink-muted/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-muted max-w-40">
                          {a.resultat_text ?? <span className="text-ink-muted/40">—</span>}
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
