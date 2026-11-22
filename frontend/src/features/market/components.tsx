import { motion } from 'framer-motion'
import {
  Apple,
  BadgeCheck,
  Bike,
  Carrot,
  CheckCircle2,
  CircleX,
  ClipboardList,
  Droplet,
  Hexagon,
  House,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Sprout,
  TreePalm,
  Truck,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { categoryLabel, formatDate, formatPrice, formatQty, type Category, type Order, type OrderStatus } from './api'

// ─────────────────────────────── Produit ───────────────────────────────

const CATEGORY_STYLE: Record<Category, { icon: LucideIcon; from: string; to: string }> = {
  legumes: { icon: Carrot, from: '#F97316', to: '#10B981' },
  fruits: { icon: Apple, from: '#EF4444', to: '#F59E0B' },
  dattes: { icon: TreePalm, from: '#B45309', to: '#F59E0B' },
  huiles: { icon: Droplet, from: '#65A30D', to: '#EAB308' },
  cereales: { icon: Wheat, from: '#CA8A04', to: '#FDE047' },
  miel: { icon: Hexagon, from: '#D97706', to: '#FBBF24' },
  autres: { icon: Package, from: '#0EA5E9', to: '#10B981' },
}

export const categoryIcon = (c: Category) => CATEGORY_STYLE[c]?.icon ?? Package

/** Photo du produit, ou illustration de sa catégorie s'il n'y en a pas */
export function ProductVisual({ photoUrl, category, name, className, iconClassName }: { photoUrl: string | null; category: Category; name: string; className?: string; iconClassName?: string }) {
  const s = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.autres
  if (photoUrl) return <img src={photoUrl} alt={name} loading="lazy" className={cn('object-cover', className)} />
  return (
    <div
      role="img"
      aria-label={`${name} (${categoryLabel(category)})`}
      className={cn('flex items-center justify-center', className)}
      style={{ background: `radial-gradient(120% 120% at 20% 10%, ${s.from}33, transparent 60%), linear-gradient(135deg, ${s.from}22, ${s.to}26)` }}
    >
      <s.icon className={cn('size-10 opacity-80', iconClassName)} style={{ color: s.from }} aria-hidden="true" />
    </div>
  )
}

export function OrganicBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-leaf/15 px-2 py-0.5 text-[0.7rem] font-semibold text-leaf-fg', className)}>
      <Sprout className="size-3" aria-hidden="true" /> Bio
    </span>
  )
}

// ─────────────────────────────── Statut ───────────────────────────────

