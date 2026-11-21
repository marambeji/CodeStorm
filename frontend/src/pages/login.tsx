import { motion } from 'framer-motion'
import { Droplets, Eye, EyeOff, Gauge, LandPlot, Leaf, Loader2, PlayCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { Aurora, GridBackdrop, Noise } from '@/components/fx/background-fx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthActions } from '@/features/auth/auth'
import { apiErrorMessage } from '@/features/terracalc/api'
import { authToken } from '@/lib/api'
import { cn } from '@/lib/utils'

const DEMO = { email: 'demo@econexus.app', password: 'Demo2026!' }

const POINTS = [
  { icon: Leaf, text: 'Diagnostic des maladies sur photo de feuille', tone: 'text-leaf-fg bg-leaf/12' },
  { icon: LandPlot, text: 'Estimation de vos terrains depuis le satellite', tone: 'text-leaf-fg bg-leaf/12' },
  { icon: Droplets, text: 'Planning d’irrigation avec la météo réelle', tone: 'text-water-fg bg-water/12' },
  { icon: Gauge, text: 'Relevé du compteur d’eau et alerte de fuite', tone: 'text-water-fg bg-water/12' },
]

/** Connexion / création de compte : chaque agriculteur retrouve ses propres données */
export default function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const auth = useAuthActions()
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'inscription' ? 'register' : 'login')
  const [form, setForm] = useState({ name: '', farmName: '', email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [pending, setPending] = useState<'form' | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const next = params.get('suite')?.startsWith('/app') ? params.get('suite')! : '/app'

  if (authToken.get() && !pending) return <Navigate to={next} replace />

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function run(kind: 'form' | 'demo', fn: () => Promise<void>, welcome: string) {
    setError(null)
    setPending(kind)
    try {
      await fn()
      toast.success(welcome)
      navigate(next, { replace: true })
    } catch (e) {
      setError(apiErrorMessage(e))
      setPending(null)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'register') {
      if (form.name.trim().length < 2) return setError('Indiquez votre nom (2 caractères minimum).')
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
        return setError('Le mot de passe doit faire au moins 8 caractères, avec au moins une lettre et un chiffre.')
      run('form', () => auth.register({ name: form.name.trim(), email: form.email.trim(), password: form.password, farmName: form.farmName.trim() || undefined }), `Bienvenue ${form.name.trim().split(' ')[0]} !`)
    } else {
      run('form', () => auth.login(form.email.trim(), form.password), 'Connexion réussie')
    }
  }

  return (
    <div className="relative grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Présentation */}
      <aside className="relative hidden overflow-hidden border-e bg-muted/30 p-10 lg:flex lg:flex-col lg:justify-between">
        <Aurora />
        <GridBackdrop />
        <Noise />
        <Logo className="relative" />
        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">Vos cultures, votre eau et vos terrains, au même endroit.</h2>
          <ul className="space-y-3">
            {POINTS.map(({ icon: Icon, text, tone }, i) => (
              <motion.li key={text} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="flex items-center gap-3 text-sm">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </motion.li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Chaque compte a ses propres données : terrains, diagnostics, plans et compteurs.</p>
      </aside>

      {/* Formulaire */}
      <main className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-2 lg:hidden">
            <Logo />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight">{mode === 'login' ? 'Bon retour' : 'Créer votre compte'}</h1>
            <p className="text-sm text-muted-foreground">{mode === 'login' ? 'Connectez-vous pour retrouver vos données.' : 'Gratuit. Vos données restent privées.'}</p>
          </div>

          <div role="tablist" aria-label="Connexion ou inscription" className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={cn('rounded-lg py-2 transition-colors', mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {m === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'register' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lg-name">Votre nom</Label>
                  <Input id="lg-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" placeholder="Ex : Salim Ben Ali" maxLength={40} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lg-farm">Exploitation (facultatif)</Label>
                  <Input id="lg-farm" value={form.farmName} onChange={(e) => set('farmName', e.target.value)} placeholder="Ex : Ferme des Oliviers" maxLength={60} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="lg-email">Adresse e-mail</Label>
              <Input id="lg-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder="vous@exemple.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lg-pwd">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="lg-pwd"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="pe-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPwd ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
              {mode === 'register' && <p className="text-xs text-muted-foreground">8 caractères minimum, avec au moins une lettre et un chiffre.</p>}
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={pending !== null}>
              {pending === 'form' && <Loader2 className="animate-spin" aria-hidden="true" />}
              {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" size="lg" className="w-full" disabled={pending !== null} onClick={() => run('demo', () => auth.login(DEMO.email, DEMO.password), 'Compte de démo ouvert')}>
            {pending === 'demo' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
            Essayer avec le compte de démo
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Démo : {DEMO.email} · {DEMO.password}
          </p>
        </div>
      </main>
    </div>
  )
}
