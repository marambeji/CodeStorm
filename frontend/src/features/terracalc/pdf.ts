import type { Polygon } from 'geojson'
import type { Estimate } from './types'
import { IRRIGATION_LABEL, STAGE_LABEL } from './types'

/**
 * Rapport PDF d'estimation TerraCalc (jsPDF, chargé seulement au clic).
 * Tout est dessiné en vectoriel : contour du terrain, graphique, tableaux.
 *
 * Attention : les polices standard du PDF ne connaissent pas certains caractères
 * (espace fine insécable utilisée par Intl en français, « ₂ », « ≈ »…) : on les remplace.
 */
export async function downloadTerrainReport({ name, polygon, estimate: e }: { name: string; polygon: Polygon; estimate: Estimate }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 16 // marge
  let y = 0

  const clean = (s: string) => s.replace(/[  ]/g, ' ').replace(/₂/g, '2').replace(/≈/g, '~').replace(/⚠️/g, '')
  const nf = (n: number, d = 0) => clean(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n))
  const kg = (n: number) => (n >= 1000 ? `${nf(n / 1000, 1)} t` : `${nf(n)} kg`)
  const eur = (n: number) => `${nf(n)} €`
  const text = (s: string, x: number, yy: number, opts?: Parameters<typeof doc.text>[3]) => doc.text(clean(s), x, yy, opts)

  // ── En-tête ──
  doc.setFillColor(11, 17, 32)
  doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(16, 185, 129)
  doc.circle(M + 4, 13, 2.4, 'F')
  doc.setFillColor(14, 165, 233)
  doc.circle(M + 9, 13, 2.4, 'F')
  doc.setFillColor(245, 158, 11)
  doc.circle(M + 14, 13, 2.4, 'F')
  doc.setTextColor(231, 236, 245)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  text('Rapport TerraCalc', M + 20, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  text(`EcoNexus · ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, M + 20, 22)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  text(name, W - M, 18, { align: 'right' })

  // ── Contour du terrain + fiche ──
  y = 44
  const box = { x: M, y, w: 70, h: 56 }
  doc.setDrawColor(220, 226, 235)
  doc.setFillColor(245, 247, 251)
  doc.roundedRect(box.x, box.y, box.w, box.h, 3, 3, 'FD')
  drawPolygon(doc, polygon, box)

  const col = M + 78
  doc.setTextColor(11, 17, 32)
  doc.setFontSize(12)
  text('Terrain', col, y + 4)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  const rows: [string, string][] = [
    ['Surface', `${nf(e.geometry.areaM2)} m² (${nf(e.geometry.areaHa, 2)} ha)`],
    ['Périmètre', `${nf(e.geometry.perimeterM)} m`],
    ['Centre', `${e.geometry.centroid[0].toFixed(5)}, ${e.geometry.centroid[1].toFixed(5)}`],
    ['Culture', e.species.name],
    ['Irrigation', IRRIGATION_LABEL[e.inputs.irrigation]],
  ]
  if (e.trees) {
    rows.push(['Espacement', `${nf(e.inputs.rowSpacingM ?? 0, 1)} × ${nf(e.inputs.treeSpacingM ?? 0, 1)} m`])
    rows.push(['Âge / stade', `${e.inputs.plantingYear ? `${e.age} ans` : 'plantation prévue'} · ${STAGE_LABEL[e.stage ?? 'futur']}`])
  }
  rows.forEach(([k, v], i) => keyValue(k, v, col, y + 12 + i * 6.4))

  // ── Indicateurs ──
  y = 110
  sectionTitle('Estimation', y)
  const kpis: [string, string][] = [
    [e.trees ? 'Arbres' : 'Surface cultivée', e.trees ? `${nf(e.trees.count)} (${nf(e.trees.densityPerHa)}/ha)` : `${nf(e.geometry.areaHa, 2)} ha`],
    ['Production cette année', kg(e.production.kgPerYear)],
    ['Pleine production', `${kg(e.production.kgPerYearFull)} / an`],
    ["Eau d'irrigation", `${nf(e.water.irrigationM3PerYear)} m³ / an`],
    ['Revenu estimé', `${eur(e.economics.revenuePerYear)} / an (${nf(e.economics.pricePerKg, 2)} €/kg)`],
    ["Coût d'installation", eur(e.economics.installationCost)],
    ['Entretien', `${eur(e.economics.maintenancePerYear)} / an`],
    ['Retour sur investissement', e.economics.paybackYears ? `${e.economics.paybackYears} ans après plantation` : 'non atteint sur 40 ans'],
    ['CO2 absorbé', `${kg(e.co2.kgPerYear)} / an`],
  ]
  kpis.forEach(([k, v], i) => {
    const cx = i % 2 === 0 ? M : W / 2 + 2
    const cy = y + 9 + Math.floor(i / 2) * 7
    keyValue(k, v, cx, cy, 44)
  })

  // ── Graphique sur 10 ans ──
  y = 160
  sectionTitle('Production estimée sur 10 ans', y)
  const chart = { x: M, y: y + 6, w: W - 2 * M, h: 38 }
  const max = Math.max(...e.projection.map((p) => p.kg), 1)
  const bw = chart.w / e.projection.length
  e.projection.forEach((p, i) => {
    const h = (p.kg / max) * (chart.h - 10)
    doc.setFillColor(16, 185, 129)
    if (h > 0) doc.roundedRect(chart.x + i * bw + 2, chart.y + chart.h - 6 - h, bw - 4, h, 1, 1, 'F')
    doc.setFontSize(7)
    doc.setTextColor(85, 97, 120)
    text(String(p.year), chart.x + i * bw + bw / 2, chart.y + chart.h - 1, { align: 'center' })
    if (p.kg > 0) text(kg(p.kg), chart.x + i * bw + bw / 2, chart.y + chart.h - 8 - h, { align: 'center' })
  })

  // ── Analyse IA ──
  y = 212
  sectionTitle(`Analyse de l'IA${e.ai.source === 'mock' ? ' (réponse simulée)' : ''} · confiance ${Math.round(e.ai.confidence * 100)} %`, y)
  doc.setFontSize(9)
  doc.setTextColor(11, 17, 32)
  let ty = y + 8
  for (const line of doc.splitTextToSize(clean(e.ai.summary), W - 2 * M) as string[]) {
    doc.text(line, M, ty)
    ty += 4.4
  }
  ty += 1.5
  doc.setTextColor(60, 70, 90)
  for (const tip of e.ai.tips) {
    const lines = doc.splitTextToSize(clean(tip), W - 2 * M - 5) as string[]
    if (ty + lines.length * 4.2 > 276) break
    doc.setFillColor(16, 185, 129)
    doc.circle(M + 1.2, ty - 1.2, 0.9, 'F')
    lines.forEach((l, i) => doc.text(l, M + 5, ty + i * 4.2))
    ty += lines.length * 4.2 + 1.4
  }

  // ── Pied de page ──
  doc.setDrawColor(220, 226, 235)
  doc.line(M, 281, W - M, 281)
  doc.setFontSize(7.5)
  doc.setTextColor(120, 130, 150)
  const disclaimer = doc.splitTextToSize(clean(e.disclaimer), W - 2 * M) as string[]
  disclaimer.forEach((l, i) => doc.text(l, M, 285 + i * 3.4))

  doc.save(`terracalc-${slug(name)}.pdf`)

  function sectionTitle(title: string, yy: number) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(11, 17, 32)
    text(title, M, yy)
    doc.setFont('helvetica', 'normal')
  }
  function keyValue(k: string, v: string, x: number, yy: number, keyWidth = 28) {
    doc.setFontSize(9)
    doc.setTextColor(85, 97, 120)
    text(k, x, yy)
    doc.setTextColor(11, 17, 32)
    doc.setFont('helvetica', 'bold')
    text(v, x + keyWidth, yy)
    doc.setFont('helvetica', 'normal')
  }
}

