import axios from 'axios'

/**
 * Client HTTP unique pour parler au backend NestJS.
 * En développement, "/api" passe par le proxy Vite → http://localhost:3000/api.
 * Le jeton de connexion est ajouté à chaque requête ("Authorization: Bearer …").
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10_000,
})

const TOKEN_KEY = 'econexus-token'

export const authToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* navigation privée : le jeton reste valable le temps de la page */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* rien à faire */
    }
  },
}

api.interceptors.request.use((config) => {
  const token = authToken.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Jeton expiré ou compte supprimé : on revient à la page de connexion
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url: string = error?.config?.url ?? ''
    if (error?.response?.status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      authToken.clear()
      window.dispatchEvent(new CustomEvent('econexus:signed-out'))
    }
    return Promise.reject(error)
  },
)
