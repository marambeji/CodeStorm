import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        icon={Compass}
        title="Cette page n'existe pas"
        description="Le lien est peut-être incomplet. Revenez à la vue d'ensemble pour retrouver vos modules."
        action={
          <Button asChild>
            <Link to="/app">Aller à la vue d'ensemble</Link>
          </Button>
        }
      />
    </div>
  )
}
