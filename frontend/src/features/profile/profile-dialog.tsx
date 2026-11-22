import { Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/features/terracalc/api'
import { useProfile, useSaveProfile } from './api'
import { LocationField } from './location-field'

/** Profil : nom, exploitation et lieu (utilisés pour la météo, IrriPlan et l'assistant) */
export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const profile = useProfile()
  const save = useSaveProfile()
  const [name, setName] = useState('')
  const [farmName, setFarmName] = useState('')
  const [phone, setPhone] = useState('')
  const farmer = (profile.data?.role ?? 'agriculteur') === 'agriculteur'
  const [place, setPlace] = useState<{ name: string; lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !profile.data) return
    setName(profile.data.name ?? '')
    setFarmName(profile.data.farmName ?? '')
    setPhone(profile.data.phone ?? '')
    setPlace(profile.data.lat !== null && profile.data.lng !== null ? { name: profile.data.placeName ?? '', lat: profile.data.lat, lng: profile.data.lng } : null)
    setError(null)
  }, [open, profile.data])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return setError('Indiquez votre nom (2 caractères minimum).')
    try {
      await save.mutateAsync({ name: name.trim(), farmName: farmer ? farmName.trim() || undefined : undefined, phone: phone.trim(), placeName: place?.name, lat: place?.lat ?? null, lng: place?.lng ?? null })
      toast.success('Profil enregistré', { description: place ? `Météo et plans d’irrigation calés sur ${place.name}.` : undefined })
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mon profil</DialogTitle>
          <DialogDescription>{farmer ? 'Votre lieu sert à la météo, aux plans d’irrigation et aux réponses de l’assistant. Votre téléphone est visible par le livreur.' : 'Votre téléphone permet au livreur et aux fermes de vous joindre.'}</DialogDescription>
        </DialogHeader>
        <form id="profile-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Votre nom</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Salim Ben Ali" maxLength={40} autoComplete="name" />
          </div>
          {farmer && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-farm">Exploitation (facultatif)</Label>
              <Input id="pf-farm" value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="Ex : Ferme des Oliviers" maxLength={60} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pf-phone">Téléphone (facultatif)</Label>
            <Input id="pf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 20 123 456" autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-place">{farmer ? 'Lieu de l’exploitation' : 'Ville'}</Label>
            <LocationField id="pf-place" value={place} onChange={setPlace} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="profile-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
