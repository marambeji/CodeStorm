import { lazy } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { AssistantWidget } from '@/components/assistant/assistant-widget'
import { CommandPalette } from '@/components/command-palette'
import { MarketingLayout } from '@/components/layout/marketing-layout'
import { RequireAuth } from '@/features/auth/auth'
import { authToken } from '@/lib/api'

// Chaque page est chargée à la demande (code splitting) : le premier affichage reste rapide,
// même quand les modules embarqueront Leaflet, Tesseract ou TensorFlow.
const LandingPage = lazy(() => import('@/pages/landing'))
const DashboardPage = lazy(() => import('@/pages/dashboard'))
const PlantDocPage = lazy(() => import('@/pages/plantdoc'))
const IrriPlanPage = lazy(() => import('@/pages/irriplan'))
const AquaScanPage = lazy(() => import('@/pages/aquascan'))
const TerraCalcListPage = lazy(() => import('@/pages/terracalc-list'))
const TerraCalcEditorPage = lazy(() => import('@/pages/terracalc-editor'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))
const LoginPage = lazy(() => import('@/pages/login'))

export default function App() {
  const { pathname } = useLocation()
  const signedIn = pathname.startsWith('/app') && Boolean(authToken.get())
  return (
    <>
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<LandingPage />} />
      </Route>

      <Route path="connexion" element={<LoginPage />} />

      <Route
        path="app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="plantdoc" element={<PlantDocPage />} />
        <Route path="terracalc" element={<TerraCalcListPage />} />
        <Route path="terracalc/nouveau" element={<TerraCalcEditorPage />} />
        <Route path="terracalc/:id" element={<TerraCalcEditorPage />} />
        <Route path="irriplan" element={<IrriPlanPage />} />
        <Route path="aquascan" element={<AquaScanPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    {/* Assistant IA flottant et palette Ctrl+K : seulement une fois connecté */}
    {signedIn && <AssistantWidget />}
    {signedIn && <CommandPalette />}
    </>
  )
}
