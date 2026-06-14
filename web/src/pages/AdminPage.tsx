import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { UtilisateurRead, ClientRead, ProduitRead, SymptomeRead } from '../lib/api'

// ── Generic helpers ───────────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
      {active ? 'actif' : 'inactif'}
    </span>
  )
}

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      <button onClick={onAdd} className="btn-primary text-sm px-3 py-1 rounded">+ Ajouter</button>
    </div>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md mx-4 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

const inputCls = 'w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary'
const selectCls = inputCls

// ── Utilisateurs ─────────────────────────────────────────────────────────────

type UserForm = { nom: string; role: string; secret: string; telephone: string; actif: boolean }
const ROLES = ['inspecteur', 'methode', 'qualite', 'prod', 'admin']

function UserModal({ initial, onClose, onSave }: {
  initial?: UtilisateurRead
  onClose: () => void
  onSave: (f: UserForm) => void
}) {
  const [f, setF] = useState<UserForm>({
    nom: initial?.nom ?? '',
    role: initial?.role ?? 'inspecteur',
    secret: '',
    telephone: initial?.telephone ?? '',
    actif: initial?.actif ?? true,
  })
  return (
    <Modal title={initial ? 'Modifier utilisateur' : 'Nouvel utilisateur'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Identifiant">
          <input className={inputCls} value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} />
        </Field>
        <Field label="Rôle">
          <select className={selectCls} value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={initial ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'}>
          <input className={inputCls} type="password" value={f.secret} onChange={e => setF({ ...f, secret: e.target.value })} />
        </Field>
        <Field label="Téléphone">
          <input className={inputCls} value={f.telephone} onChange={e => setF({ ...f, telephone: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} />
          Actif
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-3 py-1.5 border rounded">Annuler</button>
        <button onClick={() => onSave(f)} disabled={!f.nom || (!initial && !f.secret)} className="btn-primary text-sm px-3 py-1.5 rounded disabled:opacity-40">
          Enregistrer
        </button>
      </div>
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
    <section>
      <SectionHeader title="Utilisateurs" onAdd={() => setEditing('new')} />
      {isLoading ? <p className="text-sm text-muted">Chargement…</p> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary text-primary-foreground text-xs uppercase">
              <tr>
                <th className="px-3 py-2">Identifiant</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2">Téléphone</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                  <td className="px-3 py-2 font-medium">{r.nom}</td>
                  <td className="px-3 py-2">{r.role}</td>
                  <td className="px-3 py-2 text-muted">{r.telephone ?? '—'}</td>
                  <td className="px-3 py-2"><Badge active={r.actif} /></td>
                  <td className="px-3 py-2 flex gap-2 justify-end">
                    <button onClick={() => setEditing(r)} className="text-xs text-primary hover:underline">Modifier</button>
                    <button onClick={() => { if (confirm(`Supprimer ${r.nom} ?`)) deleteMut.mutate(r.id) }} className="text-xs text-red-600 hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && (
        <UserModal onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />
      )}
      {editing && editing !== 'new' && (
        <UserModal initial={editing} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as UtilisateurRead).id, f })} />
      )}
    </section>
  )
}

// ── Clients ───────────────────────────────────────────────────────────────────

type ClientForm = { code: string; nom: string; actif: boolean }

function ClientModal({ initial, onClose, onSave }: { initial?: ClientRead; onClose: () => void; onSave: (f: ClientForm) => void }) {
  const [f, setF] = useState<ClientForm>({ code: initial?.code ?? '', nom: initial?.nom ?? '', actif: initial?.actif ?? true })
  return (
    <Modal title={initial ? 'Modifier client' : 'Nouveau client'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Code"><input className={inputCls} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Nom"><input className={inputCls} value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} />Actif</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-3 py-1.5 border rounded">Annuler</button>
        <button onClick={() => onSave(f)} disabled={!f.code || !f.nom} className="btn-primary text-sm px-3 py-1.5 rounded disabled:opacity-40">Enregistrer</button>
      </div>
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
    <section>
      <SectionHeader title="Clients" onAdd={() => setEditing('new')} />
      {isLoading ? <p className="text-sm text-muted">Chargement…</p> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary text-primary-foreground text-xs uppercase">
              <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">{r.nom}</td>
                  <td className="px-3 py-2"><Badge active={r.actif} /></td>
                  <td className="px-3 py-2 flex gap-2 justify-end">
                    <button onClick={() => setEditing(r)} className="text-xs text-primary hover:underline">Modifier</button>
                    <button onClick={() => { if (confirm(`Supprimer ${r.nom} ?`)) deleteMut.mutate(r.id) }} className="text-xs text-red-600 hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <ClientModal onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />}
      {editing && editing !== 'new' && <ClientModal initial={editing as ClientRead} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as ClientRead).id, f })} />}
    </section>
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
  return (
    <Modal title={initial ? 'Modifier produit' : 'Nouveau produit'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Référence"><input className={inputCls} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Libellé"><input className={inputCls} value={f.libelle} onChange={e => setF({ ...f, libelle: e.target.value })} /></Field>
        <Field label="Client">
          <select className={selectCls} value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })}>
            <option value="">— Aucun —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Type traitement">
          <select className={selectCls} value={f.type_traitement} onChange={e => setF({ ...f, type_traitement: e.target.value })}>
            {TRAITEMENTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} />Actif</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-3 py-1.5 border rounded">Annuler</button>
        <button onClick={() => onSave(f)} disabled={!f.reference || !f.libelle} className="btn-primary text-sm px-3 py-1.5 rounded disabled:opacity-40">Enregistrer</button>
      </div>
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
    <section>
      <SectionHeader title="Produits / Références" onAdd={() => setEditing('new')} />
      {isLoading ? <p className="text-sm text-muted">Chargement…</p> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary text-primary-foreground text-xs uppercase">
              <tr><th className="px-3 py-2">Référence</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Traitement</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                  <td className="px-3 py-2 font-mono text-xs">{r.reference}</td>
                  <td className="px-3 py-2">{r.libelle}</td>
                  <td className="px-3 py-2 text-muted">{r.client_id ? clientMap[r.client_id] ?? '—' : '—'}</td>
                  <td className="px-3 py-2 text-xs">{r.type_traitement}</td>
                  <td className="px-3 py-2"><Badge active={r.actif} /></td>
                  <td className="px-3 py-2 flex gap-2 justify-end">
                    <button onClick={() => setEditing(r)} className="text-xs text-primary hover:underline">Modifier</button>
                    <button onClick={() => { if (confirm(`Supprimer ${r.reference} ?`)) deleteMut.mutate(r.id) }} className="text-xs text-red-600 hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <ProduitModal clients={clients} onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />}
      {editing && editing !== 'new' && <ProduitModal initial={editing as ProduitRead} clients={clients} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as ProduitRead).id, f })} />}
    </section>
  )
}

