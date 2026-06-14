import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div>
        <p className="text-6xl font-bold text-brand">404</p>
        <p className="mt-2 text-ink-muted">{t('common.notFound')}</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-accent hover:text-accent-light">
          {t('common.backHome')} →
        </Link>
      </div>
    </div>
  )
}
