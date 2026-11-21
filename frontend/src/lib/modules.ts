import { Droplets, Gauge, LandPlot, LayoutDashboard, Leaf, type LucideIcon } from 'lucide-react'

/**
 * Source unique de vérité pour les modules d'EcoNexus.
 * Navigation, couleurs, titres de page et lumière ambiante sont tous dérivés d'ici :
 * pour ajouter un module, il suffit d'ajouter une entrée.
 */

export type Theme = 'agriculture' | 'energie' | 'eau'
export type Tone = 'leaf' | 'water' | 'energy'

export interface ModuleDef {
  id: 'plantdoc' | 'terracalc' | 'irriplan' | 'aquascan'
  name: string
  /** Ce que le module fait, en une phrase compréhensible par un agriculteur ou un élu */
  tagline: string
  path: string
  icon: LucideIcon
  theme: Theme
  tone: Tone
}

/** Couleurs de marque (hex) de chaque tonalité */
export const toneHex: Record<Tone, string> = {
  leaf: '#10B981',
  water: '#0EA5E9',
  energy: '#F59E0B',
}

/** Classes Tailwind par tonalité (écrites en entier pour que Tailwind les détecte) */
export const toneClasses: Record<Tone, { text: string; bg: string; soft: string; ring: string }> = {
  leaf: { text: 'text-leaf-fg', bg: 'bg-leaf', soft: 'bg-leaf/12', ring: 'ring-leaf/30' },
  water: { text: 'text-water-fg', bg: 'bg-water', soft: 'bg-water/12', ring: 'ring-water/30' },
  energy: { text: 'text-energy-fg', bg: 'bg-energy', soft: 'bg-energy/12', ring: 'ring-energy/30' },
}

export const themeLabel: Record<Theme, string> = {
  agriculture: 'Agriculture',
  energie: 'Énergie',
  eau: 'Eau',
}

export const MODULES: ModuleDef[] = [
  {
    id: 'plantdoc',
    name: 'PlantDoc',
    tagline: 'Photographiez une feuille, obtenez le diagnostic et le traitement.',
    path: '/app/plantdoc',
    icon: Leaf,
    theme: 'agriculture',
    tone: 'leaf',
  },
  {
    id: 'terracalc',
    name: 'TerraCalc',
    tagline: 'Dessinez votre terrain sur la carte et estimez ce qu’il peut produire.',
    path: '/app/terracalc',
    icon: LandPlot,
    theme: 'agriculture',
    tone: 'leaf',
  },
  {
    id: 'irriplan',
    name: 'IrriPlan',
    tagline: 'Sachez quand arroser et combien, avec la météo réelle.',
    path: '/app/irriplan',
    icon: Droplets,
    theme: 'eau',
    tone: 'water',
  },
  {
    id: 'aquascan',
    name: 'AquaScan',
    tagline: 'Relevez votre compteur d’eau en photo et repérez les fuites.',
    path: '/app/aquascan',
    icon: Gauge,
    theme: 'eau',
    tone: 'water',
  },
]

export const DASHBOARD = {
  name: "Vue d'ensemble",
  path: '/app',
  icon: LayoutDashboard,
}

/** Retrouve le module correspondant à une URL (ou undefined pour le dashboard) */
export function moduleFromPath(pathname: string): ModuleDef | undefined {
  return MODULES.find((m) => pathname.startsWith(m.path))
}
