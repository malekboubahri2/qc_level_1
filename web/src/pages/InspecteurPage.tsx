/**
 * InspecteurPage — full-screen step wizard, touch-first.
 *
 * Flow (form):  chariot → porte_objet → client → produit → resultat
 *               OK → [submit] → alerte_ask
 *               NOK → defauts → [submit] → alerte_ask
 *
 * Flow (alerte): alerte_ask → alerte_responsable → alerte_severite
 *                → pending → acked | expired
 *
 * Design principles:
 *  - Every step fills 100dvh minus the header (no scrolling required)
 *  - Single-option client/produit → auto-skip
 *  - Single-tap selections auto-advance (no separate Confirm)
 *  - Offline: suivi queued in IDB; alerte blocked with red screen
 */

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, LogOut, WifiOff, CheckCircle,
  AlertTriangle, Clock, Bell, ClipboardList,
} from 'lucide-react'
import { api, type AlerteRead, type ClientRead, type ProduitRead, type SuiviRead, type UtilisateurRead } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useConnectivity } from '../lib/connectivity'
import { t } from '../lib/i18n'
import { clearSyncedSuivis, getPendingSuivis, queueSuivi } from '../lib/idb'
import { cn } from '../lib/cn'
import { parseServerDate } from '../lib/date'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | 'chariot' | 'porte_objet' | 'client' | 'produit' | 'resultat' | 'defauts'
  | 'submitting'
  | 'alerte_ask' | 'alerte_responsable' | 'alerte_severite' | 'alerte_sending'
  | 'pending' | 'acked' | 'expired' | 'saved_offline'

type WizardData = {
  num_chariot: string
  num_porte_objet: string
  client_id: number | null
  produit_id: number | null
  resultat: 'OK' | 'NOK'
  symptome_ids: number[]
  commentaire: string
}

const INIT: WizardData = {
  num_chariot: '', num_porte_objet: '',
  client_id: null, produit_id: null,
  resultat: 'OK', symptome_ids: [], commentaire: '',
}

// ── Layout ────────────────────────────────────────────────────────────────────

function InspecteurLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { online } = useConnectivity()
  return (
    <div className="h-dvh flex flex-col bg-cream overflow-hidden select-none">
      <header className="bg-brand text-ink-inverse shrink-0 z-10">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="PMP"
              className="h-8 w-auto shrink-0 rounded bg-white/90 px-1.5 py-0.5 object-contain"
            />
            {!online && <WifiOff size={14} className="text-warning" />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="max-w-[100px] truncate rounded bg-cream/10 px-2 py-0.5 text-xs">
              {user?.nom}
            </span>
            <Link
              to="/inspecteur/historique"
              className="rounded p-1.5 text-cream/70 hover:text-cream active:bg-cream/10"
              title="Historique"
            >
              <ClipboardList size={18} strokeWidth={1.5} />
            </Link>
            <button
              onClick={logout}
              className="rounded p-1.5 text-cream/70 hover:text-cream active:bg-cream/10"
            >
              <LogOut size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  )
}

// ── Step chrome (progress + back + label) ─────────────────────────────────────

