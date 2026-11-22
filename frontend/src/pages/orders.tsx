import { KeyRound, Loader2, Package, Store } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrders, useTransition, type Order } from '@/features/market/api'
import { OrderCard, PillTabs as Tabs } from '@/features/market/components'
import { LiveTracking } from '@/features/market/tracking'
import { apiErrorMessage } from '@/features/terracalc/api'

const ACTIVE: Order['status'][] = ['en_attente', 'acceptee', 'prete', 'prise_en_charge', 'en_livraison']

/** Mes commandes (client) : suivi de chaque commande, de la ferme jusqu'à la porte */
export default function OrdersPage() {
  const orders = useOrders()
  const [tab, setTab] = useState<'cours' | 'terminees'>('cours')
  const list = orders.data?.filter((o) => (tab === 'cours' ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status))) ?? []
  const activeCount = orders.data?.filter((o) => ACTIVE.includes(o.status)).length ?? 0

  return (
    <>
      <PageHeader
        title="Mes commandes"
        description="Suivez chaque commande étape par étape : acceptation par la ferme, préparation, livraison."
        icon={Package}
        tone="energy"
        actions={
          <Button asChild variant="outline">
            <Link to="/app/marche">
              <Store aria-hidden="true" /> Retour au marché
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onChange={setTab} items={[{ id: 'cours', label: 'En cours', count: activeCount }, { id: 'terminees', label: 'Terminées' }]} />

      {orders.isPending && <Skeleton className="h-64 rounded-2xl" />}
      {orders.isError && <EmptyState icon={Package} title="Commandes indisponibles" description={apiErrorMessage(orders.error)} />}
      {orders.data && list.length === 0 && (
        <EmptyState
          icon={Package}
          title={tab === 'cours' ? 'Aucune commande en cours' : 'Aucune commande terminée'}
          description={tab === 'cours' ? 'Vos prochaines commandes apparaîtront ici avec leur suivi.' : 'L’historique de vos commandes livrées ou annulées apparaîtra ici.'}
          action={
            tab === 'cours' && (
              <Button asChild variant="module">
                <Link to="/app/marche">Découvrir le marché</Link>
              </Button>
            )
          }
        />
      )}
      <div className="space-y-4">
        {list.map((o) => (
          <ClientOrder key={o.id} order={o} />
        ))}
      </div>
    </>
  )
}

function ClientOrder({ order }: { order: Order }) {
  const transition = useTransition()
  return (
    <OrderCard
      order={order}
      perspective="client"
      highlight={
        order.deliveryCode && ['prete', 'prise_en_charge', 'en_livraison'].includes(order.status) ? (
          <div className="space-y-3">
          <LiveTracking order={order} perspective="client" />
          <div className="flex items-center gap-4 rounded-xl border border-energy/30 bg-energy/10 px-4 py-3">
            <KeyRound className="size-5 shrink-0 text-energy-fg" aria-hidden="true" />
            <p className="flex-1 text-sm">
              <span className="font-semibold">Code de remise</span>
              <span className="block text-xs text-muted-foreground">Donnez ce code au livreur quand il vous remet la commande.</span>
            </p>
            <span className="font-mono text-2xl font-extrabold tracking-[0.3em]" aria-label={`Code ${order.deliveryCode.split('').join(' ')}`}>
              {order.deliveryCode}
            </span>
          </div>
          </div>
        ) : null
      }
      actions={
        order.actions.includes('annuler') ? (
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="sm" disabled={transition.isPending}>
                {transition.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Annuler la commande
              </Button>
            }
            title={`Annuler la commande ${order.reference} ?`}
            description="La ferme ne l’a pas encore acceptée : vous pouvez l’annuler sans frais."
            confirmLabel="Oui, annuler"
            cancelLabel="Garder la commande"
            onConfirm={async () => {
              try {
                await transition.mutateAsync({ id: order.id, action: 'annuler' })
                toast.success('Commande annulée')
              } catch (e) {
                toast.error(apiErrorMessage(e))
              }
            }}
          />
        ) : undefined
      }
    />
  )
}
