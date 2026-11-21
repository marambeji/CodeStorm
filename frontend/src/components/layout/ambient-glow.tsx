import { motion } from 'framer-motion'
import { toneHex, type Tone } from '@/lib/modules'

/**
 * LA signature visuelle d'EcoNexus : une lumière ambiante en haut de l'écran.
 * - Sur le dashboard : trois lumières (vert, bleu, ambre) qui coexistent.
 * - Dans un module : les trois lumières prennent la couleur du module.
 * La transition de couleur se fait en douceur quand on change de page.
 *
 * Astuce perf : on anime la propriété CSS `color`, utilisée par un dégradé radial
 * (`currentColor`). C'est bien plus léger qu'un filtre `blur()` animé, surtout sur mobile.
 */
const BLOBS: { tone: Tone; className: string }[] = [
  { tone: 'leaf', className: '-left-[10%] -top-40 h-[28rem] w-[55%]' },
  { tone: 'water', className: 'left-[25%] -top-56 h-[30rem] w-[50%]' },
  { tone: 'energy', className: '-right-[10%] -top-40 h-[26rem] w-[50%]' },
]

export function AmbientGlow({ tone }: { tone?: Tone }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] overflow-hidden">
      {BLOBS.map((blob) => (
        <motion.div
          key={blob.tone}
          className={`absolute rounded-full opacity-[0.16] dark:opacity-[0.22] ${blob.className}`}
          style={{ background: 'radial-gradient(closest-side, currentColor, transparent)' }}
          initial={false}
          animate={{ color: toneHex[tone ?? blob.tone] }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      {/* Fondu vers le fond pour que la lumière ne "coupe" pas */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </div>
  )
}
