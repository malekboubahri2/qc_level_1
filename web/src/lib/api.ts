/* Thin API client. Base path is /api/v1 — proxied to the backend by Vite in dev
   and by Caddy in prod, so no backend host is ever hardcoded (principles §2). */

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'

const ACCESS_KEY = 'qc.access'
const REFRESH_KEY = 'qc.refresh'

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && tokenStore.access) headers['Authorization'] = `Bearer ${tokenStore.access}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = await res.json()
      if (typeof data?.detail === 'string') detail = data.detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ── Domain types ────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Me {
  id: number
  nom: string
  role: 'inspecteur' | 'methode' | 'qualite' | 'prod' | 'admin'
}

export interface UtilisateurRead {
  id: number
  nom: string
  role: 'inspecteur' | 'methode' | 'qualite' | 'prod' | 'admin'
  telephone: string | null
  actif: boolean
}

export interface ClientRead {
  id: number
  code: string
  nom: string
  actif: boolean
}

export interface ProduitRead {
  id: number
  reference: string
  libelle: string
  client_id: number | null
  type_traitement: 'peinture' | 'metallisation' | 'les_deux'
  actif: boolean
}

export interface SymptomeRead {
  id: number
  code: string
  libelle_fr: string
  libelle_ar: string | null
  famille: string
  ordre: number
  actif: boolean
}

export interface SuiviSymptomePayload {
  symptome_id: number
  present: boolean
  note?: string | null
}

export interface SuiviCreate {
  local_uuid: string
  date: string
  heure: string
  num_chariot: string
  num_porte_objet: string
  client_id: number
  produit_id: number
  resultat: 'OK' | 'NOK'
  commentaire_decision?: string | null
  symptomes: SuiviSymptomePayload[]
}

export interface SuiviSymptomeRead {
  id: number
  symptome_id: number
  present: boolean
  note: string | null
}

export interface SuiviRead {
  id: number
  local_uuid: string
  date: string
  heure: string
  num_chariot: string
  num_porte_objet: string
  client_id: number
  produit_id: number
  resultat: 'OK' | 'NOK'
  commentaire_decision: string | null
  inspecteur_id: number
  niveau3_ref: string | null
  created_at: string
  updated_at: string
  symptomes: SuiviSymptomeRead[]
  visas: VisaRead[]
  action_methode: string | null
  client_nom: string | null
  produit_reference: string | null
  produit_libelle: string | null
  inspecteur_nom: string | null
}

export interface AlerteCreate {
  local_uuid: string
  suivi_id: number
  produit_id: number
  num_chariot: string
  severite: 'normale' | 'urgente'
  responsable_cible_id: number
}

export type StatutAlerte = 'ouverte' | 'acquittee' | 'cloturee' | 'expiree'

export interface AlerteRead {
  id: number
  local_uuid: string
  suivi_id: number
  produit_id: number
  num_chariot: string
  severite: 'normale' | 'urgente'
  demandeur_id: number
  responsable_cible_id: number
  statut: StatutAlerte
  acknowledged_at: string | null
  acknowledged_by: number | null
  closed_at: string | null
  decision_id: number | null
  created_at: string
  updated_at: string
  action_text: string | null
  resultat_text: string | null
}

export interface VisaRead {
  id: number
  suivi_id: number
  type: 'qualite' | 'prod' | 'methode'
  utilisateur_id: number
  signed_at: string
}

export interface DecisionCreate {
  action_text: string
  resultat_text?: string | null
}

export interface DecisionRead {
  id: number
  alerte_id: number
  suivi_id: number
  responsable_id: number
  action_text: string
  resultat_text: string | null
  decided_at: string
}

// ── Phase 2 types ────────────────────────────────────────────────────────────

export interface TauxNcRow {
  date: string
  total: number
  nok: number
  taux: number
}

export interface PrecurseurRow {
  code: string
  libelle_fr: string
  count: number
}

export interface TempsReponseRow {
  alerte_id: number
  severite: 'normale' | 'urgente'
  duree_secondes: number
  created_at: string
}

// ── SSE event payloads ───────────────────────────────────────────────────────

export type SseEvent =
  | { type: 'alerte.created'; data: AlerteRead & { created_at: string } }
  | { type: 'alerte.acknowledged'; data: { id: number; acknowledged_at: string; acknowledged_by: number; responsable_cible_id: number } }
  | { type: 'alerte.closed'; data: { id: number; closed_at: string; decision_id: number } }
  | { type: 'alerte.expired'; data: { id: number; num_chariot: string; responsable_cible_id: number } }

// ── API surface ──────────────────────────────────────────────────────────────

export const api = {
  health: () => request<{ status: string }>('/health', { auth: false }),
  login: (nom: string, secret: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { nom, secret },
      auth: false,
    }),
  me: () => request<Me>('/auth/me'),

  responsables: {
    list: () => request<UtilisateurRead[]>('/responsables'),
    /** All users — readable by any authenticated role for name lookups. */
    listAll: () => request<UtilisateurRead[]>('/responsables/all'),
  },

  utilisateurs: {
    list: () => request<UtilisateurRead[]>('/utilisateurs'),
    create: (body: { nom: string; role: string; secret: string; telephone?: string; actif?: boolean }) =>
      request<UtilisateurRead>('/utilisateurs', { method: 'POST', body }),
    update: (id: number, body: { nom?: string; role?: string; secret?: string; telephone?: string; actif?: boolean }) =>
      request<UtilisateurRead>(`/utilisateurs/${id}`, { method: 'PATCH', body }),
    delete: (id: number) => request<void>(`/utilisateurs/${id}`, { method: 'DELETE' }),
  },

  clients: {
    list: () => request<ClientRead[]>('/clients'),
    create: (body: { code: string; nom: string; actif?: boolean }) =>
      request<ClientRead>('/clients', { method: 'POST', body }),
    update: (id: number, body: { code?: string; nom?: string; actif?: boolean }) =>
      request<ClientRead>(`/clients/${id}`, { method: 'PATCH', body }),
    delete: (id: number) => request<void>(`/clients/${id}`, { method: 'DELETE' }),
  },

  produits: {
    list: () => request<ProduitRead[]>('/produits'),
    create: (body: { reference: string; libelle: string; client_id?: number | null; type_traitement?: string; actif?: boolean }) =>
      request<ProduitRead>('/produits', { method: 'POST', body }),
    update: (id: number, body: { reference?: string; libelle?: string; client_id?: number | null; type_traitement?: string; actif?: boolean }) =>
      request<ProduitRead>(`/produits/${id}`, { method: 'PATCH', body }),
    delete: (id: number) => request<void>(`/produits/${id}`, { method: 'DELETE' }),
  },

  symptomes: {
    list: () => request<SymptomeRead[]>('/symptomes'),
    create: (body: { code: string; libelle_fr: string; libelle_ar?: string; famille?: string; ordre?: number; actif?: boolean }) =>
      request<SymptomeRead>('/symptomes', { method: 'POST', body }),
    update: (id: number, body: { code?: string; libelle_fr?: string; libelle_ar?: string; famille?: string; ordre?: number; actif?: boolean }) =>
      request<SymptomeRead>(`/symptomes/${id}`, { method: 'PATCH', body }),
    delete: (id: number) => request<void>(`/symptomes/${id}`, { method: 'DELETE' }),
  },

  suivis: {
    create: (payload: SuiviCreate) =>
      request<SuiviRead>('/suivis', { method: 'POST', body: payload }),
    sync: (items: SuiviCreate[]) =>
      request<SuiviRead[]>('/suivis/sync', { method: 'POST', body: { items } }),
    list: (params?: { inspecteur_id?: number; date?: string }) => {
      const parts: string[] = []
      if (params?.inspecteur_id) parts.push(`inspecteur_id=${params.inspecteur_id}`)
      if (params?.date) parts.push(`date=${encodeURIComponent(params.date)}`)
      const qs = parts.length ? `?${parts.join('&')}` : ''
      return request<SuiviRead[]>(`/suivis${qs}`)
    },
    get: (id: number) => request<SuiviRead>(`/suivis/${id}`),
    visa: (id: number, type: 'qualite' | 'prod' | 'methode') =>
      request<{ id: number }>(`/suivis/${id}/visa`, { method: 'POST', body: { type } }),
  },

  alertes: {
    create: (payload: AlerteCreate) =>
      request<AlerteRead>('/alertes', { method: 'POST', body: payload }),
    list: (params?: { statut?: StatutAlerte; responsable_cible_id?: number }) => {
      const qs = new URLSearchParams()
      if (params?.statut) qs.set('statut', params.statut)
      if (params?.responsable_cible_id) qs.set('responsable_cible_id', String(params.responsable_cible_id))
      const q = qs.toString()
      return request<AlerteRead[]>(`/alertes${q ? `?${q}` : ''}`)
    },
    get: (id: number) => request<AlerteRead>(`/alertes/${id}`),
    ack: (id: number) => request<AlerteRead>(`/alertes/${id}/ack`, { method: 'PATCH' }),
    decision: (id: number, payload: DecisionCreate) =>
      request<DecisionRead>(`/alertes/${id}/decision`, { method: 'POST', body: payload }),
  },

  sseUrl: (): string => {
    const token = tokenStore.access ?? ''
    return `${BASE}/events?token=${encodeURIComponent(token)}`
  },

  push: {
    vapidPublicKey: () => request<{ public_key: string }>('/push/vapid-public-key', { auth: false }),
    subscribe: (sub: { endpoint: string; p256dh: string; auth: string }) =>
      request<{ id: number }>('/push/subscribe', { method: 'POST', body: sub }),
    unsubscribe: (endpoint: string) =>
      request<void>(`/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { method: 'DELETE' }),
  },

  kpis: {
    tauxNc: (depuis?: string, clientId?: number, produitId?: number) => {
      const p = new URLSearchParams()
      if (depuis) p.set('depuis', depuis)
      if (clientId != null) p.set('client_id', String(clientId))
      if (produitId != null) p.set('produit_id', String(produitId))
      const qs = p.toString() ? `?${p}` : ''
      return request<TauxNcRow[]>(`/kpis/taux-nc${qs}`)
    },
    precurseurs: (depuis?: string, produitId?: number) => {
      const p = new URLSearchParams()
      if (depuis) p.set('depuis', depuis)
      if (produitId != null) p.set('produit_id', String(produitId))
      const qs = p.toString() ? `?${p}` : ''
      return request<PrecurseurRow[]>(`/kpis/precurseurs${qs}`)
    },
    tempsReponse: (depuis?: string) => {
      const qs = depuis ? `?depuis=${encodeURIComponent(depuis)}` : ''
      return request<TempsReponseRow[]>(`/kpis/temps-reponse${qs}`)
    },
  },

  exportSuiviPdf: async (depuis?: string, clientId?: number): Promise<Blob> => {
    const p = new URLSearchParams()
    if (depuis) p.set('depuis', depuis)
    if (clientId != null) p.set('client_id', String(clientId))
    const qs = p.toString() ? `?${p}` : ''
    const headers: Record<string, string> = {}
    if (tokenStore.access) headers['Authorization'] = `Bearer ${tokenStore.access}`
    const res = await fetch(`${BASE}/export/suivi.pdf${qs}`, { headers })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return res.blob()
  },
}
