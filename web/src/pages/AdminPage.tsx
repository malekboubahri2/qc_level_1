import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Building2, Package, AlertTriangle, Plus } from 'lucide-react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import type { UtilisateurRead, ClientRead, ProduitRead, SymptomeRead } from '../lib/api'

// ── Primitives ────────────────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
      <span className="w-1.5 h-1.5 rounded-full bg-success" />
      actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-ink-muted/10 text-ink-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-muted" />
      inactif
    </span>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-ink-muted">
      <Icon size={24} strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-fade-in-up">
      <div className="bg-white rounded-lg shadow-popover w-full max-w-md mx-4 p-6 space-y-5 animate-scale-in">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors text-xl leading-none w-7 h-7 flex items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputCls =
  'w-full bg-white border border-cream-subtle rounded-lg px-4 py-3.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors'
const selectCls = inputCls

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-base font-medium text-ink-heading">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}

function ModalActions({ onClose, disabled }: { onClose: () => void; disabled: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <button
        onClick={onClose}
        className="px-5 py-3 text-base font-semibold border border-brand text-brand rounded-lg hover:bg-brand/5 transition-colors"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="px-5 py-3 text-base font-semibold bg-brand hover:bg-brand-dark text-cream rounded-lg transition-colors disabled:opacity-40"
      >
        Enregistrer
      </button>
    </div>
  )
}

