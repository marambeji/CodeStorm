import { motion } from 'framer-motion'
import { AlertTriangle, ScanLine } from 'lucide-react'

/**
 * Mini aperçus animés affichés dans les cartes "bento" de la landing.
 * Purement décoratifs (aria-hidden) : le texte de la carte décrit déjà le module.
 */

/** PlantDoc : une feuille malade passée au scanner, puis le diagnostic s'affiche. */
export function LeafScanPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto flex h-full min-h-56 w-full items-center justify-center">
      <div className="relative aspect-square w-48 sm:w-56">
        {/* Coins de visée */}
        {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'right-0 bottom-0 border-r-2 border-b-2'].map(
          (c) => (
            <span key={c} className={`absolute size-6 rounded-[4px] border-leaf/70 ${c}`} />
          ),
        )}
        <svg viewBox="0 0 120 120" className="absolute inset-4">
          <defs>
            <linearGradient id="leaf-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <path d="M60 8 C100 20 112 60 92 92 C78 112 42 112 28 92 C8 60 20 20 60 8 Z" fill="url(#leaf-g)" opacity="0.9" />
          <path d="M60 14 L60 106 M60 40 L40 28 M60 40 L82 26 M60 62 L34 50 M60 62 L88 48 M60 84 L40 76 M60 84 L82 74" stroke="#064E3B" strokeOpacity="0.45" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* Taches de maladie */}
          {[
            [44, 46, 6],
            [76, 62, 8],
            [52, 82, 5],
            [80, 36, 4],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#92400E" opacity="0.75" />
          ))}
        </svg>
        {/* Ligne de scan */}
        <div className="animate-scan absolute inset-x-2 h-0.5 rounded-full bg-leaf shadow-[0_0_16px_4px_rgb(16_185_129/0.6)]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="animate-float absolute right-2 bottom-4 rounded-2xl border bg-background/90 p-3 text-left shadow-[var(--shadow-float)] backdrop-blur sm:right-6"
      >
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScanLine className="size-3.5 text-leaf-fg" /> Diagnostic
        </p>
        <p className="mt-0.5 text-sm font-bold">Mildiou de la tomate</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-leaf"
              initial={{ width: 0 }}
              whileInView={{ width: '94%' }}
              viewport={{ once: true }}
              transition={{ delay: 0.9, duration: 1 }}
            />
          </div>
          <span className="tabular text-xs font-semibold text-leaf-fg">94 %</span>
        </div>
      </motion.div>
    </div>
  )
}

/** IrriPlan : semaine d'arrosage, une pluie annule un arrosage. */
export function IrriWeekPreview() {
  const days = [
    { d: 'Lun', m3: 0, rain: 0 },
    { d: 'Mar', m3: 72, rain: 0 },
    { d: 'Mer', m3: 0, rain: 0 },
    { d: 'Jeu', m3: 0, rain: 60 },
    { d: 'Ven', m3: 0, rain: 0 },
    { d: 'Sam', m3: 0, rain: 0 },
    { d: 'Dim', m3: 64, rain: 0 },
  ]
  return (
    <div className="space-y-3">
      <div className="flex h-28 items-end gap-1.5" aria-hidden="true">
        {days.map((x, i) => (
          <div key={x.d} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              className={x.rain ? 'w-full rounded-t-md border border-dashed border-slate-400/60 bg-slate-400/15' : 'w-full rounded-t-md bg-water'}
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(6, x.m3 || x.rain)}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
              style={{ opacity: x.m3 || x.rain ? 1 : 0.25 }}
            />
            <span className="text-[10px] text-muted-foreground">{x.d}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl border bg-background/60 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Pluie jeudi : arrosage annulé</span>
        <span className="tabular font-semibold text-leaf-fg">−31 % d’eau</span>
      </div>
    </div>
  )
}

/** AquaScan : un compteur d'eau lu par OCR, avec alerte de fuite. */
export function MeterScanPreview() {
  const digits = ['0', '1', '2', '4', '8']
  return (
    <div aria-hidden="true" className="relative flex h-full min-h-44 flex-col items-center justify-center gap-4">
      <div className="relative rounded-2xl border bg-background/80 p-3 shadow-sm">
        <div className="flex gap-1">
          {digits.map((d, i) => (
            <motion.span
              key={i}
              initial={{ y: -12, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i + 0.2 }}
              className="tabular flex h-11 w-8 items-center justify-center rounded-md bg-foreground text-xl font-bold text-background"
            >
              {d}
            </motion.span>
          ))}
          <span className="tabular flex h-11 w-8 items-center justify-center rounded-md bg-[#EF4444] text-xl font-bold text-white">6</span>
        </div>
        {/* Cadre de lecture OCR */}
        <div className="pointer-events-none absolute -inset-1.5 rounded-[1.1rem] border-2 border-dashed border-water/70" />
        <div className="animate-scan absolute inset-x-3 h-0.5 bg-water shadow-[0_0_12px_3px_rgb(14_165_233/0.6)]" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1 }}
        className="flex items-center gap-2 rounded-full bg-destructive/12 px-3 py-1.5 text-xs font-semibold text-destructive ring-1 ring-inset ring-destructive/25"
      >
        <AlertTriangle className="size-3.5" />
        Fuite possible : +240 % la nuit
      </motion.div>
    </div>
  )
}

