import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Me } from '../lib/api'

const HOME_BY_ROLE: Record<Me['role'], string> = {
  inspecteur: '/inspecteur',
  methode: '/methode/ecran',
  qualite: '/kpis',
  prod: '/kpis',
  admin: '/admin',
}

/** Landing redirect — sends each role to its primary surface (qc-level1.md §7). */
export function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={HOME_BY_ROLE[user.role]} replace />
}
