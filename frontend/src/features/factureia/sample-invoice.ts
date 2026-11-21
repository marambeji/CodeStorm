/**
 * Génère une facture d'électricité d'exemple (PDF), pour démontrer la lecture automatique
 * sans document personnel. Fournisseur fictif "ÉnergiePlus".
 */
export async function sampleInvoicePdf(after?: string): Promise<File> {
  const { jsPDF } = await import('jspdf')
  const start = after ? new Date(new Date(after).getTime() + 86_400_000) : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() - 1, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'UTC' })
  const hp = 380 + Math.round(Math.random() * 120)
  const hc = 120 + Math.round(Math.random() * 60)
  const total = hp + hc
  const amount = (12.68 + (hp * 0.27 + hc * 0.2068) * 1.18).toFixed(2).replace('.', ',')

  const doc = new jsPDF()
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text("ÉnergiePlus - Facture d'électricité", 16, 18)
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(11)
  const lines = [
    'Fournisseur : ÉnergiePlus',
    'Référence client : 0042 1337 · Document d’exemple (EcoNexus)',
    `Période de consommation du ${fmt(start)} au ${fmt(end)}`,
    'Puissance souscrite : 6 kVA - Option Heures Pleines / Heures Creuses',
    '',
    `Heures pleines : ${hp} kWh`,
    `Heures creuses : ${hc} kWh`,
    `Consommation totale : ${total} kWh`,
    '',
    `Total TTC : ${amount} €`,
  ]
  lines.forEach((l, i) => doc.text(l, 16, 44 + i * 9))
  const blob = doc.output('blob')
  return new File([blob], `facture-exemple-${end.toISOString().slice(0, 7)}.pdf`, { type: 'application/pdf' })
}