export const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  en_attente: { label: 'En attente', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  acceptee: { label: 'Acceptée', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  prete: { label: 'Prête à livrer', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  prise_en_charge: { label: 'Livreur en route', className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' },
  en_livraison: { label: 'En livraison', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  livree: { label: 'Livrée', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  refusee: { label: 'Refusée', className: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  annulee: { label: 'Annulée', className: 'bg-muted text-muted-foreground' },
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status]
  return <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap', s.className)}>{s.label}</span>
}

// ─────────────────────────────── Chaîne d'approvisionnement ───────────────────────────────

const CHAIN: { status: OrderStatus; label: string; who: string; icon: LucideIcon }[] = [
  { status: 'en_attente', label: 'Commandée', who: 'Client', icon: ClipboardList },
  { status: 'acceptee', label: 'Acceptée', who: 'Ferme', icon: CheckCircle2 },
  { status: 'prete', label: 'Préparée', who: 'Ferme', icon: PackageCheck },
  { status: 'prise_en_charge', label: 'Livreur assigné', who: 'Livreur', icon: Bike },
  { status: 'en_livraison', label: 'Récupérée', who: 'Livreur', icon: Truck },
  { status: 'livree', label: 'Livrée', who: 'Client', icon: House },
]

/**
 * Suivi de la commande, de la ferme au client : chaque étape franchie affiche qui l'a validée et quand.
 * Compact = une ligne de pastilles (listes) ; sinon, étapes détaillées.
 */
export function SupplyChain({ order, compact = false }: { order: Order; compact?: boolean }) {
  if (order.status === 'refusee' || order.status === 'annulee') {
    const ev = order.events.at(-1)
    return (
      <div className="flex items-start gap-3 rounded-xl bg-destructive/8 px-3 py-2.5 text-sm">
        <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <p>
          <span className="font-semibold">{order.status === 'refusee' ? 'Refusée par la ferme' : 'Annulée par le client'}</span>
          {ev && <span className="text-muted-foreground"> · {formatDate(ev.createdAt, true)}</span>}
          {ev?.note && <span className="block text-muted-foreground">« {ev.note} »</span>}
          <span className="block text-xs text-muted-foreground">Les produits ont été remis en vente.</span>
        </p>
      </div>
    )
  }
  const current = CHAIN.findIndex((c) => c.status === order.status)
  const eventOf = (s: OrderStatus) => order.events.find((e) => e.status === s)

  return (
    <ol aria-label="Suivi de la commande" className={cn('grid grid-cols-6', compact ? 'gap-1' : 'gap-2')}>
      {CHAIN.map((step, i) => {
        const done = i <= current
        const active = i === current && order.status !== 'livree'
        const ev = eventOf(step.status)
        return (
          <li key={step.status} className="relative flex flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
            {/* Trait vers l'étape suivante */}
            {i < CHAIN.length - 1 && (
              <span aria-hidden="true" className={cn('absolute top-4 start-[calc(50%+1.1rem)] end-[calc(-50%+1.1rem)] h-0.5 rounded-full bg-border', compact && 'top-3 start-[calc(50%+0.85rem)] end-[calc(-50%+0.85rem)]')}>
                <motion.span
                  className="block h-full rounded-full bg-leaf"
                  initial={false}
                  animate={{ width: i < current ? '100%' : '0%' }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                />
              </span>
            )}
            <span
              className={cn(
                'relative flex items-center justify-center rounded-full ring-1 ring-inset transition-colors',
                compact ? 'size-6 [&_svg]:size-3' : 'size-8 [&_svg]:size-4',
                done ? 'bg-leaf text-white ring-leaf' : 'bg-background text-muted-foreground ring-border',
              )}
            >
              {active && <span className="absolute inset-0 animate-ping rounded-full bg-leaf/40" aria-hidden="true" />}
              <step.icon aria-hidden="true" />
            </span>
            <span className={cn('mt-1.5 px-0.5 leading-tight font-medium', compact ? 'text-[0.65rem]' : 'text-[0.65rem] sm:text-xs', done ? 'text-foreground' : 'text-muted-foreground', i !== current && 'max-sm:sr-only')}>{step.label}</span>
            {!compact && (
              <span className="mt-0.5 hidden text-[0.68rem] leading-tight text-muted-foreground sm:block">
                {ev ? (
                  <>
                    {ev.actorName}
                    <br />
                    {formatDate(ev.createdAt, true)}
                  </>
                ) : (
                  step.who
                )}
              </span>
            )}
            <span className="sr-only">{done ? '(terminée)' : '(à venir)'}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ─────────────────────────────── Carte de commande ───────────────────────────────

/** Carte commune aux trois rôles ; `perspective` choisit les informations utiles à chacun */
export function OrderCard({ order, perspective, actions, highlight }: { order: Order; perspective: 'client' | 'agriculteur' | 'livreur'; actions?: ReactNode; highlight?: ReactNode }) {
  const farm = order.farmer.farmName || order.farmer.name
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border bg-card/70 shadow-sm backdrop-blur">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 sm:px-5">
        <h3 className="font-mono text-sm font-semibold tracking-tight">{order.reference}</h3>
        <StatusBadge status={order.status} />
        <span className="text-xs text-muted-foreground">{formatDate(order.createdAt, true)}</span>
        <span className="ms-auto text-base font-bold tabular-nums">{formatPrice(perspective === 'agriculteur' ? order.subtotal : order.total)}</span>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {highlight}
        <SupplyChain order={order} compact={perspective !== 'client'} />

        <div className="grid gap-4 sm:grid-cols-2">
          <ul className="space-y-1.5 text-sm">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="font-medium tabular-nums">{formatQty(it.quantity, it.unit)}</span> · {it.name}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{formatPrice(it.lineTotal)}</span>
              </li>
            ))}
            {perspective !== 'agriculteur' && (
              <li className="flex justify-between border-t pt-1.5 text-xs text-muted-foreground">
                <span>Livraison</span>
                <span>{order.deliveryFee === 0 ? 'Offerte' : formatPrice(order.deliveryFee)}</span>
              </li>
            )}
          </ul>

          <dl className="space-y-2 text-sm">
            {/* Le livreur voit déjà la ferme et l'adresse dans son itinéraire */}
            {(perspective === 'client' || (perspective === 'livreur' && order.status === 'livree')) && (
              <Info icon={Sprout} label="Ferme">
                {farm}
                {order.farmer.placeName && <span className="text-muted-foreground"> · {order.farmer.placeName}</span>}
              </Info>
            )}
            {perspective !== 'client' && <Info icon={BadgeCheck} label="Client">{order.client.name}</Info>}
            {(perspective !== 'livreur' || order.status === 'livree') && (
              <Info icon={MapPin} label="Livraison">
                {order.address}
              </Info>
            )}
            {perspective === 'livreur' && (
              <Info icon={Phone} label="Téléphone">
                <a href={`tel:${order.phone.replace(/\s/g, '')}`} className="underline-offset-2 hover:underline">
                  {order.phone}
                </a>
                {order.farmer.phone && <span className="text-muted-foreground"> · ferme {order.farmer.phone}</span>}
              </Info>
            )}
            {order.courier && perspective !== 'livreur' && (
              <Info icon={Truck} label="Livreur">
                {order.courier.name}
                {order.courier.phone && perspective === 'client' && <span className="text-muted-foreground"> · {order.courier.phone}</span>}
              </Info>
            )}
            {order.note && (
              <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Note :</span> {order.note}
              </p>
            )}
          </dl>
        </div>
      </div>

      {actions && <footer className="flex flex-wrap justify-end gap-2 border-t bg-muted/25 px-4 py-3 sm:px-5">{actions}</footer>}
    </motion.article>
  )
}

function Info({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="break-words">{children}</dd>
      </div>
    </div>
  )
}

/** Petite tuile chiffrée (boutique, livraisons) */
export function StatTile({ label, value, hint, icon: Icon, tone = 'leaf' }: { label: string; value: ReactNode; hint?: string; icon: LucideIcon; tone?: 'leaf' | 'water' | 'energy' | 'danger' }) {
  const toneCls = { leaf: 'bg-leaf/12 text-leaf-fg', water: 'bg-water/12 text-water-fg', energy: 'bg-energy/12 text-energy-fg', danger: 'bg-red-500/12 text-red-600 dark:text-red-400' }[tone]
  return (
    <div className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex size-8 items-center justify-center rounded-lg', toneCls)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}


/** Onglets simples (pilule), partagés par les pages du marché */
export function PillTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="mb-5 inline-flex rounded-xl bg-muted p-1 text-sm font-medium">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cn('flex h-9 items-center gap-2 rounded-lg px-4 transition-colors', value === it.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {it.label}
          {it.count ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums">{it.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
