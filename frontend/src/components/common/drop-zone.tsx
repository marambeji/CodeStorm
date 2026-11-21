import { AnimatePresence, motion } from 'framer-motion'
import { Camera, FileUp, X } from 'lucide-react'
import { useCallback, useId, useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Zone de dépôt de fichier (drag & drop) réutilisée par PlantDoc, FactureIA et AquaScan.
 * - Glisser-déposer sur ordinateur
 * - Bouton "Choisir un fichier" (accessible au clavier)
 * - `camera` : propose aussi d'ouvrir directement l'appareil photo du téléphone
 */
export function DropZone({
  accept,
  label,
  hint,
  camera = false,
  file,
  onFile,
  className,
}: {
  accept: string
  label: string
  hint?: string
  camera?: boolean
  file: File | null
  onFile: (file: File | null) => void
  className?: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const dropped = e.dataTransfer.files?.[0]
      if (dropped) onFile(dropped)
    },
    [onFile],
  )

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200',
          dragging ? 'border-module bg-module/8' : 'border-border hover:border-foreground/25',
        )}
      >
        <motion.span
          animate={{ y: dragging ? -4 : 0, scale: dragging ? 1.06 : 1 }}
          className="flex size-14 items-center justify-center rounded-2xl bg-module/12 text-module ring-1 ring-inset ring-module/25"
        >
          <FileUp className="size-6" aria-hidden="true" />
        </motion.span>
        <div className="space-y-1">
          <label htmlFor={inputId} className="block cursor-pointer text-[0.95rem] font-semibold">
            {dragging ? 'Déposez le fichier ici' : label}
          </label>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            Choisir un fichier
          </Button>
          {camera && (
            <Button variant="outline" onClick={() => cameraRef.current?.click()}>
              <Camera aria-hidden="true" /> Prendre une photo
            </Button>
          )}
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {camera && (
          // capture="environment" ouvre la caméra arrière sur mobile
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        )}
      </div>

      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3 text-sm">
              <FileUp className="size-4 shrink-0 text-module" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
              <span className="tabular shrink-0 text-muted-foreground">{(file.size / 1024).toFixed(0)} Ko</span>
              <Button variant="ghost" size="icon-sm" onClick={() => onFile(null)} aria-label="Retirer le fichier">
                <X />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
