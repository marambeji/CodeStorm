/**
 * Lecture automatique d'un compteur d'eau avec Tesseract.js (OCR dans le navigateur).
 *
 * 1. Préparation de l'image : niveaux de gris, contraste étiré, inversion si les chiffres
 *    sont clairs sur fond sombre (cas des rouleaux de compteur), agrandissement.
 * 2. OCR limité aux chiffres, en mode "une seule ligne".
 * 3. Interprétation : un compteur affiche des m³ (chiffres noirs) puis des litres (rouges) ;
 *    au-delà de 5 chiffres, les 3 derniers sont considérés comme des litres.
 *
 * Tesseract télécharge son moteur et la langue la première fois (connexion nécessaire) ;
 * sans connexion, l'utilisateur saisit simplement la valeur à la main.
 */
export interface OcrResult {
  value: number | null
  raw: string
  confidence: number // 0 → 1
}

export async function readMeterImage(file: File, onProgress?: (p: number) => void): Promise<OcrResult> {
  const canvas = await preprocess(file)
  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    await worker.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: PSM.SINGLE_LINE })
    // Depuis Tesseract.js v6, les détails (blocs, confiance) ne sont renvoyés que sur demande
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true })
    const digits = data.text.replace(/\D/g, '')
    const words = data.blocks?.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words))) ?? []
    const conf = data.confidence || (words.length ? words.reduce((s, w) => s + w.confidence, 0) / words.length : 0)
    return { value: interpret(digits), raw: data.text.trim(), confidence: Math.max(0, Math.min(1, conf / 100)) }
  } finally {
    await worker.terminate()
  }
}

/** "01278596" → 1278,596 m³ ; "01278" → 1278 m³ */
export function interpret(digits: string): number | null {
  if (!digits) return null
  if (digits.length > 5) {
    const m3 = Number(digits.slice(0, -3))
    const liters = Number(digits.slice(-3))
    return m3 + liters / 1000
  }
  return Number(digits)
}

async function preprocess(file: File): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Image illisible'))
    i.src = URL.createObjectURL(file)
  })
  const scale = Math.min(2, 1400 / img.width)
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const d = ctx.getImageData(0, 0, c.width, c.height)
  let min = 255
  let max = 0
  const gray = new Uint8ClampedArray(d.data.length / 4)
  for (let i = 0; i < gray.length; i++) {
    const g = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2]
    gray[i] = g
    min = Math.min(min, g)
    max = Math.max(max, g)
  }
  // Recadrage : la ligne de chiffres est la bande horizontale avec le plus de
  // transitions clair/foncé (les bords du boîtier, eux, sont des lignes continues).
  const W = c.width
  const H = c.height
  const mid = (min + max) / 2
  const transitions = new Float32Array(H)
  for (let y = 0; y < H; y++) {
    let t = 0
    for (let x = 1; x < W; x++) if (gray[y * W + x] > mid !== gray[y * W + x - 1] > mid) t++
    transitions[y] = t
  }
  const bandH = Math.max(20, Math.round(H * 0.28))
  let best = 0
  let bestScore = -1
  let score = 0
  for (let y = 0; y < H; y++) {
    score += transitions[y] - (y >= bandH ? transitions[y - bandH] : 0)
    if (y >= bandH - 1 && score > bestScore) {
      bestScore = score
      best = y - bandH + 1
    }
  }
  const top = Math.max(0, best - Math.round(bandH * 0.15))
  const bottom = Math.min(H, best + bandH + Math.round(bandH * 0.15))

  // Polarité décidée DANS la bande : fond majoritairement sombre → chiffres clairs → on inverse
  let bandSum = 0
  for (let y = top; y < bottom; y++) for (let x = 0; x < W; x++) bandSum += gray[y * W + x]
  const invert = bandSum / ((bottom - top) * W) < mid
  for (let i = 0; i < gray.length; i++) {
    let v = ((gray[i] - min) / Math.max(1, max - min)) * 255
    if (invert) v = 255 - v
    v = v > 140 ? 255 : 0 // seuil : noir et blanc franc
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v
  }
  ctx.putImageData(d, 0, 0)
  // On ne garde que la bande de chiffres, avec une marge blanche (Tesseract la préfère)
  const out = document.createElement('canvas')
  out.width = W + 40
  out.height = bottom - top + 40
  const octx = out.getContext('2d')!
  octx.fillStyle = '#fff'
  octx.fillRect(0, 0, out.width, out.height)
  octx.drawImage(c, 0, top, W, bottom - top, 20, 20, W, bottom - top)
  return out
}

/**
 * Photo de compteur d'exemple (dessinée) pour la démo : chiffres noirs pour les m³,
 * rouges pour les litres, comme un vrai compteur.
 */
export async function sampleMeterPhoto(value: number): Promise<File> {
  // Gros plan sur les rouleaux, comme on le conseille à l'utilisateur ("cadrez les chiffres")
  const c = document.createElement('canvas')
  c.width = 900
  c.height = 300
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#d1d5db'
  ctx.fillRect(0, 0, 900, 300)
  const m3 = String(Math.floor(value)).padStart(5, '0').slice(-5)
  const liters = String(Math.round((value % 1) * 1000)).padStart(3, '0')
  const digits = [...m3, ...liters]
  ctx.fillStyle = '#111827'
  ctx.fillRect(40, 70, 820, 160)
  digits.forEach((dgt, i) => {
    const x = 50 + i * 101
    ctx.fillStyle = i < 5 ? '#111827' : '#991b1b'
    ctx.fillRect(x, 80, 95, 140)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 110px Consolas, "DejaVu Sans Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(dgt, x + 47, 190)
  })
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92))
  return new File([blob], 'compteur-exemple.jpg', { type: 'image/jpeg' })
}
