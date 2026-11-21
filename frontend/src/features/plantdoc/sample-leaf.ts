/**
 * Génère une photo de feuille d'exemple (dessinée sur un canvas) pour tester PlantDoc
 * sans avoir de plante sous la main : feuille saine, ou malade avec des taches.
 */
export async function sampleLeaf(kind: 'malade' | 'saine' = 'malade'): Promise<File> {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 480
  const ctx = c.getContext('2d')!
  // Fond : sol / paillage flou
  const bg = ctx.createLinearGradient(0, 0, 640, 480)
  bg.addColorStop(0, '#d9d4c7')
  bg.addColorStop(1, '#bfb6a3')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 640, 480)

  // Feuille
  ctx.save()
  ctx.translate(320, 240)
  ctx.rotate(-0.35)
  ctx.beginPath()
  ctx.moveTo(-230, 0)
  ctx.bezierCurveTo(-120, -170, 140, -170, 240, 0)
  ctx.bezierCurveTo(140, 170, -120, 170, -230, 0)
  const leaf = ctx.createLinearGradient(-200, -120, 200, 120)
  leaf.addColorStop(0, '#4f9a3a')
  leaf.addColorStop(1, '#2f7a2c')
  ctx.fillStyle = leaf
  ctx.fill()
  // Nervures
  ctx.strokeStyle = 'rgba(210, 235, 190, 0.55)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-220, 0)
  ctx.lineTo(230, 0)
  ctx.stroke()
  ctx.lineWidth = 2
  for (let x = -150; x <= 150; x += 60) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 50, -80)
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 50, 80)
    ctx.stroke()
  }
  // Taches de maladie (brunes à halo jaune)
  if (kind === 'malade') {
    const spots = [
      [-120, -40, 26], [-60, 50, 34], [20, -60, 22], [90, 30, 38], [150, -20, 20], [-10, 20, 18], [60, 85, 16], [-150, 40, 18],
    ]
    for (const [x, y, r] of spots) {
      ctx.fillStyle = 'rgba(214, 190, 60, 0.85)'
      ctx.beginPath()
      ctx.arc(x, y, r * 1.35, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#5b3a1c'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
  const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', 0.9))
  return new File([blob], `feuille-${kind}.jpg`, { type: 'image/jpeg' })
}
