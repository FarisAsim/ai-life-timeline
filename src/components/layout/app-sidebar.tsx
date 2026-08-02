'use client'

import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-data'
import { useTheme } from 'next-themes'
import { useLocaleStore } from '@/stores/locale-store'
import { useTranslation } from '@/hooks/use-translation'
import {
  CalendarDays, Clock, Compass, LayoutList, Bell, Search, Sparkles,
  Hourglass, CircleHelp, Menu, X, Settings, Sun, Moon, Languages,
} from 'lucide-react'
import type { ViewName } from '@/lib/types'
import { useEffect, useState } from 'react'
import { StreakBadge } from './streak-badge'

const NAV_ITEMS: { id: ViewName; labelKey: 'nav.timeline' | 'nav.calendar' | 'nav.unknown' | 'nav.companion' | 'nav.insights' | 'nav.search'; icon: typeof Clock }[] = [
  { id: 'timeline', labelKey: 'nav.timeline', icon: LayoutList },
  { id: 'calendar', labelKey: 'nav.calendar', icon: CalendarDays },
  { id: 'unknown', labelKey: 'nav.unknown', icon: CircleHelp },
  { id: 'companion', labelKey: 'nav.companion', icon: Sparkles },
  { id: 'insights', labelKey: 'nav.insights', icon: Compass },
  { id: 'search', labelKey: 'nav.search', icon: Search },
]

export function AppSidebar() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)
  const notifPanelOpen = useAppStore((s) => s.notifPanelOpen)
  const { data: notifData } = useNotifications()
  const unread = notifData?.unreadCount ?? 0
  const { t } = useTranslation()

  // Close sidebar on view change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [view, setSidebarOpen])

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-card/95 backdrop-blur transition-transform duration-300 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Hourglass className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">{t('app.name')}</div>
              <div className="text-[11px] text-muted-foreground">{t('app.tagline')}</div>
            </div>
          </div>
          <button
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Navigate
          </div>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = view === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setView(item.id)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('h-4.5 w-4.5 shrink-0', active && 'text-emerald-600 dark:text-emerald-400')} />
                    <span className="flex-1 text-left">{t(item.labelKey)}</span>
                    {item.id === 'unknown' && <UnknownBadge />}
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="my-3 border-t" />

          <button
            onClick={() => setNotifPanelOpen(!notifPanelOpen)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground"
          >
            <Bell className="h-4.5 w-4.5 shrink-0" />
            <span className="flex-1 text-left">{t('nav.notifications')}</span>
            {unread > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        </nav>

        {/* Footer status */}
        <div className="border-t p-4">
          <div className="mb-2 flex items-center gap-2">
            <ThemeToggle />
            <LocaleToggle />
            <button
              onClick={() => setView('settings')}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent',
                view === 'settings' && 'border-emerald-500/40 bg-emerald-500/5',
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              {t('nav.settings')}
            </button>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              AI-assisted logging
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Your timeline is continuously scanned for gaps. Resolve them to train the AI.
            </p>
          </div>
          <div className="mt-2">
            <StreakBadge />
          </div>
        </div>
      </aside>
    </>
  )
}

function UnknownBadge() {
  return null
  // The badge is shown via the view header instead; keep this as a placeholder hook for future counts.
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent"
      aria-label="Toggle theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      suppressHydrationWarning
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

export function MobileMenuButton() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  return (
    <button
      className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
      onClick={() => setSidebarOpen(!sidebarOpen)}
      aria-label="Toggle menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}

function LocaleToggle() {
  const locale = useLocaleStore((s) => s.locale)
  const toggle = useLocaleStore((s) => s.toggle)
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent"
      aria-label="Toggle language"
      title={locale === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
    >
      <Languages className="h-4 w-4" />
    </button>
  )
}
