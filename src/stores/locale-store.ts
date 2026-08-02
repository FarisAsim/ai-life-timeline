import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '@/lib/i18n/translations'

interface LocaleState {
  locale: Locale
  setLocale: (l: Locale) => void
  toggle: () => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (l) => set({ locale: l }),
      toggle: () => set((s) => ({ locale: s.locale === 'en' ? 'ar-EG' : 'en' })),
    }),
    { name: 'life-timeline-locale' },
  ),
)
