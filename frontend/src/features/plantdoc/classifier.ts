import type { DiseaseInfo } from './types'

/**
 * Classifieur de feuilles PlantDoc.
 *
 * 1. Si un modèle MobileNet entraîné sur PlantVillage est présent dans
 *    public/models/plantvillage/ (model.json + labels.json), il est chargé avec
 *    TensorFlow.js et utilisé (100 % dans le navigateur, aucune donnée envoyée).
 * 2. Sinon, MODE DÉMO : analyse réelle des couleurs de la photo (part de feuille
 *    abîmée) + choix reproductible de la maladie parmi celles de la culture.
 *    Il permet de présenter tout le parcours en attendant le vrai modèle.
 *
 * Pour brancher le vrai modèle : entraîner MobileNetV2 sur PlantVillage (Keras), convertir
 * avec `tensorflowjs_converter`, déposer les fichiers, et écrire labels.json : la liste des
 * clés PlantDoc (ex : "tomate-mildiou") dans l'ordre des sorties du modèle.
 */
export interface Prediction {
  diseaseKey: string
  confidence: number
  /** Part de la feuille atteinte (0 → 1), mesurée sur l'image : sert à calculer la gravité */
  affectedRatio: number
  top: { diseaseKey: string; confidence: number }[]
  engine: 'mobilenet' | 'demo'
}

const MODEL_URL = '/models/plantvillage/model.json'
const LABELS_URL = '/models/plantvillage/labels.json'

export async function classifyLeaf(file: File, crop: string, diseases: DiseaseInfo[]): Promise<Prediction> {
  const img = await loadImage(file)
  const pixels = analyzePixels(img)
  const candidates = diseases.filter((d) => d.crop === crop)

  const model = await tryLoadModel()
  if (model) {
    const scores = await model.predict(img)
    const ranked = scores
      .map((confidence, i) => ({ diseaseKey: model.labels[i], confidence }))
      .filter((s) => candidates.some((c) => c.key === s.diseaseKey))
      .sort((a, b) => b.confidence - a.confidence)
    if (ranked.length) return { ...ranked[0], affectedRatio: pixels.affectedRatio, top: ranked.slice(0, 3), engine: 'mobilenet' }
  }
  return demoPrediction(pixels, candidates)
}

// ─────────────────────────── Analyse des couleurs ───────────────────────────

/**
 * Sépare, sur une image réduite à 96 px, le tissu sain (vert) du tissu abîmé
 * (brun, jaune, noir) et ignore le fond (blanc, gris, ciel…).
 */
export function analyzePixels(img: HTMLImageElement | HTMLCanvasElement) {
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  let healthy = 0
  let lesion = 0
  let yellowish = 0
  let hash = 0
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    hash = (hash * 31 + ((r >> 4) ^ (g >> 3) ^ b)) >>> 0
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    if (g > r && g > b && sat > 0.18 && max > 40) healthy++
    else if (r >= g && g > b && sat > 0.25 && max > 50) {
      lesion++ // brun / jaune / orangé
      if (g > r * 0.75) yellowish++
    } else if (max < 55 && sat > 0.1) lesion++ // nécrose sombre
  }
  const leaf = healthy + lesion
  return { affectedRatio: leaf ? lesion / leaf : 0, yellowShare: lesion ? yellowish / lesion : 0, leafCoverage: leaf / (size * size), hash }
}

function demoPrediction(p: ReturnType<typeof analyzePixels>, candidates: DiseaseInfo[]): Prediction {
  const healthy = candidates.find((d) => d.healthy)
  const sick = candidates.filter((d) => !d.healthy)
  const rand = (n: number) => ((p.hash >>> (n * 3)) % 1000) / 1000

  // Feuille presque entièrement verte → saine
  if (p.affectedRatio < 0.025 || !sick.length) {
    const confidence = 0.9 + rand(1) * 0.08
    return {
      diseaseKey: healthy!.key,
      confidence,
      affectedRatio: p.affectedRatio,
      top: [{ diseaseKey: healthy!.key, confidence }, ...sick.slice(0, 2).map((d, i) => ({ diseaseKey: d.key, confidence: (1 - confidence) / (i + 2) }))],
      engine: 'demo',
    }
  }
  // Taches surtout jaunes → maladies "à taches jaunes" en priorité, sinon brunes/noires
  const yellowFirst = /cladosporiose|alternariose|rouille|tylcv|esca/
  const ordered = [...sick].sort((a, b) => Number(yellowFirst.test(b.key)) - Number(yellowFirst.test(a.key)))
  const pool = p.yellowShare > 0.45 ? ordered : ordered.reverse()
  const pick = pool[Math.floor(rand(2) * Math.min(2, pool.length))]
  const confidence = 0.74 + rand(3) * 0.2
  const others = sick.filter((d) => d.key !== pick.key)
  return {
    diseaseKey: pick.key,
    confidence,
    affectedRatio: p.affectedRatio,
    top: [
      { diseaseKey: pick.key, confidence },
      ...others.slice(0, 2).map((d, i) => ({ diseaseKey: d.key, confidence: ((1 - confidence) * (2 - i)) / 3 })),
    ],
    engine: 'demo',
  }
}

// ─────────────────────────── Modèle TensorFlow.js (optionnel) ───────────────────────────

let modelPromise: Promise<{ labels: string[]; predict: (img: HTMLImageElement) => Promise<number[]> } | null> | null = null

function tryLoadModel() {
  modelPromise ??= (async () => {
    try {
      const head = await fetch(MODEL_URL, { method: 'HEAD' })
      if (!head.ok || !head.headers.get('content-type')?.includes('json')) return null
      // TensorFlow.js (~1 Mo) n'est téléchargé que si un modèle est vraiment présent
      const tf = await import('@tensorflow/tfjs')
      const [model, labels] = await Promise.all([tf.loadLayersModel(MODEL_URL), fetch(LABELS_URL).then((r) => r.json() as Promise<string[]>)])
      return {
        labels,
        predict: async (img: HTMLImageElement) => {
          const scores = tf.tidy(() => {
            const input = tf.browser.fromPixels(img).resizeBilinear([224, 224]).toFloat().div(127.5).sub(1).expandDims(0)
            return (model.predict(input) as import('@tensorflow/tfjs').Tensor).dataSync()
          })
          return Array.from(scores)
        },
      }
    } catch {
      return null
    }
  })()
  return modelPromise
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = url
  })
}
