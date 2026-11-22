import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { cartStore } from '@/features/market/api'
import { api, authToken } from '@/lib/api'

export type Role = 'agriculteur' | 'client' | 'livreur'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  phone: string | null
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
    async register(input: { name: string; email: string; password: string; farmName?: string; role: Role; phone?: string }) {
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
  cartStore.clear() // le panier appartient au compte qui l'a rempli
  try {
    sessionStorage.removeItem('assistant-conversation-v2')
  } catch {
    /* rien */
  }
}

/** Rôle de l'utilisateur connecté (agriculteur par défaut, pendant le chargement) */
export function useRole(): Role {
  return useMe().data?.role ?? 'agriculteur'
}

/** Page réservée à certains rôles : les autres reviennent à leur page d'accueil */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const me = useMe()
  if (!me.data) return null
  if (!roles.includes(me.data.role)) return <Navigate to={homePath(me.data.role)} replace />
  return <>{children}</>
}

/** Page d'accueil de chaque rôle */
export function homePath(role: Role) {
  return role === 'client' ? '/app/marche' : role === 'livreur' ? '/app/livraisons' : '/app'
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
