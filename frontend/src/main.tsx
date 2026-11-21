import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App.tsx'
import './index.css'
import './i18n'

// Cache des données serveur (React Query) : 1 nouvelle tentative, pas de rechargement au retour sur l'onglet
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Thème : sombre par défaut, mémorisé dans le navigateur, classe .dark sur <html> */}
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      {/* reducedMotion="user" : respecte le réglage "réduire les animations" du système */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <BrowserRouter>
            <Suspense>
              <App />
            </Suspense>
          </BrowserRouter>
          <Toaster position="bottom-right" closeButton />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
