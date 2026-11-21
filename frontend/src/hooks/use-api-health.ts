import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export type ApiHealth =
  | { state: 'checking' }
  | { state: 'online'; aiMode: 'llm' | 'mock' }
  | { state: 'offline' }

/**
 * Vérifie que le backend répond (GET /api/health) et dans quel mode tourne l'IA.
 * Si le backend est éteint, l'application continue en mode démo local.
 */
export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>({ state: 'checking' })

  useEffect(() => {
    let cancelled = false
    api
      .get<{ aiMode: 'llm' | 'mock' }>('/health', { timeout: 4000 })
      .then((res) => !cancelled && setHealth({ state: 'online', aiMode: res.data.aiMode }))
      .catch(() => !cancelled && setHealth({ state: 'offline' }))
    return () => {
      cancelled = true
    }
  }, [])

  return health
}
