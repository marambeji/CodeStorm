import { ArrowLeft, Leaf, Loader2, ScanLine, SearchX } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { usePublicLot } from '@/features/trace/api'
import { LotPassport, QrScannerDialog } from '@/features/trace/components'
import { apiErrorMessage } from '@/features/terracalc/api'

/**
 * Module consommateur (sans compte) :
 *   /trace         scanner le QR code d'un produit
 *   /trace/:code   origine, historique du transport, fraîcheur estimée, vérification du registre
 */
export default function TracePublicPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const lot = usePublicLot(code)
  const onCode = useCallback(
    (c: string) => {
      setScanning(false)
      navigate(`/trace/${c}`)
    },
    [navigate],
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-28 pb-20 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-leaf/10 px-3 py-1 text-xs font-semibold text-leaf-fg ring-1 ring-inset ring-leaf/25">
            <Leaf className="size-3.5" aria-hidden="true" /> Traçabilité EcoNexus
          </span>
          <h1 className="text-[2rem] leading-[1.08] font-extrabold tracking-[-0.035em] sm:text-5xl">{code ? 'D’où vient ce produit ?' : 'Scannez votre produit'}</h1>
          <p className="max-w-2xl text-muted-foreground">Origine, parcours de la ferme jusqu’au magasin et fraîcheur estimée par l’IA, garantis par un registre infalsifiable.</p>
        </div>
        <Button variant="module" size="lg" onClick={() => setScanning(true)}>
          <ScanLine aria-hidden="true" /> {code ? 'Scanner un autre produit' : 'Scanner le QR code'}
        </Button>
      </header>

      <QrScannerDialog open={scanning} onClose={() => setScanning(false)} onCode={onCode} title="Scanner le produit" />

      {!code && (
        <EmptyState
          icon={ScanLine}
          title="Aucun produit scanné"
          description="Le QR code se trouve sur l’étiquette du produit ou de la caisse. Vous pouvez aussi saisir l’identifiant du lot (LOT-…)."
          action={
            <Button variant="module" onClick={() => setScanning(true)}>
              Scanner maintenant
            </Button>
          }
        />
      )}
      {code && lot.isPending && (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-label="Chargement" />
        </div>
      )}
      {code && lot.isError && (
        <EmptyState
          icon={SearchX}
          title="Produit introuvable"
          description={apiErrorMessage(lot.error)}
          action={
            <Button asChild variant="outline">
              <Link to="/trace">
                <ArrowLeft aria-hidden="true" /> Recommencer
              </Link>
            </Button>
          }
        />
      )}
      {lot.data && <LotPassport lot={lot.data} />}
    </div>
  )
}
