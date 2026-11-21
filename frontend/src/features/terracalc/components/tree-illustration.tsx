import { motion } from 'framer-motion'
import type { Stage } from '../types'

/**
 * Illustrations ORIGINALES des espèces (SVG dessinés en code, aucune photo).
 * L'arbre grandit selon son stade : pousse → jeune → adulte → pleine production.
 */
type Shape = 'round' | 'bush' | 'wide' | 'palm' | 'vine' | 'wheat'
interface Look {
  shape: Shape
  leaf: string
  leaf2: string
  trunk: string
  fruit?: string
  blossom?: string
  twisted?: boolean
}

const LOOKS: Record<string, Look> = {
  olivier: { shape: 'round', leaf: '#93AE80', leaf2: '#6F8F5F', trunk: '#7A5A3A', fruit: '#3F3A52', twisted: true },
  'palmier-dattier': { shape: 'palm', leaf: '#3E9B5A', leaf2: '#2F7D46', trunk: '#9A7346', fruit: '#B45309' },
  amandier: { shape: 'round', leaf: '#7CC46B', leaf2: '#5FA552', trunk: '#6B4A2F', blossom: '#F9C9D9' },
  agrumes: { shape: 'round', leaf: '#2F8F4E', leaf2: '#24733F', trunk: '#6B4A2F', fruit: '#F59E0B' },
  grenadier: { shape: 'bush', leaf: '#4DAA5C', leaf2: '#3A8C4A', trunk: '#6B4A2F', fruit: '#DC2626' },
  figuier: { shape: 'wide', leaf: '#56A05B', leaf2: '#3F8547', trunk: '#8A6A4A', fruit: '#7C3AED' },
  vigne: { shape: 'vine', leaf: '#5BAF4F', leaf2: '#438F3B', trunk: '#7A5A3A', fruit: '#6D28D9' },
  ble: { shape: 'wheat', leaf: '#D4A72C', leaf2: '#B7891C', trunk: '#C9A23A' },
}

const SCALE: Record<Stage, number> = { futur: 0.32, jeune: 0.52, adulte: 0.78, mature: 1, declin: 0.96 }

