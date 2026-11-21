import { useEffect } from 'react'
import { toneHex, type Tone } from '@/lib/modules'

/**
 * Pose la couleur du module courant dans la variable CSS `--module` sur <html>.
 * Tout ce qui utilise `bg-module`, `text-module`, `border-module`… change alors de couleur,
 * y compris les éléments rendus hors de la page (fenêtres, toasts, tiroir mobile).
 */
export function useModuleAccent(tone: Tone | undefined) {
  useEffect(() => {
    document.documentElement.style.setProperty('--module', toneHex[tone ?? 'water'])
  }, [tone])
}
