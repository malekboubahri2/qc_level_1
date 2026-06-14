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

  utilisateurs: {
    list: () => request<UtilisateurRead[]>('/utilisateurs'),
  },

  clients: {
    list: () => request<ClientRead[]>('/clients'),
  },

  produits: {
    list: () => request<ProduitRead[]>('/produits'),
  },

  symptomes: {
    list: () => request<SymptomeRead[]>('/symptomes'),
  },

  suivis: {
    create: (payload: SuiviCreate) =>
      request<SuiviRead>('/suivis', { method: 'POST', body: payload }),
    sync: (items: SuiviCreate[]) =>
      request<SuiviRead[]>('/suivis/sync', { method: 'POST', body: { items } }),
    list: () => request<SuiviRead[]>('/suivis'),
    get: (id: number) => request<SuiviRead>(`/suivis/${id}`),
    visa: (id: number, type: 'qualite' | 'prod' | 'methode') =>
      request<{ id: number }>(`/suivis/${id}/visa`, { method: 'POST', body: { type } }),
  },

  alertes: {
    create: (payload: AlerteCreate) =>
      request<AlerteRead>('/alertes', { method: 'POST', body: payload }),
    list: (statut?: StatutAlerte) =>
      request<AlerteRead[]>(`/alertes${statut ? `?statut=${statut}` : ''}`),
    get: (id: number) => request<AlerteRead>(`/alertes/${id}`),
    ack: (id: number) => request<AlerteRead>(`/alertes/${id}/ack`, { method: 'PATCH' }),
    decision: (id: number, payload: DecisionCreate) =>
      request<DecisionRead>(`/alertes/${id}/decision`, { method: 'POST', body: payload }),
  },

  sseUrl: (): string => {
    const token = tokenStore.access ?? ''
    return `${BASE}/events?token=${encodeURIComponent(token)}`
  },
}