/** TerraCalc : un terrain se dessine sur une vue "satellite", puis les arbres apparaissent en grille. */
export function TerrainDrawPreview() {
  const outline = 'M70 40 L250 28 L292 128 L196 170 L58 140 Z'
  const vertices = [
    [70, 40],
    [250, 28],
    [292, 128],
    [196, 170],
    [58, 140],
  ]
  // Grille d'arbres (on ne garde que ceux à l'intérieur, grâce au clipPath)
  const trees: [number, number, number][] = [] // [x, y, numéro du rang]
  for (let y = 46, row = 0; y < 168; y += 16, row++) for (let x = 66; x < 292; x += 18) trees.push([x + ((y / 16) % 2) * 4, y, row])

  return (
    <div aria-hidden="true" className="relative w-full overflow-hidden rounded-2xl border bg-[#2c3b2a]">
      <svg viewBox="0 0 340 200" className="block h-auto w-full">
        <defs>
          <clipPath id="tc-clip">
            <path d={outline} />
          </clipPath>
        </defs>
        {/* Parcelles façon image satellite */}
        <rect width="340" height="200" fill="#3d4a35" />
        {[
          [0, 0, 120, 70, '#55613f'],
          [120, 0, 140, 50, '#6b6a45'],
          [260, 0, 80, 90, '#4a5a3a'],
          [0, 70, 90, 130, '#5d5b3b'],
          [90, 50, 170, 150, '#7a6c48'],
          [260, 90, 80, 110, '#3f5236'],
        ].map(([x, y, w, h, c]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={c as string} opacity="0.9" />
        ))}
        <path d="M0 186 C80 176 160 196 340 180" stroke="#c9b98a" strokeWidth="5" fill="none" opacity="0.55" />
        {/* Arbres */}
        <g clipPath="url(#tc-clip)">
          {trees.map(([x, y, row], i) => (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r="3.6"
              fill="#10B981"
              stroke="#ffffff"
              strokeWidth="1"
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.3 + row * 0.08, duration: 0.3 }} // les arbres apparaissent rang par rang
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          ))}
        </g>
        {/* Contour qui se dessine */}
        <motion.path
          d={outline}
          fill="#10B981"
          fillOpacity="0.12"
          stroke="#10B981"
          strokeWidth="2.5"
          strokeLinejoin="round"
          initial={{ pathLength: 0, fillOpacity: 0 }}
          whileInView={{ pathLength: 1, fillOpacity: 0.12 }}
          viewport={{ once: true }}
          transition={{ duration: 1.3, ease: 'easeInOut' }}
        />
        {vertices.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r="5"
            fill="#ffffff"
            stroke="#10B981"
            strokeWidth="2.5"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.25, type: 'spring', stiffness: 400 }}
            style={{ transformOrigin: `${x}px ${y}px` }}
          />
        ))}
      </svg>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 1.8 }}
        className="absolute top-3 left-3 flex flex-wrap gap-2"
      >
        <span className="rounded-lg bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">2,41 ha</span>
        <span className="rounded-lg bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">688 oliviers</span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 2.1 }}
        className="absolute right-3 bottom-3 rounded-xl bg-background/90 px-3 py-2 text-right shadow-lg backdrop-blur"
      >
        <p className="text-[0.65rem] text-muted-foreground">Production estimée</p>
        <p className="tabular text-sm font-extrabold text-leaf-fg">20,6 t / an</p>
      </motion.div>
    </div>
  )
}
