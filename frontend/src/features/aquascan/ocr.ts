/**
 * Lecture automatique d'un compteur d'eau avec Tesseract.js (OCR dans le navigateur).
 *
 * Pour une bonne lecture, l'image doit être RECADRÉE sur les rouleaux de chiffres
 * (cadre de visée de la caméra, ou recadrage manuel d'une photo importée).
 *
 * 1. Préparation : niveaux de gris, agrandissement, binarisation avec un seuil
 *    calculé automatiquement (méthode d'Otsu) : robuste aux photos sombres ou surexposées.
 * 2. Deux lectures : chiffres foncés sur fond clair, puis l'inverse (rouleaux noirs à
 *    chiffres blancs). On garde la lecture la plus plausible.
 * 3. Interprétation : au-delà de 5 chiffres, les 3 derniers sont des litres (rouleaux rouges).
 *
 * Tesseract télécharge son moteur la première fois (connexion nécessaire) ; sinon, saisie manuelle.
 */
export interface OcrResult {
  value: number | null
  raw: string
  confidence: number // 0 → 1 (0 = non fournie)
}

export async function readMeterImage(file: File, onProgress?: (p: number) => void): Promise<OcrResult> {
  const gray = await toGray(file)
  const { createWorker, PSM } = await import('tesseract.js')
  let pass = 0
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.((pass + m.progress) / 2)
    },
  })
  try {
    await worker.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: PSM.SINGLE_LINE })
    const results: OcrResult[] = []
    for (const invert of [false, true]) {
      const canvas = binarize(gray, invert)
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true })
      const digits = data.text.replace(/\D/g, '')
      const words = data.blocks?.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words))) ?? []
      const conf = data.confidence || (words.length ? words.reduce((s, w) => s + w.confidence, 0) / words.length : 0)
      results.push({ value: interpret(digits), raw: digits, confidence: Math.max(0, Math.min(1, conf / 100)) })
      pass++
    }
    // La lecture la plus plausible : un compteur a 5 à 8 chiffres ; à égalité, la plus confiante
    const score = (r: OcrResult) => (r.raw.length >= 5 && r.raw.length <= 8 ? 2 : r.raw.length >= 4 ? 1 : 0) + r.confidence
    return results.sort((a, b) => score(b) - score(a))[0]
  } finally {
    await worker.terminate()
  }
}

/** "00000043" → 0,043 m³ ; "01278596" → 1278,596 m³ ; "01278" → 1278 m³ */
export function interpret(digits: string): number | null {
  if (!digits) return null
  if (digits.length > 5) return Number(digits.slice(0, -3)) + Number(digits.slice(-3)) / 1000
  return Number(digits)
}

interface Gray {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Image → niveaux de gris, agrandie pour que les chiffres soient assez grands pour l'OCR */
async function toGray(file: File): Promise<Gray> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Image illisible'))
    i.src = URL.createObjectURL(file)
  })
  const scale = Math.max(1, Math.min(4, 160 / img.height, 1800 / img.width))
  const width = Math.round(img.width * scale)
  const height = Math.round(img.height * scale)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  const d = ctx.getImageData(0, 0, width, height).data
  const data = new Uint8ClampedArray(width * height)
  for (let i = 0; i < data.length; i++) data[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
  return { data, width, height }
}

/** Seuil d'Otsu : la valeur qui sépare le mieux les pixels clairs et foncés */
function otsu(data: Uint8ClampedArray) {
  const hist = new Array<number>(256).fill(0)
  data.forEach((v) => hist[v]++)
  const total = data.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

/** Noir et blanc franc, avec une marge blanche autour (Tesseract la préfère) */
function binarize(g: Gray, invert: boolean): HTMLCanvasElement {
  const t = otsu(g.data)
  const pad = 24
  const c = document.createElement('canvas')
  c.width = g.width + pad * 2
  c.height = g.height + pad * 2
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  const img = ctx.createImageData(g.width, g.height)
  for (let i = 0; i < g.data.length; i++) {
    let dark = g.data[i] < t
    if (invert) dark = !dark
    const v = dark ? 0 : 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, pad, pad)
  return c
}

/**
 * Photo de compteur d'exemple (dessinée) pour la démo : chiffres noirs pour les m³,
 * rouges pour les litres, comme un vrai compteur. Cadrée sur les rouleaux.
 */
export async function sampleMeterPhoto(value: number): Promise<File> {
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
