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

export const api = {
  health: () => request<{ status: string }>('/health', { auth: false }),
  login: (nom: string, secret: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { nom, secret },
      auth: false,
    }),
  me: () => request<Me>('/auth/me'),
}