/** Dessine le contour du terrain dans une boîte, en conservant ses proportions réelles */
function drawPolygon(doc: import('jspdf').jsPDF, polygon: Polygon, box: { x: number; y: number; w: number; h: number }) {
  const ring = polygon.coordinates[0]
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length
  const k = Math.cos((lat0 * Math.PI) / 180)
  const pts = ring.map(([lng, lat]) => [lng * k, lat])
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const pad = 8
  const scale = Math.min((box.w - 2 * pad) / (maxX - minX || 1), (box.h - 2 * pad) / (maxY - minY || 1))
  const ox = box.x + (box.w - (maxX - minX) * scale) / 2
  const oy = box.y + (box.h - (maxY - minY) * scale) / 2
  const proj = pts.map(([x, y]) => [ox + (x - minX) * scale, oy + (maxY - y) * scale]) // y inversé (nord en haut)

  doc.setDrawColor(16, 185, 129)
  doc.setFillColor(209, 250, 229)
  doc.setLineWidth(0.6)
  const deltas = proj.slice(1).map((p, i) => [p[0] - proj[i][0], p[1] - proj[i][1]])
  doc.lines(deltas, proj[0][0], proj[0][1], [1, 1], 'FD', true)
  proj.slice(0, -1).forEach(([x, y]) => {
    doc.setFillColor(255, 255, 255)
    doc.circle(x, y, 0.9, 'FD')
  })
  doc.setLineWidth(0.2)
  doc.setFontSize(7)
  doc.setTextColor(120, 130, 150)
  doc.text('N ↑'.replace('↑', '^'), box.x + box.w - 6, box.y + 5)
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'terrain'
