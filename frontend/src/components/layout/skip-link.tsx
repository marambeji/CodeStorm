import { useTranslation } from 'react-i18next'

/** Lien "Aller au contenu" : invisible, sauf au clavier (Tab), pour sauter la navigation. */
export function SkipLink() {
  const { t } = useTranslation()
  return (
    <a
      href="#contenu"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
    >
      {t('nav.skip')}
    </a>
  )
}
