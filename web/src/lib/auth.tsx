import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, tokenStore, type Me } from './api'

interface AuthState {
  user: Me | null
  loading: boolean
  login: (nom: string, secret: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore a session on load if a token is present.
  useEffect(() => {
    let active = true
    if (!tokenStore.access) {
      setLoading(false)
      return
    }
    api
      .me()
      .then((me) => active && setUser(me))
      .catch(() => {
        tokenStore.clear()
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (nom: string, secret: string) => {
    const tokens = await api.login(nom, secret)
    tokenStore.set(tokens.access_token, tokens.refresh_token)
    setUser(await api.me())
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