function StepChrome({
  step, totalSteps, onBack, label, sublabel, children, footer,
}: {
  step: number; totalSteps: number; onBack?: () => void
  label: string; sublabel?: string
  children: React.ReactNode; footer?: React.ReactNode
}) {
  return (
    <div className="relative flex flex-col h-full">
      {/* Progress + back */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 shrink-0">
        <button
          onClick={onBack}
          disabled={!onBack}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-card text-ink-muted
                     disabled:opacity-0 active:scale-95 transition-transform shrink-0"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <div className="flex-1 h-2 bg-cream-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
        <span className="text-sm text-ink-muted tabular-nums shrink-0">{step}/{totalSteps}</span>
      </div>

      {/* Title */}
      <div className="px-5 pt-1 pb-4 shrink-0">
        <h1 className="text-3xl font-bold text-ink-heading leading-tight">{label}</h1>
        {sublabel && <p className="mt-2 text-base text-ink-muted">{sublabel}</p>}
      </div>

      {/* Scrollable content — bottom padding reserves room for the absolute footer */}
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: 'calc(7rem + var(--keyboard-inset, 0px))' }}
      >
        {children}
      </div>

      {/* Footer floats above keyboard — absolute, never squishes the layout */}
      {footer && (
        <div
          className="absolute left-0 right-0 bg-cream px-5 pt-2"
          style={{ bottom: 'var(--keyboard-inset, 0px)', paddingBottom: '1.5rem' }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function BigBtn({
  onClick, disabled, children, variant = 'primary', className = '',
}: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'danger' | 'success' | 'ghost'; className?: string
}) {
  const styles: Record<string, string> = {
    primary: 'bg-brand hover:bg-brand-dark text-cream shadow-card',
    danger: 'bg-danger text-cream shadow-card',
    success: 'bg-success text-cream shadow-card',
    ghost: 'bg-white border-2 border-brand text-brand',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full py-6 rounded-2xl text-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-30',
        styles[variant], className,
      )}
    >
      {children}
    </button>
  )
}

function PickCard({
  onClick, selected, primary, secondary,
}: {
  onClick: () => void; selected?: boolean; primary: string; secondary?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-5 py-5 rounded-xl border-2 transition-all active:scale-[0.98] shadow-card',
        selected
          ? 'border-brand bg-brand/5 text-brand'
          : 'border-cream-subtle bg-white text-ink hover:border-brand/40',
      )}
    >
      <span className="block text-xl font-semibold leading-snug">{primary}</span>
      {secondary && <span className="block text-sm text-ink-muted mt-0.5 font-mono">{secondary}</span>}
    </button>
  )
}

// ── Step 1: Chariot ───────────────────────────────────────────────────────────

function ChariotStep({ value, onChange, onNext, onBack }: {
  value: string; onChange: (v: string) => void; onNext: () => void; onBack?: () => void
}) {
  return (
    <StepChrome step={1} totalSteps={4} onBack={onBack} label="N° Chariot"
      sublabel="Numéro du chariot à contrôler"
      footer={<BigBtn onClick={onNext} disabled={!value.trim()}>Suivant →</BigBtn>}
    >
      <div className="flex flex-col items-center pt-6 gap-6">
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value.trim() && onNext()}
          placeholder="1"
          className="w-full max-w-sm text-center text-5xl font-black text-ink bg-white rounded-2xl
                     border-2 border-cream-subtle px-5 py-8 tracking-tighter
                     focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/20
                     placeholder:text-ink-muted/30"
        />
      </div>
    </StepChrome>
  )
}

// ── Step 2: Porte-Objets ──────────────────────────────────────────────────────

function PorteObjetStep({ value, onChange, onNext, onBack }: {
  value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void
}) {
  return (
    <StepChrome step={2} totalSteps={4} onBack={onBack} label="Nb Porte-Objets"
      sublabel="Combien de porte-objets sur ce chariot ?"
      footer={<BigBtn onClick={onNext} disabled={!value.trim()}>Suivant →</BigBtn>}
    >
      <div className="flex flex-col items-center pt-6 gap-6">
        <input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          type="number"
          min={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value.trim() && onNext()}
          placeholder="4"
          className="w-full max-w-sm text-center text-5xl font-black text-ink bg-white rounded-2xl
                     border-2 border-cream-subtle px-5 py-8 tracking-tighter
                     focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/20
                     placeholder:text-ink-muted/30"
        />
      </div>
    </StepChrome>
  )
}

// ── Step 3: Produit (client shown as context on each card) ───────────────────

function ProduitStep({ produits, clientById, selected, onPick, onBack }: {
  produits: ProduitRead[]
  clientById: Record<number, ClientRead>
  selected: number | null
  onPick: (id: number) => void
  onBack: () => void
}) {
  return (
    <StepChrome step={3} totalSteps={4} onBack={onBack} label="Référence article"
      sublabel={produits.length > 0 ? 'Appuyez pour sélectionner — avance automatiquement' : undefined}
    >
      {produits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-ink-muted">
          <p className="text-base font-medium">Aucun article configuré.</p>
          <p className="text-sm">Contactez l'administrateur pour associer des articles à un client.</p>
        </div>
      ) : (
        <div className="grid gap-3 pt-2 pb-8">
          {produits.map(p => {
            const clientNom = p.client_id != null ? (clientById[p.client_id]?.nom ?? '') : ''
            const secondary = [clientNom, p.libelle].filter(Boolean).join(' · ')
            return (
              <PickCard key={p.id} selected={selected === p.id}
                primary={p.reference} secondary={secondary} onClick={() => onPick(p.id)} />
            )
          })}
        </div>
      )}
    </StepChrome>
  )
}