// ── Table shell ───────────────────────────────────────────────────────────────

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-cream-subtle border-b border-cream-subtle">
        {cols.map(c => (
          <th key={c} className="px-4 py-4 text-left text-sm font-medium uppercase tracking-wide text-ink-muted">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function TableRow({ children, i }: { children: React.ReactNode; i: number }) {
  return (
    <tr className={`border-b border-cream-subtle last:border-0 hover:bg-cream-subtle/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-cream/30'}`}>
      {children}
    </tr>
  )
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-4 text-base ${mono ? 'font-mono text-sm' : ''}`}>{children}</td>
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-4 py-4">
      <div className="flex gap-4 justify-end">
        <button onClick={onEdit} className="text-sm font-medium text-brand hover:underline transition-colors">
          Modifier
        </button>
        <button onClick={onDelete} className="text-sm font-medium text-danger hover:underline transition-colors">
          Supprimer
        </button>
      </div>
    </td>
  )
}

function SectionCard({ title, icon: Icon, onAdd, children }: {
  title: string; icon: React.ElementType; onAdd: () => void; children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-lg shadow-card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-cream-subtle">
        <div className="flex items-center gap-2">
          <Icon size={20} strokeWidth={1.5} className="text-brand" />
          <h2 className="text-lg font-semibold text-ink-heading">{title}</h2>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 text-base font-semibold bg-brand hover:bg-brand-dark text-cream rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          Ajouter
        </button>
      </div>
      {children}
    </section>
  )
}

// ── Utilisateurs ─────────────────────────────────────────────────────────────

type UserForm = { nom: string; role: string; secret: string; telephone: string; actif: boolean }
const ROLES = ['inspecteur', 'methode', 'qualite', 'prod', 'admin']

function UserModal({ initial, onClose, onSave }: { initial?: UtilisateurRead; onClose: () => void; onSave: (f: UserForm) => void }) {
  const [f, setF] = useState<UserForm>({
    nom: initial?.nom ?? '', role: initial?.role ?? 'inspecteur',
    secret: '', telephone: initial?.telephone ?? '', actif: initial?.actif ?? true,
  })
  const valid = !!f.nom && (!!initial || !!f.secret)
  return (
    <Modal title={initial ? 'Modifier utilisateur' : 'Nouvel utilisateur'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (valid) onSave(f) }} className="space-y-4">
        <Field label="Identifiant" required>
          <input className={inputCls} value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} />
        </Field>
        <Field label="Rôle" required>
          <select className={selectCls} value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={initial ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'} required={!initial}>
          <input className={inputCls} type="password" value={f.secret} onChange={e => setF({ ...f, secret: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <input className={inputCls} value={f.telephone} onChange={e => setF({ ...f, telephone: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} className="accent-brand" />
          Actif
        </label>
        <ModalActions onClose={onClose} disabled={!valid} />
      </form>
    </Modal>
  )
}

function UtilisateursSection() {
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['admin.utilisateurs'], queryFn: () => api.utilisateurs.list() })
  const [editing, setEditing] = useState<UtilisateurRead | null | 'new'>(null)
  const createMut = useMutation({
    mutationFn: (f: UserForm) => api.utilisateurs.create({ nom: f.nom, role: f.role, secret: f.secret, telephone: f.telephone || undefined, actif: f.actif }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.utilisateurs'] }); setEditing(null) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: number; f: UserForm }) => api.utilisateurs.update(id, { nom: f.nom, role: f.role, ...(f.secret ? { secret: f.secret } : {}), telephone: f.telephone || undefined, actif: f.actif }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.utilisateurs'] }); setEditing(null) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.utilisateurs.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin.utilisateurs'] }),
  })
  return (
    <SectionCard title="Utilisateurs" icon={Users} onAdd={() => setEditing('new')}>
      {isLoading ? (
        <div className="px-6 py-8"><div className="h-4 bg-cream-subtle rounded animate-pulse w-48" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} message="Aucun utilisateur — cliquez Ajouter pour en créer un." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHeader cols={['Identifiant', 'Rôle', 'Téléphone', 'Statut', '']} />
            <tbody>
              {rows.map((r, i) => (
                <TableRow key={r.id} i={i}>
                  <Td><span className="font-medium">{r.nom}</span></Td>
                  <Td><span className="font-mono text-xs bg-cream-subtle px-2 py-0.5 rounded">{r.role}</span></Td>
                  <Td><span className="text-ink-muted">{r.telephone ?? '—'}</span></Td>
                  <Td><Badge active={r.actif} /></Td>
                  <Actions onEdit={() => setEditing(r)} onDelete={() => { if (confirm(`Supprimer ${r.nom} ?`)) deleteMut.mutate(r.id) }} />
                </TableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <UserModal onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />}
      {editing && editing !== 'new' && <UserModal initial={editing as UtilisateurRead} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as UtilisateurRead).id, f })} />}
    </SectionCard>
  )
}

// ── Clients ───────────────────────────────────────────────────────────────────

type ClientForm = { code: string; nom: string; actif: boolean }

function ClientModal({ initial, onClose, onSave }: { initial?: ClientRead; onClose: () => void; onSave: (f: ClientForm) => void }) {
  const [f, setF] = useState<ClientForm>({ code: initial?.code ?? '', nom: initial?.nom ?? '', actif: initial?.actif ?? true })
  const valid = !!f.code && !!f.nom
  return (
    <Modal title={initial ? 'Modifier client' : 'Nouveau client'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (valid) onSave(f) }} className="space-y-4">
        <Field label="Code" required><input className={inputCls} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Nom" required><input className={inputCls} value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer"><input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} className="accent-brand" />Actif</label>
        <ModalActions onClose={onClose} disabled={!valid} />
      </form>
    </Modal>
  )
}

function ClientsSection() {
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['admin.clients'], queryFn: () => api.clients.list() })
  const [editing, setEditing] = useState<ClientRead | null | 'new'>(null)
  const createMut = useMutation({ mutationFn: (f: ClientForm) => api.clients.create(f), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.clients'] }); setEditing(null) } })
  const updateMut = useMutation({ mutationFn: ({ id, f }: { id: number; f: ClientForm }) => api.clients.update(id, f), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.clients'] }); setEditing(null) } })
  const deleteMut = useMutation({ mutationFn: (id: number) => api.clients.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin.clients'] }) })
  return (
    <SectionCard title="Clients" icon={Building2} onAdd={() => setEditing('new')}>
      {isLoading ? (
        <div className="px-6 py-8"><div className="h-4 bg-cream-subtle rounded animate-pulse w-48" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} message="Aucun client — ajoutez-en un pour commencer." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHeader cols={['Code', 'Nom', 'Statut', '']} />
            <tbody>
              {rows.map((r, i) => (
                <TableRow key={r.id} i={i}>
                  <Td mono>{r.code}</Td>
                  <Td><span className="font-medium">{r.nom}</span></Td>
                  <Td><Badge active={r.actif} /></Td>
                  <Actions onEdit={() => setEditing(r)} onDelete={() => { if (confirm(`Supprimer ${r.nom} ?`)) deleteMut.mutate(r.id) }} />
                </TableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <ClientModal onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />}
      {editing && editing !== 'new' && <ClientModal initial={editing as ClientRead} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as ClientRead).id, f })} />}
    </SectionCard>
  )
}

// ── Produits ──────────────────────────────────────────────────────────────────

type ProduitForm = { reference: string; libelle: string; client_id: string; type_traitement: string; actif: boolean }
const TRAITEMENTS = ['peinture', 'metallisation', 'les_deux']

function ProduitModal({ initial, clients, onClose, onSave }: { initial?: ProduitRead; clients: ClientRead[]; onClose: () => void; onSave: (f: ProduitForm) => void }) {
  const [f, setF] = useState<ProduitForm>({
    reference: initial?.reference ?? '', libelle: initial?.libelle ?? '',
    client_id: initial?.client_id != null ? String(initial.client_id) : '',
    type_traitement: initial?.type_traitement ?? 'peinture', actif: initial?.actif ?? true,
  })
  const valid = !!f.reference && !!f.libelle
  return (
    <Modal title={initial ? 'Modifier produit' : 'Nouveau produit'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (valid) onSave(f) }} className="space-y-4">
        <Field label="Référence" required><input className={inputCls} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Libellé" required><input className={inputCls} value={f.libelle} onChange={e => setF({ ...f, libelle: e.target.value })} /></Field>
        <Field label="Client">
          <select className={selectCls} value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })}>
            <option value="">— Aucun —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Type de traitement" required>
          <select className={selectCls} value={f.type_traitement} onChange={e => setF({ ...f, type_traitement: e.target.value })}>
            {TRAITEMENTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer"><input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} className="accent-brand" />Actif</label>
        <ModalActions onClose={onClose} disabled={!valid} />
      </form>
    </Modal>
  )
}

function ProduitsSection() {
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['admin.produits'], queryFn: () => api.produits.list() })
  const { data: clients = [] } = useQuery({ queryKey: ['admin.clients'], queryFn: () => api.clients.list() })
  const [editing, setEditing] = useState<ProduitRead | null | 'new'>(null)
  const toBody = (f: ProduitForm) => ({ reference: f.reference, libelle: f.libelle, client_id: f.client_id ? Number(f.client_id) : null, type_traitement: f.type_traitement, actif: f.actif })
  const createMut = useMutation({ mutationFn: (f: ProduitForm) => api.produits.create(toBody(f)), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.produits'] }); setEditing(null) } })
  const updateMut = useMutation({ mutationFn: ({ id, f }: { id: number; f: ProduitForm }) => api.produits.update(id, toBody(f)), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.produits'] }); setEditing(null) } })
  const deleteMut = useMutation({ mutationFn: (id: number) => api.produits.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin.produits'] }) })
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.nom]))
  return (
    <SectionCard title="Produits / Références" icon={Package} onAdd={() => setEditing('new')}>
      {isLoading ? (
        <div className="px-6 py-8"><div className="h-4 bg-cream-subtle rounded animate-pulse w-48" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Package} message="Aucune référence produit — ajoutez-en une pour commencer." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHeader cols={['Référence', 'Libellé', 'Client', 'Traitement', 'Statut', '']} />
            <tbody>
              {rows.map((r, i) => (
                <TableRow key={r.id} i={i}>
                  <Td mono>{r.reference}</Td>
                  <Td><span className="font-medium">{r.libelle}</span></Td>
                  <Td><span className="text-ink-muted">{r.client_id ? clientMap[r.client_id] ?? '—' : '—'}</span></Td>
                  <Td><span className="font-mono text-xs bg-cream-subtle px-2 py-0.5 rounded">{r.type_traitement}</span></Td>
                  <Td><Badge active={r.actif} /></Td>
                  <Actions onEdit={() => setEditing(r)} onDelete={() => { if (confirm(`Supprimer ${r.reference} ?`)) deleteMut.mutate(r.id) }} />
                </TableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <ProduitModal clients={clients} onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />}
      {editing && editing !== 'new' && <ProduitModal initial={editing as ProduitRead} clients={clients} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as ProduitRead).id, f })} />}
    </SectionCard>
  )
}

// ── Symptômes ─────────────────────────────────────────────────────────────────

type SymptomeForm = { code: string; libelle_fr: string; libelle_ar: string; ordre: string; actif: boolean }

function SymptomeModal({ initial, onClose, onSave }: { initial?: SymptomeRead; onClose: () => void; onSave: (f: SymptomeForm) => void }) {
  const [f, setF] = useState<SymptomeForm>({ code: initial?.code ?? '', libelle_fr: initial?.libelle_fr ?? '', libelle_ar: initial?.libelle_ar ?? '', ordre: String(initial?.ordre ?? 0), actif: initial?.actif ?? true })
  const valid = !!f.code && !!f.libelle_fr
  return (
    <Modal title={initial ? 'Modifier précurseur' : 'Nouveau précurseur'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (valid) onSave(f) }} className="space-y-4">
        <Field label="Code" required><input className={inputCls} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Libellé (FR)" required><input className={inputCls} value={f.libelle_fr} onChange={e => setF({ ...f, libelle_fr: e.target.value })} /></Field>
        <Field label="Libellé (AR)"><input className={inputCls} value={f.libelle_ar} onChange={e => setF({ ...f, libelle_ar: e.target.value })} /></Field>
        <Field label="Ordre"><input className={inputCls} type="number" value={f.ordre} onChange={e => setF({ ...f, ordre: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer"><input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} className="accent-brand" />Actif</label>
        <ModalActions onClose={onClose} disabled={!valid} />
      </form>
    </Modal>
  )
}

function SymptomesSection() {
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['admin.symptomes'], queryFn: () => api.symptomes.list() })
  const [editing, setEditing] = useState<SymptomeRead | null | 'new'>(null)
  const toBody = (f: SymptomeForm) => ({ code: f.code, libelle_fr: f.libelle_fr, libelle_ar: f.libelle_ar || undefined, ordre: Number(f.ordre), actif: f.actif })
  const createMut = useMutation({ mutationFn: (f: SymptomeForm) => api.symptomes.create(toBody(f)), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.symptomes'] }); setEditing(null) } })
  const updateMut = useMutation({ mutationFn: ({ id, f }: { id: number; f: SymptomeForm }) => api.symptomes.update(id, toBody(f)), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin.symptomes'] }); setEditing(null) } })
  const deleteMut = useMutation({ mutationFn: (id: number) => api.symptomes.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin.symptomes'] }) })
  return (
    <SectionCard title="Catalogue précurseurs" icon={AlertTriangle} onAdd={() => setEditing('new')}>
      {isLoading ? (
        <div className="px-6 py-8"><div className="h-4 bg-cream-subtle rounded animate-pulse w-48" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} message="Aucun précurseur dans le catalogue — les 5 précurseurs SVI-COQ-03 sont normalement pré-chargés." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHeader cols={['Ord.', 'Code', 'Libellé FR', 'Libellé AR', 'Statut', '']} />
            <tbody>
              {rows.map((r, i) => (
                <TableRow key={r.id} i={i}>
                  <Td><span className="text-ink-muted">{r.ordre}</span></Td>
                  <Td><span className="font-mono text-xs font-bold text-ink-heading">{r.code}</span></Td>
                  <Td><span className="font-medium">{r.libelle_fr}</span></Td>
                  <Td><span className="text-ink-muted">{r.libelle_ar ?? '—'}</span></Td>
                  <Td><Badge active={r.actif} /></Td>
                  <Actions onEdit={() => setEditing(r)} onDelete={() => { if (confirm(`Supprimer ${r.code} ?`)) deleteMut.mutate(r.id) }} />
                </TableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <SymptomeModal onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />}
      {editing && editing !== 'new' && <SymptomeModal initial={editing as SymptomeRead} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as SymptomeRead).id, f })} />}
    </SectionCard>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'utilisateurs', label: 'Utilisateurs', icon: Users },
  { id: 'clients',      label: 'Clients',       icon: Building2 },
  { id: 'produits',     label: 'Produits',       icon: Package },
  { id: 'precurseurs',  label: 'Précurseurs',    icon: AlertTriangle },
] as const

type TabId = typeof TABS[number]['id']

export function AdminPage() {
  const [tab, setTab] = useState<TabId>('utilisateurs')
  return (
    <AppLayout title={t('page.admin')}>
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-ink-heading">Administration</h1>

      <div className="flex gap-1 border-b border-cream-subtle">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'utilisateurs' && <UtilisateursSection />}
        {tab === 'clients'      && <ClientsSection />}
        {tab === 'produits'     && <ProduitsSection />}
        {tab === 'precurseurs'  && <SymptomesSection />}
      </div>
    </div>
    </AppLayout>
  )
}
