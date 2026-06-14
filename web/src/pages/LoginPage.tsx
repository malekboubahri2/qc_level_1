import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { t } from '../lib/i18n'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

const schema = z.object({
  nom: z.string().min(1),
  secret: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nom: '', secret: '' },
  })

  if (!loading && user) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login(values.nom, values.secret)
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('login.error'))
    }
  })

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-cream px-6">
      {/* Faint brand watermark, like the PMP public hero */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -bottom-16 select-none text-[20rem] font-bold leading-none text-brand-deep/5"
      >
        QC
      </span>

      <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-popover animate-scale-in">
        <div className="bg-brand px-6 py-5 text-ink-inverse">
          <h1 className="text-2xl font-bold text-cream">{t('app.title')}</h1>
          <p className="text-sm text-cream/70">{t('app.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-6" noValidate>
          <h2 className="text-lg font-semibold text-ink-heading">{t('login.title')}</h2>

          <div>
            <label htmlFor="nom" className="mb-1 block text-sm font-medium text-ink-heading">
              {t('login.nom')} <span className="text-danger">*</span>
            </label>
            <Input id="nom" autoComplete="username" autoFocus {...register('nom')} />
            {errors.nom && <p className="mt-1 text-xs text-danger">{t('login.nom')}</p>}
          </div>

          <div>
            <label htmlFor="secret" className="mb-1 block text-sm font-medium text-ink-heading">
              {t('login.secret')} <span className="text-danger">*</span>
            </label>
            <Input
              id="secret"
              type="password"
              autoComplete="current-password"
              {...register('secret')}
            />
            {errors.secret && (
              <p className="mt-1 text-xs text-danger">{t('login.secret')}</p>
            )}
          </div>

          {formError && (
            <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('login.submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
