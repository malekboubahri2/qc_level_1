import { AppLayout } from './AppLayout'
import { Card } from './Card'
import { t } from '../lib/i18n'

/** Phase-0 stub body for a role surface. Later phases replace these per §7. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <AppLayout title={title}>
      <Card className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-ink-heading">{title}</h1>
        <p className="mt-2 text-ink-muted">{t('page.placeholder')}</p>
      </Card>
    </AppLayout>
  )
}