// ── Step 5: Résultat ──────────────────────────────────────────────────────────

function ResultatStep({ value, onPick, onBack }: {
  value: 'OK' | 'NOK'; onPick: (v: 'OK' | 'NOK') => void; onBack: () => void
}) {
  return (
    <StepChrome step={4} totalSteps={4} onBack={onBack} label="Résultat du contrôle"
      sublabel="Un seul appui — avance automatiquement"
    >
      <div className="flex flex-col gap-4 pb-6" style={{ height: 'calc(100% - 0.5rem)' }}>
        <button
          onClick={() => onPick('OK')}
          className={cn(
            'flex-1 flex flex-col items-center justify-center rounded-2xl border-4 transition-all active:scale-[0.98]',
            value === 'OK' ? 'border-success bg-success/10' : 'border-cream-subtle bg-white',
          )}
        >
          <CheckCircle size={56} strokeWidth={1.5} className={value === 'OK' ? 'text-success' : 'text-ink-muted/40'} />
          <span className={cn('mt-3 text-6xl font-black', value === 'OK' ? 'text-success' : 'text-ink-muted/40')}>
            OK
          </span>
          <span className="text-ink-muted text-base mt-1">Chariot conforme</span>
        </button>

        <button
          onClick={() => onPick('NOK')}
          className={cn(
            'flex-1 flex flex-col items-center justify-center rounded-2xl border-4 transition-all active:scale-[0.98]',
            value === 'NOK' ? 'border-danger bg-danger/10' : 'border-cream-subtle bg-white',
          )}
        >
          <AlertTriangle size={56} strokeWidth={1.5} className={value === 'NOK' ? 'text-danger' : 'text-ink-muted/40'} />
          <span className={cn('mt-3 text-6xl font-black', value === 'NOK' ? 'text-danger' : 'text-ink-muted/40')}>
            NOK
          </span>
          <span className="text-ink-muted text-base mt-1">Non conforme — défauts détectés</span>
        </button>
      </div>
    </StepChrome>
  )
}

// ── Step 6: Défauts (NOK only) ────────────────────────────────────────────────

function DefautsStep({ symptomes, selectedIds, onToggle, commentaire, onCommentaire, onNext, onBack }: {
  symptomes: { id: number; libelle_fr: string }[]
  selectedIds: number[]; onToggle: (id: number) => void
  commentaire: string; onCommentaire: (v: string) => void
  onNext: () => void; onBack: () => void
}) {
  return (
    <StepChrome step={4} totalSteps={4} onBack={onBack} label="Défauts détectés"
      sublabel="Sélectionnez tous les défauts observés"
      footer={<BigBtn onClick={onNext}>Valider le contrôle →</BigBtn>}
    >
      <div className="space-y-3 pt-2 pb-4">
        {symptomes.map(s => {
          const active = selectedIds.includes(s.id)
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={cn(
                'w-full text-left px-5 py-5 rounded-xl border-2 transition-all active:scale-[0.98] text-xl font-semibold',
                active
                  ? 'border-danger bg-danger/10 text-danger'
                  : 'border-cream-subtle bg-white text-ink hover:border-danger/30',
              )}
            >
              <span className={cn('mr-3', active ? 'opacity-100' : 'opacity-0')}>✓</span>
              {s.libelle_fr}
            </button>
          )
        })}

        <div className="pt-3">
          <label className="block text-sm font-medium text-ink-heading mb-2">
            Commentaire <span className="text-ink-muted font-normal">(facultatif)</span>
          </label>
          <textarea
            value={commentaire}
            onChange={e => onCommentaire(e.target.value)}
            rows={3}
            className="w-full bg-white border border-cream-subtle rounded-xl px-4 py-3 text-base
                       text-ink resize-none focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            placeholder="Observation…"
          />
        </div>
      </div>
    </StepChrome>
  )
}

