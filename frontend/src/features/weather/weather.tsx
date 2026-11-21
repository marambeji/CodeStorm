import { useQuery } from '@tanstack/react-query'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, Sun, Wind, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SpotlightCard } from '@/components/fx/spotlight-card'
import { Skeleton } from '@/components/ui/skeleton'
import { intlLocale } from '@/i18n'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Météo réelle via Open-Meteo (gratuit, sans clé, appelé directement depuis le navigateur).
 * Lieu : le centre de votre premier terrain TerraCalc, sinon Sfax (terrain de démo).
 * Les conseils agricoles sont déduits par des règles simples (pluie, chaleur, humidité, ET₀).
 */
interface Forecast {
  current: { temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; et0_fao_evapotranspiration: number[] }
}

const DEFAULT_PLACE = { name: 'Sfax', lat: 34.74, lng: 10.76 }

/** Codes météo WMO → icône */
function weatherIcon(code: number): LucideIcon {
  if (code === 0) return Sun
  if (code <= 2) return CloudSun
  if (code === 3) return Cloud
  if (code <= 48) return CloudFog
  if (code <= 57) return CloudDrizzle
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain
  if (code <= 77 || code === 85 || code === 86) return CloudSnow
  return CloudLightning
}

function usePlace() {
  return useQuery({
    queryKey: ['weather-place'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      try {
        const terrains = (await api.get<{ name: string; centroidLat: number; centroidLng: number }[]>('/terrains')).data
        const t = terrains[0]
        return t ? { name: t.name, lat: t.centroidLat, lng: t.centroidLng } : DEFAULT_PLACE
      } catch {
        return DEFAULT_PLACE
      }
    },
  })
}

export function useWeather() {
  const place = usePlace()
  const forecast = useQuery({
    queryKey: ['weather', place.data?.lat, place.data?.lng],
    enabled: Boolean(place.data),
    staleTime: 30 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { lat, lng } = place.data!
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=auto&forecast_days=5'
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      return (await res.json()) as Forecast
    },
  })
  return { place: place.data, forecast }
}

/** Conseil agricole déduit de la prévision (règles simples, explicables) */
function farmTip(f: Forecast): 'rain' | 'mildew' | 'heat' | 'dry' | 'ok' {
  const rain = f.daily.precipitation_sum.slice(0, 3).reduce((s, v) => s + v, 0)
  const maxT = Math.max(...f.daily.temperature_2m_max.slice(0, 3))
  if (rain >= 5) return 'rain'
  if (f.current.relative_humidity_2m >= 80 && f.current.temperature_2m >= 12 && f.current.temperature_2m <= 26) return 'mildew'
  if (maxT >= 35) return 'heat'
  if (f.daily.et0_fao_evapotranspiration.slice(0, 3).reduce((s, v) => s + v, 0) / 3 >= 4) return 'dry'
  return 'ok'
}

export function WeatherWidget({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t, i18n } = useTranslation()
  const { place, forecast } = useWeather()
  const f = forecast.data
  const locale = intlLocale(i18n.language)

  if (forecast.isPending) return <Skeleton className={cn('h-44 rounded-3xl', className)} />
  if (!f || forecast.isError)
    return (
      <SpotlightCard color="#0EA5E9" className={cn('flex items-center gap-3 p-5 text-sm text-muted-foreground', className)}>
        <Cloud className="size-5" aria-hidden="true" /> {t('weather.unavailable')}
      </SpotlightCard>
    )

  const Icon = weatherIcon(f.current.weather_code)
  const tip = farmTip(f)
  const rain5 = f.daily.precipitation_sum.reduce((s, v) => s + v, 0)
  const et0 = f.daily.et0_fao_evapotranspiration.reduce((s, v) => s + v, 0)

  return (
    <SpotlightCard color="#0EA5E9" className={cn('p-5 sm:p-6', className)}>
      <div className={cn('flex flex-col gap-5', !compact && 'lg:flex-row lg:items-center')}>
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-water/25 to-energy/15 text-water-fg">
            <Icon className="size-8" aria-hidden="true" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" /> {t('weather.title')} {t('weather.at', { place: place?.name ?? '' })}
            </p>
            <p className="tabular text-4xl font-extrabold tracking-tight">{Math.round(f.current.temperature_2m)}°C</p>
            <p className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Droplets className="size-3.5" aria-hidden="true" /> {t('weather.humidity')} {f.current.relative_humidity_2m} %
              </span>
              <span className="flex items-center gap-1">
                <Wind className="size-3.5" aria-hidden="true" /> {t('weather.wind')} {Math.round(f.current.wind_speed_10m)} km/h
              </span>
            </p>
          </div>
        </div>

        {/* Prévisions 5 jours */}
        <ol className={cn('grid grid-cols-5 gap-1.5', !compact && 'lg:flex-1')}>
          {f.daily.time.map((day, i) => {
            const DayIcon = weatherIcon(f.daily.weather_code[i])
            return (
              <li key={day} className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 px-1 py-2 text-center">
                <span className="text-[0.7rem] font-semibold text-muted-foreground">{new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' })}</span>
                <DayIcon className="size-5 text-water-fg" aria-hidden="true" />
                <span className="tabular text-xs font-bold">
                  {Math.round(f.daily.temperature_2m_max[i])}° <span className="font-normal text-muted-foreground">{Math.round(f.daily.temperature_2m_min[i])}°</span>
                </span>
                {f.daily.precipitation_sum[i] > 0.2 && <span className="tabular text-[0.65rem] text-water-fg">{f.daily.precipitation_sum[i].toFixed(1)} mm</span>}
              </li>
            )
          })}
        </ol>

        <div className={cn('space-y-2', !compact && 'lg:w-64')}>
          <p className={cn('rounded-xl px-3 py-2 text-sm', tip === 'ok' ? 'bg-leaf/10' : tip === 'mildew' || tip === 'heat' ? 'bg-orange-500/12' : 'bg-water/10')}>{t(`weather.tips.${tip}`)}</p>
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t('weather.rain5')} : <strong className="tabular text-foreground">{rain5.toFixed(1)} mm</strong>
            </span>
            <span>
              {t('weather.et0')} : <strong className="tabular text-foreground">{et0.toFixed(1)} mm</strong>
            </span>
          </p>
        </div>
      </div>
    </SpotlightCard>
  )
}
