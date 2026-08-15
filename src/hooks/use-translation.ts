'use client'

import { useLocaleStore } from '@/stores/locale-store'
import { translations, type TranslationKey } from '@/lib/i18n/translations'

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale)

  const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
    const raw = translations[locale][key] ?? translations.en[key] ?? key
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
    )
  }

  const isRTL = locale === 'ar-EG'

  return { t, locale, isRTL }
}
