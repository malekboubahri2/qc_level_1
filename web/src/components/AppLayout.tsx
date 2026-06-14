import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { t } from '../lib/i18n'
import { Button } from './Button'
import { Icon } from './Icon'

/** Cream page with a brand-teal header strip, role chip, and logout. */
export function AppLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-brand text-ink-inverse">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold tracking-tightish">{t('app.title')}</span>
            <span className="text-sm text-cream/70">{title}</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="rounded bg-cream/10 px-2 py-0.5 text-xs font-medium">
                {user.nom} · {t(`role.${user.role}`)}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-cream hover:bg-cream/10"
              onClick={logout}
            >
              <Icon icon={LogOut} size={16} />
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">{children}</main>
    </div>
  )
}