// ── Symptômes ─────────────────────────────────────────────────────────────────

type SymptomeForm = { code: string; libelle_fr: string; libelle_ar: string; ordre: string; actif: boolean }

function SymptomeModal({ initial, onClose, onSave }: { initial?: SymptomeRead; onClose: () => void; onSave: (f: SymptomeForm) => void }) {
  const [f, setF] = useState<SymptomeForm>({
    code: initial?.code ?? '', libelle_fr: initial?.libelle_fr ?? '',
    libelle_ar: initial?.libelle_ar ?? '', ordre: String(initial?.ordre ?? 0), actif: initial?.actif ?? true,
  })
  return (
    <Modal title={initial ? 'Modifier précurseur' : 'Nouveau précurseur'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Code"><input className={inputCls} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Libellé (FR)"><input className={inputCls} value={f.libelle_fr} onChange={e => setF({ ...f, libelle_fr: e.target.value })} /></Field>
        <Field label="Libellé (AR)"><input className={inputCls} value={f.libelle_ar} onChange={e => setF({ ...f, libelle_ar: e.target.value })} /></Field>
        <Field label="Ordre"><input className={inputCls} type="number" value={f.ordre} onChange={e => setF({ ...f, ordre: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.actif} onChange={e => setF({ ...f, actif: e.target.checked })} />Actif</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-3 py-1.5 border rounded">Annuler</button>
        <button onClick={() => onSave(f)} disabled={!f.code || !f.libelle_fr} className="btn-primary text-sm px-3 py-1.5 rounded disabled:opacity-40">Enregistrer</button>
      </div>
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
    <section>
      <SectionHeader title="Catalogue précurseurs" onAdd={() => setEditing('new')} />
      {isLoading ? <p className="text-sm text-muted">Chargement…</p> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary text-primary-foreground text-xs uppercase">
              <tr><th className="px-3 py-2">Ord.</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Libellé FR</th><th className="px-3 py-2">Libellé AR</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                  <td className="px-3 py-2 text-muted text-xs">{r.ordre}</td>
                  <td className="px-3 py-2 font-mono text-xs font-bold">{r.code}</td>
                  <td className="px-3 py-2">{r.libelle_fr}</td>
                  <td className="px-3 py-2 text-muted">{r.libelle_ar ?? '—'}</td>
                  <td className="px-3 py-2"><Badge active={r.actif} /></td>
                  <td className="px-3 py-2 flex gap-2 justify-end">
                    <button onClick={() => setEditing(r)} className="text-xs text-primary hover:underline">Modifier</button>
                    <button onClick={() => { if (confirm(`Supprimer ${r.code} ?`)) deleteMut.mutate(r.id) }} className="text-xs text-red-600 hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <SymptomeModal onClose={() => setEditing(null)} onSave={f => createMut.mutate(f)} />}
      {editing && editing !== 'new' && <SymptomeModal initial={editing as SymptomeRead} onClose={() => setEditing(null)} onSave={f => updateMut.mutate({ id: (editing as SymptomeRead).id, f })} />}
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ['Utilisateurs', 'Clients', 'Produits', 'Précurseurs'] as const
type Tab = typeof TABS[number]

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('Utilisateurs')
  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-primary">Administration</h1>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === 'Utilisateurs' && <UtilisateursSection />}
        {tab === 'Clients' && <ClientsSection />}
        {tab === 'Produits' && <ProduitsSection />}
        {tab === 'Précurseurs' && <SymptomesSection />}
      </div>
    </div>
  )
}
