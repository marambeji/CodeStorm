import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, authToken } from '@/lib/api'

export interface User {
  id: string
  email: string
  name: string
  farmName: string | null
  placeName: string | null
  lat: number | null
  lng: number | null
}

interface AuthResponse {
  user: User
  accessToken: string
}

/** Agriculteur connecté (null si non connecté) */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (authToken.get() ? (await api.get<User>('/auth/me')).data : null),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** Connexion, inscription et déconnexion : le cache est vidé pour ne jamais mélanger deux comptes */
export function useAuthActions() {
  const qc = useQueryClient()
  const start = (r: AuthResponse) => {
    authToken.set(r.accessToken)
    qc.clear()
    qc.setQueryData(['me'], r.user)
    resetAssistant()
  }
  return {
    async login(email: string, password: string) {
      start((await api.post<AuthResponse>('/auth/login', { email, password })).data)
    },
    async register(input: { name: string; email: string; password: string; farmName?: string }) {
      start((await api.post<AuthResponse>('/auth/register', input)).data)
    },
    logout() {
      authToken.clear()
      qc.clear()
      resetAssistant()
      window.dispatchEvent(new CustomEvent('econexus:signed-out'))
    },
  }
}

function resetAssistant() {
  try {
    sessionStorage.removeItem('assistant-conversation-v2')
  } catch {
    /* rien */
  }
}

/** Protège l'application : sans connexion, on va à la page de connexion (puis on revient) */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const me = useMe()

  useEffect(() => {
    const onSignedOut = () => {
      qc.clear()
      navigate('/connexion', { replace: true })
    }
    window.addEventListener('econexus:signed-out', onSignedOut)
    return () => window.removeEventListener('econexus:signed-out', onSignedOut)
  }, [navigate, qc])

  if (!authToken.get()) return <Navigate to={`/connexion?suite=${encodeURIComponent(location.pathname)}`} replace />
  if (me.isPending)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Chargement" />
      </div>
    )
  if (!me.data) return <Navigate to="/connexion" replace />
  return <>{children}</>
}
