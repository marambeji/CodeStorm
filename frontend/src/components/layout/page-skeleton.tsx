import { Skeleton } from '@/components/ui/skeleton'

/** Squelette affiché pendant le chargement d'une page (code chargé à la demande). */
export function PageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Chargement de la page">
      <div className="space-y-3">
        <Skeleton className="size-12 rounded-2xl" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}
