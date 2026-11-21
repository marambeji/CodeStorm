import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { formatEur, formatKg } from '../geo'
import type { Estimate } from '../types'

/**
 * Production estimée sur 10 ans : une seule série → barres d'une seule teinte (vert),
 * pas de légende (le titre nomme la série), grille discrète, info-bulle au survol.
 */
export function ProductionChart({ projection }: { projection: Estimate['projection'] }) {
  const data = projection.map((p) => ({ ...p, t: p.kg / 1000 }))
  const max = Math.max(...data.map((d) => d.t))
  const unitTonnes = max >= 1

  return (
    <figure className="space-y-3">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Production estimée sur 10 ans</span>
        <span className="text-xs text-muted-foreground">{unitTonnes ? 'tonnes / an' : 'kg / an'}</span>
      </figcaption>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={(v: number) => (unitTonnes ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v) : String(Math.round(v * 1000)))}
            />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<ChartTooltip />} />
            <Bar dataKey="t" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Version texte pour les lecteurs d'écran */}
      <table className="sr-only">
        <caption>Production estimée par année</caption>
        <thead>
          <tr>
            <th>Année</th>
            <th>Production</th>
            <th>Revenu</th>
          </tr>
        </thead>
        <tbody>
          {projection.map((p) => (
            <tr key={p.year}>
              <td>{p.year}</td>
              <td>{formatKg(p.kg)}</td>
              <td>{formatEur(p.revenueEur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as Estimate['projection'][number]
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-float)]">
      <p className="font-semibold">
        {p.year}
        {p.age !== null && <span className="font-normal text-muted-foreground"> · arbres de {Math.max(p.age, 0)} ans</span>}
      </p>
      <p className="tabular mt-1">
        <span className="mr-1.5 inline-block size-2 rounded-[2px] bg-leaf" aria-hidden="true" />
        {formatKg(p.kg)} · {formatEur(p.revenueEur)}
      </p>
    </div>
  )
}
