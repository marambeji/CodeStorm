import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Symbole EcoNexus : trois nœuds (agriculture, eau, énergie) reliés en un réseau.
 * C'est littéralement le "nexus" eau-énergie-agriculture.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-foreground/[0.06]" />
      <g strokeWidth="1.6" strokeLinecap="round" className="stroke-foreground/35">
        <path d="M16 8.5 9.5 21" />
        <path d="M16 8.5 22.5 21" />
        <path d="M9.5 21h13" />
      </g>
      <circle cx="16" cy="8.5" r="3.6" fill="#0EA5E9" />
      <circle cx="9.5" cy="21.5" r="3.6" fill="#10B981" />
      <circle cx="22.5" cy="21.5" r="3.6" fill="#F59E0B" />
    </svg>
  )
}

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn('flex items-center gap-2.5 rounded-lg font-heading text-[1.05rem] font-bold tracking-tight', className)}
    >
      <LogoMark />
      <span>EcoNexus</span>
    </Link>
  )
}
