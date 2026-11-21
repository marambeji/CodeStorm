import axios from 'axios'

/**
 * Client HTTP unique pour parler au backend NestJS.
 * En développement, "/api" passe par le proxy Vite → http://localhost:3000/api.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10_000,
})
