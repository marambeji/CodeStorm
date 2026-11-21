import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { AssistantWidget } from '@/components/assistant/assistant-widget'
import { CommandPalette } from '@/components/command-palette'
import { MarketingLayout } from '@/components/layout/marketing-layout'

// Chaque page est chargée à la demande (code splitting) : le premier affichage reste rapide,
// même quand les modules embarqueront Leaflet, Tesseract ou TensorFlow.
const LandingPage = lazy(() => import('@/pages/landing'))
const DashboardPage = lazy(() => import('@/pages/dashboard'))
const KitPage = lazy(() => import('@/pages/kit'))
const PlantDocPage = lazy(() => import('@/pages/plantdoc'))
const FactureIAPage = lazy(() => import('@/pages/factureia'))
const HydroMapPage = lazy(() => import('@/pages/hydromap'))
const AquaScanPage = lazy(() => import('@/pages/aquascan'))
const TerraCalcListPage = lazy(() => import('@/pages/terracalc-list'))
const TerraCalcEditorPage = lazy(() => import('@/pages/terracalc-editor'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))

export default function App() {
  return (
    <>
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<LandingPage />} />
      </Route>

      <Route path="app" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="plantdoc" element={<PlantDocPage />} />
        <Route path="terracalc" element={<TerraCalcListPage />} />
        <Route path="terracalc/nouveau" element={<TerraCalcEditorPage />} />
        <Route path="terracalc/:id" element={<TerraCalcEditorPage />} />
        <Route path="factureia" element={<FactureIAPage />} />
        <Route path="hydromap" element={<HydroMapPage />} />
        <Route path="aquascan" element={<AquaScanPage />} />
        <Route path="kit" element={<KitPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    {/* Assistant IA flottant, disponible partout */}
    <AssistantWidget />
    {/* Palette de commandes Ctrl+K / ⌘K */}
    <CommandPalette />
    </>
  )
}
