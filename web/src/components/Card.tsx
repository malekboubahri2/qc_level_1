import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Default container: white surface on cream, brand-tinted shadow, no border. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg bg-white p-6 shadow-card', className)}
      {...props}
    />
  )
}