// ── Post-submit: Alerte ask ───────────────────────────────────────────────────

function AlerteAskScreen({ suivi, onAlerte, onNouveau }: {
  suivi: SuiviRead; onAlerte: () => void; onNouveau: () => void
}) {
  return (
    <div className="flex flex-col h-full px-5 py-5 gap-6">
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <CheckCircle size={72} strokeWidth={1} className="text-success" />
        <p className="text-2xl font-bold text-ink-heading text-center">Contrôle enregistré</p>
        <div className="bg-white rounded-2xl shadow-card px-8 py-6 text-center space-y-2 w-full max-w-xs">
          <p className="text-sm text-ink-muted uppercase tracking-wide">Chariot</p>
          <p className="text-5xl font-black font-mono text-ink tracking-tighter">{suivi.num_chariot}</p>
          <p className={cn('text-3xl font-black', suivi.resultat === 'NOK' ? 'text-danger' : 'text-success')}>
            {suivi.resultat}
          </p>
        </div>
      </div>
      <div className="space-y-3 shrink-0">
        <BigBtn variant="danger" onClick={onAlerte}>
          <Bell className="inline mr-2 -mt-0.5" size={22} strokeWidth={2} />
          ALERTER
        </BigBtn>
        <BigBtn variant="ghost" onClick={onNouveau}>Nouveau contrôle</BigBtn>
      </div>
    </div>
  )
}

// ── Post-submit: saved offline ────────────────────────────────────────────────

function SavedOfflineScreen({ onNouveau }: { onNouveau: () => void }) {
  return (
    <div className="flex flex-col h-full px-5 py-6 gap-6">
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <WifiOff size={64} strokeWidth={1} className="text-warning" />
        <p className="text-2xl font-bold text-ink-heading text-center">Enregistré hors ligne</p>
        <p className="text-ink-muted text-center max-w-xs">
          Le contrôle est sauvegardé localement et sera synchronisé à la reconnexion.
        </p>
        <div className="bg-danger/10 border-2 border-danger rounded-xl px-5 py-4 w-full max-w-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-danger text-center">
            {t('offline.banner')}
          </p>
        </div>
      </div>
      <BigBtn onClick={onNouveau}>Nouveau contrôle</BigBtn>
    </div>
  )
}

// ── Alerte: choose responsable ────────────────────────────────────────────────

function AlerteResponsableScreen({ methodes, selected, onPick, onBack }: {
  methodes: UtilisateurRead[]; selected: number | null; onPick: (id: number) => void; onBack: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
        <button
          onClick={onBack}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-card text-ink-muted active:scale-95"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ink-heading">Choisir le responsable</h1>
          <p className="text-ink-muted text-sm">Sélection = avance automatiquement</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-8">
        {methodes.map(u => (
          <PickCard key={u.id} selected={selected === u.id}
            primary={u.nom} secondary={u.telephone ?? undefined}
            onClick={() => onPick(u.id)} />
        ))}
        {methodes.length === 0 && (
          <p className="text-center text-ink-muted py-8">Aucun responsable méthode actif.</p>
        )}
      </div>
    </div>
  )
}

// ── Alerte: choose sévérité ───────────────────────────────────────────────────

