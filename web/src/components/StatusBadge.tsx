import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type Tone = 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
}

const DOTS: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export function StatusBadge({
  tone,
  children,
  dot = true,
}: {
  tone: Tone
  children: ReactNode
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  )
}
