import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Me } from '../lib/api'

type Role = Me['role']

/** Gate a route behind auth and, optionally, a set of roles. Admin passes any. */
export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: Role[]
  children: ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cream text-ink-muted">
        …
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