export function TreeIllustration({ speciesId, stage = 'mature', className }: { speciesId: string; stage?: Stage; className?: string }) {
  const look = LOOKS[speciesId] ?? LOOKS.olivier
  const s = SCALE[stage]
  const withFruit = stage === 'adulte' || stage === 'mature' || stage === 'declin'
  const sprout = stage === 'futur'

  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={`Illustration : ${speciesId}, stade ${stage}`}>
      <ellipse cx="60" cy="110" rx={18 + 22 * s} ry="4" className="fill-foreground/10" />
      <motion.g
        initial={false}
        animate={{ scale: s, opacity: stage === 'declin' ? 0.85 : 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        style={{ originX: '60px', originY: '110px' }}
      >
        {sprout ? <Sprout look={look} /> : <Plant look={look} fruit={withFruit} />}
      </motion.g>
    </svg>
  )
}

function Sprout({ look }: { look: Look }) {
  return (
    <g>
      <path d="M60 110 C60 96 60 88 60 76" stroke={look.shape === 'wheat' ? look.leaf2 : '#4D7C3A'} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M60 86 C48 80 42 70 46 62 C56 64 62 74 60 86 Z" fill={look.leaf} />
      <path d="M60 80 C72 74 78 64 74 56 C64 58 58 68 60 80 Z" fill={look.leaf2} />
    </g>
  )
}

function Plant({ look, fruit }: { look: Look; fruit: boolean }) {
  switch (look.shape) {
    case 'palm':
      return (
        <g>
          <path d="M57 110 L59 36 L63 36 L65 110 Z" fill={look.trunk} />
          {[48, 60, 72, 84, 96].map((y) => (
            <path key={y} d={`M57 ${y} L65 ${y - 4}`} stroke="#000" strokeOpacity="0.18" strokeWidth="2" />
          ))}
          {[-150, -120, -90, -60, -30, -170, -10].map((a, i) => {
            const r = 34
            const rad = (a * Math.PI) / 180
            const x = 61 + r * Math.cos(rad)
            const y = 36 + r * Math.sin(rad) + 18
            return <path key={a} d={`M61 36 Q${61 + (x - 61) * 0.5} ${30 + (y - 36) * 0.1} ${x} ${y}`} stroke={i % 2 ? look.leaf : look.leaf2} strokeWidth="7" strokeLinecap="round" fill="none" />
          })}
          {fruit && (
            <g fill={look.fruit}>
              {[[54, 44], [58, 47], [64, 47], [68, 44], [61, 50]].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" />
              ))}
            </g>
          )}
        </g>
      )
    case 'vine':
      return (
        <g>
          <rect x="22" y="40" width="3" height="70" rx="1" className="fill-foreground/30" />
          <rect x="95" y="40" width="3" height="70" rx="1" className="fill-foreground/30" />
          <path d="M22 52 L98 52" className="stroke-foreground/30" strokeWidth="1.5" />
          <path d="M60 110 C56 96 66 84 58 70 C54 62 62 56 60 52" stroke={look.trunk} strokeWidth="5" strokeLinecap="round" fill="none" />
          {[30, 42, 54, 66, 78, 90].map((x, i) => (
            <circle key={x} cx={x} cy={52 + (i % 2 ? 4 : -3)} r="8" fill={i % 2 ? look.leaf : look.leaf2} />
          ))}
          {fruit && (
            <g fill={look.fruit}>
              {[40, 72].map((x) =>
                [[0, 0], [-3, 0], [3, 0], [-1.5, 3.5], [1.5, 3.5], [0, 7]].map(([dx, dy]) => <circle key={`${x}-${dx}-${dy}`} cx={x + dx} cy={62 + dy} r="2.2" />),
              )}
            </g>
          )}
        </g>
      )
    case 'wheat':
      return (
        <g>
          {[36, 46, 56, 66, 76, 86].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 110 Q${x + (i % 2 ? 3 : -3)} 80 ${x + (i % 2 ? 4 : -2)} ${48 + (i % 3) * 4}`} stroke={look.trunk} strokeWidth="2" fill="none" />
              {[0, 5, 10, 15].map((dy) => (
                <ellipse key={dy} cx={x + (i % 2 ? 4 : -2)} cy={44 + (i % 3) * 4 + dy} rx="3" ry="4.5" fill={dy % 10 ? look.leaf : look.leaf2} />
              ))}
            </g>
          ))}
        </g>
      )
    case 'wide':
      return (
        <g>
          <path d="M55 110 C56 92 54 80 50 70 L70 70 C66 80 64 92 65 110 Z" fill={look.trunk} />
          <ellipse cx="60" cy="58" rx="40" ry="20" fill={look.leaf2} />
          {[[34, 56, 14], [52, 46, 16], [72, 48, 15], [88, 58, 12], [60, 62, 16]].map(([cx, cy, r]) => (
            <circle key={`${cx}`} cx={cx} cy={cy} r={r} fill={look.leaf} />
          ))}
          {fruit && <Fruits color={look.fruit!} points={[[40, 60], [58, 54], [76, 60], [66, 66], [48, 66]]} r={3.4} />}
        </g>
      )
    case 'bush':
      return (
        <g>
          {[-8, 0, 8].map((dx) => (
            <path key={dx} d={`M60 110 Q${60 + dx} 90 ${60 + dx * 1.8} 66`} stroke={look.trunk} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          ))}
          {[[44, 62, 15], [60, 52, 18], [76, 62, 15], [52, 72, 13], [70, 72, 13]].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 ? look.leaf : look.leaf2} />
          ))}
          {fruit && <Fruits color={look.fruit!} points={[[46, 64], [62, 54], [74, 66], [58, 74]]} r={4} />}
        </g>
      )
    default: {
      // Arbre à couronne ronde (olivier, amandier, agrumes)
      const trunk = look.twisted ? 'M56 110 C52 96 64 88 58 76 C55 70 60 66 60 62 L64 62 C64 68 62 72 64 78 C70 90 62 98 66 110 Z' : 'M57 110 L58 64 L63 64 L64 110 Z'
      return (
        <g>
          <path d={trunk} fill={look.trunk} />
          {[[60, 46, 24], [40, 56, 17], [80, 56, 17], [50, 34, 15], [72, 36, 15], [60, 62, 16]].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 ? look.leaf : look.leaf2} />
          ))}
          {fruit && look.fruit && <Fruits color={look.fruit} points={[[44, 54], [58, 40], [74, 50], [66, 62], [52, 62], [80, 60]]} r={look.fruit === '#3F3A52' ? 2.4 : 3.6} />}
          {look.blossom && (
            <g fill={look.blossom}>
              {[[42, 46], [54, 30], [70, 32], [82, 50], [60, 52], [48, 60], [72, 62]].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.8" />
              ))}
            </g>
          )}
        </g>
      )
    }
  }
}

function Fruits({ color, points, r }: { color: string; points: number[][]; r: number }) {
  return (
    <g fill={color}>
      {points.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </g>
  )
}
