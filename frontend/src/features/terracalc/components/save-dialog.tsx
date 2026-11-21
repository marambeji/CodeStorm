import { Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Fenêtre "Enregistrer le terrain" : nom obligatoire (2 à 60 caractères), même règle que le backend */
export function SaveDialog({
  open,
  onOpenChange,
  defaultName,
  existing,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  defaultName: string
  existing: boolean
  saving: boolean
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(defaultName)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setName(defaultName)
      setTouched(false)
    }
  }, [open, defaultName])

  const trimmed = name.trim()
  const error = trimmed.length < 2 ? 'Donnez un nom d’au moins 2 caractères, par exemple « Parcelle Nord ».' : trimmed.length > 60 ? 'Le nom ne peut pas dépasser 60 caractères.' : null

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!error) onSave(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>{existing ? 'Mettre à jour le terrain' : 'Enregistrer le terrain'}</DialogTitle>
            <DialogDescription>Le contour, la culture et l’estimation seront retrouvés dans « Mes terrains ».</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tc-name">Nom du terrain</Label>
            <Input
              id="tc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && Boolean(error)}
              aria-describedby={touched && error ? 'tc-name-error' : undefined}
              autoFocus
              maxLength={80}
            />
            {touched && error && (
              <p id="tc-name-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" variant="module" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {existing ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
