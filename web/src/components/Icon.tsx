import type { LucideIcon } from 'lucide-react'

/** Wraps any Lucide icon to enforce the brand's 1.5 stroke (visual-identity). */
export function Icon({
  icon: LucideGlyph,
  size = 20,
  className,
}: {
  icon: LucideIcon
  size?: number
  className?: string
}) {
  return <LucideGlyph size={size} strokeWidth={1.5} className={className} />
}
