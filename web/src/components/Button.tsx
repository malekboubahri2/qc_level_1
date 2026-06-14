import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-cream hover:bg-brand-dark',
  secondary: 'border border-brand text-brand hover:bg-brand/5',
  ghost: 'text-brand hover:bg-brand/5',
  accent: 'text-accent hover:text-accent-light',
  danger: 'bg-danger text-cream hover:bg-danger/90',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
