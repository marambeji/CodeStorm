import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Gestion du thème clair / sombre (remplace next-themes, pensé pour Next.js).
 * - Sombre par défaut
 * - Le choix est mémorisé dans localStorage
 * - Un petit script dans index.html applique le thème AVANT l'affichage (pas de flash blanc)
 */
export type ThemeName = 'dark' | 'light'

const STORAGE_KEY = 'theme'

interface ThemeContextValue {
  theme: ThemeName
  /** Alias de `theme` (même API que next-themes, utilisé par le composant Toaster) */
  resolvedTheme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): ThemeName {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark' // localStorage peut être bloqué (navigation privée stricte)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    // On coupe les transitions CSS le temps du changement, sinon tout "clignote" en fondu
    root.classList.add('[&_*]:!transition-none')
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1120' : '#F5F7FB')
    const id = requestAnimationFrame(() => root.classList.remove('[&_*]:!transition-none'))
    return () => cancelAnimationFrame(id)
  }, [theme])

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* le thème reste valable pour la session */
    }
  }, [])

  return <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>')
  return ctx
}