function AlerteSeveriteScreen({ value, onPick, onBack, sending }: {
  value: 'normale' | 'urgente'; onPick: (v: 'normale' | 'urgente') => void
  onBack: () => void; sending: boolean
}) {
  return (
    <div className="flex flex-col h-full px-5">
      <div className="flex items-center gap-3 pt-5 pb-4 shrink-0">
        <button
          onClick={onBack}
          disabled={sending}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-card text-ink-muted active:scale-95 disabled:opacity-30"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ink-heading">Sévérité de l'alerte</h1>
          <p className="text-ink-muted text-sm">Sélection = envoie l'alerte immédiatement</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-1 pb-8">
        <button
          disabled={sending}
          onClick={() => onPick('normale')}
          className={cn(
            'flex-1 flex flex-col items-center justify-center rounded-2xl border-4 transition-all active:scale-[0.98] disabled:opacity-50',
            value === 'normale' ? 'border-brand bg-brand/5' : 'border-cream-subtle bg-white hover:border-brand/30',
          )}
        >
          <span className={cn('text-4xl font-black', value === 'normale' ? 'text-brand' : 'text-ink-muted/50')}>
            NORMALE
          </span>
          <span className="text-ink-muted mt-1 text-base">Intervention requise</span>
        </button>

        <button
          disabled={sending}
          onClick={() => onPick('urgente')}
          className={cn(
            'flex-1 flex flex-col items-center justify-center rounded-2xl border-4 transition-all active:scale-[0.98] disabled:opacity-50',
            value === 'urgente' ? 'border-danger bg-danger/10' : 'border-cream-subtle bg-white hover:border-danger/30',
          )}
        >
          <AlertTriangle size={40} strokeWidth={1.5} className={value === 'urgente' ? 'text-danger' : 'text-ink-muted/40'} />
          <span className={cn('text-4xl font-black mt-2', value === 'urgente' ? 'text-danger' : 'text-ink-muted/50')}>
            URGENTE
          </span>
          <span className="text-ink-muted mt-1 text-base">Arrêt de ligne imminent</span>
        </button>
      </div>

      {sending && (
        <div className="shrink-0 pb-6 text-center text-ink-muted text-sm animate-pulse">
          Envoi de l'alerte…
        </div>
      )}
    </div>
  )
}

// ── Pending ACK ───────────────────────────────────────────────────────────────

