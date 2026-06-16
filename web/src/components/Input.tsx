import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Brand text input. The gold focus ring comes from the global :focus-visible. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-cream-subtle bg-white px-4 py-3.5 text-base',
          'text-ink placeholder:text-ink-muted',
          className,
        )}
        {...props}
      />
    )
  },
)
