import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LANGS, resources, type Lang } from './locales'

/**
 * Multilingue (français, anglais, arabe).
 * - Langue mémorisée dans le navigateur, sinon celle du système, sinon le français
 * - L'arabe passe la page en sens de lecture droite → gauche (dir="rtl")
 */
const KEY = 'lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null
    if (saved && LANGS.includes(saved)) return saved
  } catch {
    /* stockage indisponible */
  }
  const nav = navigator.language.slice(0, 2) as Lang
  return LANGS.includes(nav) ? nav : 'fr'
}

function applyToDocument(lang: string) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false }, // React protège déjà contre l'injection HTML
})

applyToDocument(i18n.language)
i18n.on('languageChanged', (lang) => {
  applyToDocument(lang)
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* non bloquant */
  }
})

/** Locale à utiliser pour les dates et nombres (Intl) */
export const intlLocale = (lang: string) => (lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-FR')

export default i18n