function Countdown({ createdAt, timeoutSecs = 120 }: { createdAt: string; timeoutSecs?: number }) {
  const [left, setLeft] = useState(() => {
    const elapsed = (Date.now() - parseServerDate(createdAt).getTime()) / 1000
    return Math.max(0, timeoutSecs - Math.floor(elapsed))
  })
  useEffect(() => {
    if (left <= 0) return
    const id = setInterval(() => setLeft(p => Math.max(0, p - 1)), 1000)
    return () => clearInterval(id)
  }, [left])
  const pct = (left / timeoutSecs) * 100
  const color = left > 60 ? 'bg-success' : left > 30 ? 'bg-warning' : 'bg-danger'
  const textColor = left > 60 ? 'text-success' : left > 30 ? 'text-warning' : 'text-danger'
  return (
    <div className="space-y-2 w-full max-w-xs text-center">
      <p className={cn('text-6xl font-black tabular-nums tracking-tighter', textColor)}>{left}s</p>
      <div className="h-3 overflow-hidden rounded-full bg-cream-subtle">
        <div className={cn('h-3 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-ink-muted text-sm">délai avant alerte manuelle</p>
    </div>
  )
}

function PendingScreen({ alerte, onAcked, onExpired, onNouveau }: {
  alerte: AlerteRead; onAcked: (a: AlerteRead) => void
  onExpired: (a: AlerteRead) => void; onNouveau: () => void
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
    <div className="flex flex-col h-full items-center justify-center gap-8 px-8">
      <Clock size={72} strokeWidth={1} className="text-brand animate-spin" style={{ animationDuration: '3s' }} />
      <p className="text-2xl font-bold text-ink-heading text-center">En attente d'acquittement</p>
      <p className="text-ink-muted text-center">
        Chariot <strong className="text-ink font-mono">{alerte.num_chariot}</strong> —&nbsp;
        <span className={alerte.severite === 'urgente' ? 'text-danger font-bold' : 'text-brand'}>
          {alerte.severite.toUpperCase()}
        </span>
      </p>
      <Countdown createdAt={alerte.created_at} />
      <div className="w-full max-w-xs pt-2">
        <BigBtn variant="secondary" onClick={onNouveau}>Nouveau contrôle</BigBtn>
      </div>
    </div>
  )
}

// ── Acked / expired ───────────────────────────────────────────────────────────

function AckedScreen({ onNouveau }: { onNouveau: () => void }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-6 px-8">
      <CheckCircle size={80} strokeWidth={1} className="text-success" />
      <p className="text-3xl font-black text-success text-center">Acquittée</p>
      <p className="text-ink-muted text-center">Le responsable méthode est intervenu.</p>
      <div className="w-full max-w-xs pt-4">
        <BigBtn variant="success" onClick={onNouveau}>Nouveau contrôle</BigBtn>
      </div>
    </div>
  )
}

function ExpiredScreen({ onNouveau }: { onNouveau: () => void }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-6 px-8">
      <AlertTriangle size={80} strokeWidth={1} className="text-danger" />
      <p className="text-3xl font-black text-danger text-center">Alerte expirée</p>
      <div className="bg-danger/10 border-2 border-danger rounded-xl px-5 py-4 w-full max-w-sm">
        <p className="text-sm font-bold uppercase tracking-wider text-danger text-center">
          {t('offline.banner')}
        </p>
      </div>
      <div className="w-full max-w-xs pt-2">
        <BigBtn onClick={onNouveau}>Nouveau contrôle</BigBtn>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function InspecteurPage() {
  const { online } = useConnectivity()

  // Reference data
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: api.clients.list })
  const { data: allProduits = [] } = useQuery({ queryKey: ['produits'], queryFn: api.produits.list })
  const { data: symptomes = [] } = useQuery({ queryKey: ['symptomes'], queryFn: api.symptomes.list })
  const { data: methodes = [] } = useQuery({ queryKey: ['responsables'], queryFn: api.responsables.list })

  // Wizard state
  const [step, setStep] = useState<Step>('chariot')
  const [, setHistory] = useState<Step[]>([])
  const [data, setData] = useState<WizardData>(INIT)
  const [suivi, setSuivi] = useState<SuiviRead | null>(null)
  const [alerte, setAlerte] = useState<AlerteRead | null>(null)
  const [responsableId, setResponsableId] = useState<number | null>(null)
  const [severite, setSeverite] = useState<'normale' | 'urgente'>('normale')
  const [alerteSending, setAlerteSending] = useState(false)

  // Derived
  const clientById: Record<number, ClientRead> = Object.fromEntries(clients.map(c => [c.id, c]))
  // Inspector picks the article directly; client is derived from the article's client_id
  const selectableProduits = allProduits.filter(p => p.actif && p.client_id != null)
  const activeSymptomes = symptomes.filter(s => s.actif)

  // Background sync
  useEffect(() => {
    if (!online) return
    void (async () => {
      const pending = await getPendingSuivis()
      if (!pending.length) return
      try {
        const synced = await api.suivis.sync(pending)
        await clearSyncedSuivis(synced.map(s => s.local_uuid))
      } catch { /* retry later */ }
    })()
  }, [online])

  // Navigation helpers
  const push = (next: Step) => {
    setHistory(h => [...h, step])
    setStep(next)
  }
  const back = () => {
    setHistory(h => { const prev = h[h.length - 1]; setStep(prev); return h.slice(0, -1) })
  }
  const reset = () => {
    setStep('chariot'); setHistory([]); setData(INIT)
    setSuivi(null); setAlerte(null); setResponsableId(null); setSeverite('normale')
  }

  // Submit suivi
  const submitSuivi = async (d: WizardData) => {
    const now = new Date()
    const local_uuid = crypto.randomUUID()
    const payload = {
      local_uuid,
      date: now.toISOString().slice(0, 10),
      heure: now.toISOString().slice(11, 19),
      num_chariot: d.num_chariot,
      num_porte_objet: d.num_porte_objet,
      client_id: d.client_id!,
      produit_id: d.produit_id!,
      resultat: d.resultat,
      commentaire_decision: d.commentaire || null,
      symptomes: activeSymptomes
        .filter(s => d.symptome_ids.includes(s.id))
        .map(s => ({ symptome_id: s.id, present: true })),
    }
    await queueSuivi(payload)
    const isOnline = await (async () => { try { await api.health(); return true } catch { return false } })()
    if (isOnline) {
      try {
        const s = await api.suivis.create(payload)
        await clearSyncedSuivis([local_uuid])
        setSuivi(s)
        // NOK → alerte is mandatory; skip the ask screen
        push(d.resultat === 'NOK' ? 'alerte_responsable' : 'alerte_ask')
        return
      } catch { /* fall through */ }
    }
    push('saved_offline')
  }

  // Submit alerte
  const submitAlerte = async (sev: 'normale' | 'urgente') => {
    if (!suivi || !responsableId) return
    setAlerteSending(true)
    try {
      const a = await api.alertes.create({
        local_uuid: crypto.randomUUID(),
        suivi_id: suivi.id,
        produit_id: suivi.produit_id,
        num_chariot: suivi.num_chariot,
        severite: sev,
        responsable_cible_id: responsableId,
      })
      setAlerte(a)
      push('pending')
    } catch {
      // connectivity failure → show fallback
      push('expired')
    } finally {
      setAlerteSending(false)
    }
  }

  // Produit selection: derive client_id from article, auto-advance
  const handleProduitPick = (produitId: number) => {
    const produit = allProduits.find(p => p.id === produitId)
    setData(d => ({ ...d, produit_id: produitId, client_id: produit?.client_id ?? null }))
    push('resultat')
  }

  // Résultat: OK → submit immediately; NOK → défauts step
  const handleResultatPick = (res: 'OK' | 'NOK') => {
    const updated = { ...data, resultat: res }
    setData(updated)
    if (res === 'OK') {
      void submitSuivi(updated)
      push('submitting')
    } else {
      push('defauts')
    }
  }

  // Responsable: auto-advance to sévérité
  const handleResponsablePick = (id: number) => {
    setResponsableId(id)
    push('alerte_severite')
  }

  // Sévérité: tap = immediate send
  const handleSeveritePick = async (sev: 'normale' | 'urgente') => {
    setSeverite(sev)
    await submitAlerte(sev)
  }

  // Toggle symptôme
  const toggleSymptome = (id: number) => {
    setData(d => ({
      ...d,
      symptome_ids: d.symptome_ids.includes(id)
        ? d.symptome_ids.filter(x => x !== id)
        : [...d.symptome_ids, id],
    }))
  }

  return (
    <InspecteurLayout>
      {step === 'chariot' && (
        <ChariotStep
          value={data.num_chariot}
          onChange={v => setData(d => ({ ...d, num_chariot: v }))}
          onNext={() => push('porte_objet')}
        />
      )}

      {step === 'porte_objet' && (
        <PorteObjetStep
          value={data.num_porte_objet}
          onChange={v => setData(d => ({ ...d, num_porte_objet: v }))}
          onNext={() => push('produit')}
          onBack={back}
        />
      )}

      {step === 'produit' && (
        <ProduitStep
          produits={selectableProduits}
          clientById={clientById}
          selected={data.produit_id}
          onPick={handleProduitPick}
          onBack={back}
        />
      )}

      {step === 'resultat' && (
        <ResultatStep value={data.resultat} onPick={handleResultatPick} onBack={back} />
      )}

      {step === 'defauts' && (
        <DefautsStep
          symptomes={activeSymptomes}
          selectedIds={data.symptome_ids}
          onToggle={toggleSymptome}
          commentaire={data.commentaire}
          onCommentaire={v => setData(d => ({ ...d, commentaire: v }))}
          onNext={() => { push('submitting'); void submitSuivi(data) }}
          onBack={back}
        />
      )}

      {step === 'submitting' && (
        <div className="flex flex-col h-full items-center justify-center gap-4 text-ink-muted">
          <Clock size={48} strokeWidth={1} className="animate-spin text-brand" style={{ animationDuration: '1.5s' }} />
          <p className="text-lg font-medium">Enregistrement…</p>
        </div>
      )}

      {step === 'saved_offline' && <SavedOfflineScreen onNouveau={reset} />}

      {step === 'alerte_ask' && suivi && (
        <AlerteAskScreen suivi={suivi} onAlerte={() => push('alerte_responsable')} onNouveau={reset} />
      )}

      {step === 'alerte_responsable' && (
        <AlerteResponsableScreen
          methodes={methodes} selected={responsableId}
          onPick={handleResponsablePick} onBack={back}
        />
      )}

      {step === 'alerte_severite' && (
        <AlerteSeveriteScreen
          value={severite} onPick={handleSeveritePick} onBack={back} sending={alerteSending}
        />
      )}

      {step === 'pending' && alerte && (
        <PendingScreen
          alerte={alerte}
          onAcked={a => { setAlerte(a); push('acked') }}
          onExpired={a => { setAlerte(a); push('expired') }}
          onNouveau={reset}
        />
      )}

      {step === 'acked' && <AckedScreen onNouveau={reset} />}
      {step === 'expired' && <ExpiredScreen onNouveau={reset} />}
    </InspecteurLayout>
  )
}
