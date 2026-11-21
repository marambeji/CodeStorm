export type Severity = 'aucune' | 'faible' | 'moyenne' | 'élevée'
export type DiagnosisStatus = 'a-traiter' | 'en-cours' | 'traite'

export interface DiseaseInfo {
  key: string
  crop: string
  name: string
  healthy: boolean
  agent: 'champignon' | 'bactérie' | 'virus' | 'aucun'
  symptoms: string
  treatment: string
  organic: string
  prevention: string
  contagious: boolean
}

export interface Catalog {
  crops: { id: string; name: string }[]
  diseases: DiseaseInfo[]
}

export interface Diagnosis {
  id: string
  parcel: string
  crop: string
  diseaseKey: string
  disease: string
  confidence: number
  severity: Severity
  advice: string
  tips: string[]
  status: DiagnosisStatus
  notes: string | null
  imageUrl: string | null
  info: DiseaseInfo | null
  createdAt: string
  updatedAt: string
}

export const STATUS_LABEL: Record<DiagnosisStatus, string> = {
  'a-traiter': 'À traiter',
  'en-cours': 'Traitement en cours',
  traite: 'Traité',
}

/** Couleurs d'état (réservées : jamais utilisées pour autre chose), toujours avec un libellé */
export const SEVERITY_STYLE: Record<Severity, { label: string; className: string; dot: string }> = {
  aucune: { label: 'Saine', className: 'bg-leaf/12 text-leaf-fg ring-leaf/25', dot: 'bg-leaf' },
  faible: { label: 'Gravité faible', className: 'bg-yellow-500/12 text-yellow-700 dark:text-yellow-300 ring-yellow-500/25', dot: 'bg-yellow-500' },
  moyenne: { label: 'Gravité moyenne', className: 'bg-orange-500/12 text-orange-700 dark:text-orange-300 ring-orange-500/25', dot: 'bg-orange-500' },
  élevée: { label: 'Gravité élevée', className: 'bg-red-500/12 text-red-700 dark:text-red-300 ring-red-500/25', dot: 'bg-red-500' },
}
