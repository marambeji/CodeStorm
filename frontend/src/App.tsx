import { lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { AssistantWidget } from '@/components/assistant/assistant-widget'
import { CommandPalette } from '@/components/command-palette'
import { MarketingLayout } from '@/components/layout/marketing-layout'
import { homePath, RequireAuth, RequireRole, useRole } from '@/features/auth/auth'
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
const MarketPage = lazy(() => import('@/pages/market'))
const OrdersPage = lazy(() => import('@/pages/orders'))
const ShopPage = lazy(() => import('@/pages/shop'))
const DeliveriesPage = lazy(() => import('@/pages/deliveries'))
const TraceabilityPage = lazy(() => import('@/pages/traceability'))
const TracePublicPage = lazy(() => import('@/pages/trace-public'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))
const LoginPage = lazy(() => import('@/pages/login'))

const Farmer = ({ children }: { children: ReactNode }) => <RequireRole roles={['agriculteur']}>{children}</RequireRole>

/** /app : tableau de bord pour l'agriculteur, marché pour le client, livraisons pour le livreur */
function RoleHome() {
  const role = useRole()
  return role === 'agriculteur' ? <DashboardPage /> : <Navigate to={homePath(role)} replace />
}

export default function App() {
  const { pathname } = useLocation()
  const signedIn = pathname.startsWith('/app') && Boolean(authToken.get())
  return (
    <>
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<LandingPage />} />
        {/* Module consommateur : page publique du QR code (sans compte) */}
        <Route path="trace" element={<TracePublicPage />} />
        <Route path="trace/:code" element={<TracePublicPage />} />
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
        <Route index element={<RoleHome />} />
        {/* Outils de l'agriculteur */}
        <Route path="plantdoc" element={<Farmer><PlantDocPage /></Farmer>} />
        <Route path="terracalc" element={<Farmer><TerraCalcListPage /></Farmer>} />
        <Route path="terracalc/nouveau" element={<Farmer><TerraCalcEditorPage /></Farmer>} />
        <Route path="terracalc/:id" element={<Farmer><TerraCalcEditorPage /></Farmer>} />
        <Route path="irriplan" element={<Farmer><IrriPlanPage /></Farmer>} />
        <Route path="aquascan" element={<Farmer><AquaScanPage /></Farmer>} />
        {/* Marché : chaque rôle a ses pages */}
        <Route path="boutique" element={<Farmer><ShopPage /></Farmer>} />
        <Route path="marche" element={<RequireRole roles={['client']}><MarketPage /></RequireRole>} />
        <Route path="commandes" element={<RequireRole roles={['client']}><OrdersPage /></RequireRole>} />
        {/* Traçabilité : tous les acteurs de la chaîne */}
        <Route path="tracabilite" element={<TraceabilityPage />} />
        <Route path="livraisons" element={<RequireRole roles={['livreur']}><DeliveriesPage /></RequireRole>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    {/* Assistant IA flottant et palette Ctrl+K : seulement une fois connecté */}
    {signedIn && <AssistantWidget />}
    {signedIn && <CommandPalette />}
    </>
  )
}
