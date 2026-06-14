import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import { t } from '../lib/i18n'

const TEAL = '#1a5560'
const NOK_RED = '#b84545'
const CREAM = '#f5e8dc'

function seit30Days(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export function KpisPage() {
  const [depuis, setDepuis] = useState(seit30Days)
  const [exporting, setExporting] = useState(false)

  const { data: tauxNc = [], isLoading: loadingTaux } = useQuery({
    queryKey: ['kpis.taux-nc', depuis],
    queryFn: () => api.kpis.tauxNc(depuis),
  })

  const { data: precurseurs = [], isLoading: loadingPrec } = useQuery({
    queryKey: ['kpis.precurseurs', depuis],
    queryFn: () => api.kpis.precurseurs(depuis),
  })

  const { data: tempsReponse = [], isLoading: loadingTemps } = useQuery({
    queryKey: ['kpis.temps-reponse', depuis],
    queryFn: () => api.kpis.tempsReponse(depuis),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await api.exportSuiviPdf(depuis)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `suivi-${depuis}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <AppLayout title={t('page.kpis')}>
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-primary">{t('kpis.titre')}</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">
            {t('kpis.depuis')}
            <input
              type="date"
              className="ml-2 border rounded px-2 py-1 text-sm"
              value={depuis}
              onChange={e => setDepuis(e.target.value)}
            />
          </label>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary text-sm px-3 py-1 rounded disabled:opacity-50"
          >
            {exporting ? t('kpis.exporting') : t('kpis.export')}
          </button>
        </div>
      </div>

      {/* Taux NC */}
      <section>
        <h2 className="text-lg font-semibold mb-2">{t('kpis.tauxNc.titre')}</h2>
        {loadingTaux ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : tauxNc.length === 0 ? (
          <p className="text-sm text-muted">{t('kpis.tauxNc.empty')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tauxNc}>
              <CartesianGrid strokeDasharray="3 3" stroke={CREAM} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, t('kpis.tauxNc.yAxis')]}
              />
              <Line
                type="monotone"
                dataKey="taux"
                stroke={NOK_RED}
                strokeWidth={2}
                dot={{ r: 3, fill: NOK_RED }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Pareto précurseurs */}
      <section>
        <h2 className="text-lg font-semibold mb-2">{t('kpis.precurseurs.titre')}</h2>
        {loadingPrec ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : precurseurs.length === 0 ? (
          <p className="text-sm text-muted">{t('kpis.precurseurs.empty')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={precurseurs} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={CREAM} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="code" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" name={t('kpis.precurseurs.yAxis')} radius={[0, 4, 4, 0]}>
                {precurseurs.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === 0 ? NOK_RED : TEAL}
                    opacity={1 - i * 0.12}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Temps de réponse */}
      <section>
        <h2 className="text-lg font-semibold mb-2">{t('kpis.tempsReponse.titre')}</h2>
        {loadingTemps ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : tempsReponse.length === 0 ? (
          <p className="text-sm text-muted">{t('kpis.tempsReponse.empty')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke={CREAM} />
              <XAxis
                dataKey="created_at"
                name="Date"
                tickFormatter={v => new Date(v).toLocaleDateString('fr-TN')}
                tick={{ fontSize: 10 }}
              />
              <YAxis dataKey="duree_secondes" name={t('kpis.tempsReponse.yAxis')} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, name) =>
                  name === t('kpis.tempsReponse.yAxis') ? [`${v}s`, name] : [v, name]
                }
              />
              <Scatter
                data={tempsReponse}
                fill={TEAL}
                shape={(props: { cx?: number; cy?: number; payload?: { severite: string } }) => {
                  const { cx = 0, cy = 0, payload } = props
                  const fill = payload?.severite === 'urgente' ? NOK_RED : TEAL
                  return <circle cx={cx} cy={cy} r={5} fill={fill} opacity={0.8} />
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
        <p className="text-xs text-muted mt-1">
          ● normale &nbsp;
          <span style={{ color: NOK_RED }}>● urgente</span>
        </p>
      </section>
    </div>
    </AppLayout>
  )
}
