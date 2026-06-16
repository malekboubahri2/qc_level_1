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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 md:px-8 md:py-3">
          {/* Logo + page label */}
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo.png"
              alt="PMP"
              className="h-8 w-auto shrink-0 rounded bg-white/90 px-1.5 py-0.5 object-contain md:h-9"
            />
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-semibold text-cream leading-none">{t('app.title')}</p>
              <p className="hidden truncate text-[11px] leading-none text-cream/60 sm:block mt-0.5">
                {title}
              </p>
            </div>
          </div>

          {/* Right: user chip + logout */}
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            {user && (
              <span className="rounded bg-cream/10 px-2 py-0.5 text-xs font-medium max-w-[140px] truncate hidden sm:block">
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
              <span className="ml-1 hidden md:inline">{t('nav.logout')}</span>
            </Button>
          </div>
        </div>

        {/* Mobile: page title on second row */}
        <div className="border-t border-cream/10 px-4 py-1 text-[11px] text-cream/60 sm:hidden">
          {title}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-8">{children}</main>
    </div>
  )
}
