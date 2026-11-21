import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind CSS v4 s'intègre directement comme plugin Vite (plus besoin de postcss.config)
  plugins: [react(), tailwindcss()],
  resolve: {
    // Alias "@/..." → "src/..." (utilisé par shadcn/ui et dans tout le projet)
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    // Les appels à /api sont redirigés vers le backend NestJS (évite les soucis de CORS en dev)
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
