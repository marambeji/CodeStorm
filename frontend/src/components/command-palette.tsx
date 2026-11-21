import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Bot, Camera, FileUp, Gauge, Languages, LayoutDashboard, Leaf, Map, MoonStar, Palette, Receipt, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/components/theme/theme-provider'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LANGS } from '@/i18n/locales'
import { api } from '@/lib/api'
import { onAppEvent, openAssistant } from '@/lib/events'
import { MODULES, toneHex } from '@/lib/modules'

interface SearchData {
  diagnoses: { id: string; disease: string; parcel: string }[]
  invoices: { id: string; label: string; amount: number }[]
  terrains: { id: string; name: string; species: { name: string } | null }[]
}

/**
 * Palette de commandes (Ctrl+K / ⌘K) : aller à une page, lancer une action,
 * retrouver un diagnostic, une facture ou un terrain. Tout au clavier.
 */
export function CommandPalette() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  // Raccourci clavier + ouverture depuis un bouton (événement global)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    const off = onAppEvent('palette', () => setOpen(true))
    return () => {
      window.removeEventListener('keydown', onKey)
      off()
    }
  }, [])

  // Les données ne sont chargées qu'à l'ouverture de la palette
  const data = useQuery({
    queryKey: ['palette-search'],
    enabled: open,
    staleTime: 30_000,
    queryFn: async (): Promise<SearchData> => {
      const [diagnoses, invoices, terrains] = await Promise.all([
        api.get('/plant/history').then((r) => r.data).catch(() => []),
        api.get('/invoice').then((r) => r.data).catch(() => []),
        api.get('/terrains').then((r) => r.data).catch(() => []),
      ])
      return { diagnoses, invoices, terrains }
    },
  })

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">{t('search.button')}</DialogTitle>
        <DialogDescription className="sr-only">{t('search.placeholder')}</DialogDescription>
        <Command label={t('search.button')} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input autoFocus placeholder={t('search.placeholder')} className="h-14 w-full bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground" />
            <kbd className="hidden rounded border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground sm:block">Esc</kbd>
          </div>
          <Command.List className="max-h-[min(60svh,420px)] overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-muted-foreground">{t('search.empty')}</Command.Empty>

            <Command.Group heading={t('search.pages')}>
              <Item icon={<LayoutDashboard />} onSelect={run(() => navigate('/app'))}>
                {t('nav.overview')}
              </Item>
              {MODULES.map((m) => (
                <Item key={m.id} icon={<m.icon style={{ color: toneHex[m.tone] }} />} onSelect={run(() => navigate(m.path))} keywords={[t(`modules.${m.id}.tagline`)]}>
                  {m.name}
                  <span className="ms-2 truncate text-xs text-muted-foreground">{t(`themes.${m.theme}`)}</span>
                </Item>
              ))}
              <Item icon={<Palette />} onSelect={run(() => navigate('/app/kit'))}>
                {t('user.kit')}
              </Item>
            </Command.Group>

            <Command.Group heading={t('search.actions')}>
              <Item icon={<Bot />} onSelect={run(openAssistant)}>
                {t('search.openAssistant')}
              </Item>
              <Item icon={<Camera />} onSelect={run(() => navigate('/app/plantdoc'))}>
                {t('search.newDiagnosis')}
              </Item>
              <Item icon={<Map />} onSelect={run(() => navigate('/app/terracalc/nouveau'))}>
                {t('search.newTerrain')}
              </Item>
              <Item icon={<FileUp />} onSelect={run(() => navigate('/app/factureia'))}>
                {t('search.analyzeInvoice')}
              </Item>
              <Item icon={<Gauge />} onSelect={run(() => navigate('/app/aquascan'))}>
                {t('search.newReading')}
              </Item>
              <Item icon={<MoonStar />} onSelect={run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}>
                {t('search.toggleTheme')}
              </Item>
              {LANGS.filter((l) => l !== i18n.language).map((l) => (
                <Item key={l} icon={<Languages />} onSelect={run(() => i18n.changeLanguage(l))} keywords={['langue', 'language', l]}>
                  {t('search.language', { lang: t(`lang.${l}`) })}
                </Item>
              ))}
            </Command.Group>

            {data.data && data.data.diagnoses.length > 0 && (
              <Command.Group heading={t('search.diagnoses')}>
                {data.data.diagnoses.slice(0, 20).map((d) => (
                  <Item key={d.id} value={`diag-${d.id} ${d.disease} ${d.parcel}`} icon={<Leaf className="text-leaf-fg" />} onSelect={run(() => navigate('/app/plantdoc'))}>
                    {d.disease}
                    <span className="ms-2 truncate text-xs text-muted-foreground">{d.parcel}</span>
                  </Item>
                ))}
              </Command.Group>
            )}
            {data.data && data.data.invoices.length > 0 && (
              <Command.Group heading={t('search.invoices')}>
                {[...data.data.invoices].reverse().slice(0, 12).map((inv) => (
                  <Item key={inv.id} value={`inv-${inv.id} ${inv.label}`} icon={<Receipt className="text-energy-fg" />} onSelect={run(() => navigate('/app/factureia'))}>
                    {inv.label}
                    <span className="ms-2 text-xs text-muted-foreground">{Math.round(inv.amount)} €</span>
                  </Item>
                ))}
              </Command.Group>
            )}
            {data.data && data.data.terrains.length > 0 && (
              <Command.Group heading={t('search.terrains')}>
                {data.data.terrains.map((ter) => (
                  <Item key={ter.id} value={`ter-${ter.id} ${ter.name} ${ter.species?.name ?? ''}`} icon={<Map className="text-leaf-fg" />} onSelect={run(() => navigate(`/app/terracalc/${ter.id}`))}>
                    {ter.name}
                    <span className="ms-2 text-xs text-muted-foreground">{ter.species?.name}</span>
                  </Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function Item({ icon, children, onSelect, value, keywords }: { icon: ReactNode; children: ReactNode; onSelect: () => void; value?: string; keywords?: string[] }) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="flex min-w-0 flex-1 items-baseline">{children}</span>
    </Command.Item>
  )
}
