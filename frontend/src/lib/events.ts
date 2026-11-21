/**
 * Petits événements globaux entre composants éloignés
 * (ex : la palette Ctrl+K ouvre l'assistant IA).
 */
export const openAssistant = () => window.dispatchEvent(new CustomEvent('econexus:assistant'))
export const openPalette = () => window.dispatchEvent(new CustomEvent('econexus:palette'))

export function onAppEvent(name: 'assistant' | 'palette', handler: () => void) {
  const event = `econexus:${name}`
  window.addEventListener(event, handler)
  return () => window.removeEventListener(event, handler)
}
