'use client'

import { useLocaleStore } from '@/stores/locale-store'
import { translations, type TranslationKey } from '@/lib/i18n/translations'

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale)

  const t = (key: TranslationKey): string => {
    return translations[locale][key] ?? translations.en[key] ?? key
  }

  const isRTL = locale === 'ar-EG'

  return { t, locale, isRTL }
}
