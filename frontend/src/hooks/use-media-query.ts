import { useSyncExternalStore } from 'react'

/** Vrai si la media query correspond (ex : useMediaQuery('(min-width: 1024px)')) */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
