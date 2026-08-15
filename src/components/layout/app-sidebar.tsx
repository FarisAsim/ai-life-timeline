'use client'

import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-data'
import { useTranslation } from '@/hooks/use-translation'
import {
  CalendarDays, Clock, Compass, LayoutList, Bell, Search, Sparkles,
  Hourglass, CircleHelp, Menu, X, Settings,
} from 'lucide-react'
import type { ViewName } from '@/lib/types'
import { useEffect } from 'react'
import { StreakBadge } from './streak-badge'
import { motion, AnimatePresence } from 'framer-motion'

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
  const { data: notifData } = useNotifications()
  const unread = notifData?.unreadCount ?? 0
  const { t } = useTranslation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [view, setSidebarOpen])

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'sidebar-drawer fixed inset-y-0 left-0 z-50 h-screen flex w-80 max-w-[85vw] flex-col border-r bg-card/95 backdrop-blur-xl transition-transform duration-300 md:static md:z-0 md:block md:h-screen md:w-72 md:translate-x-0 md:bg-card',
          sidebarOpen ? 'flex translate-x-0' : 'sidebar-hidden hidden -translate-x-full md:flex',
        )}
        aria-label={t('nav.sidebar')}
        aria-hidden={!sidebarOpen}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Hourglass className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold tracking-tight">{t('app.name')}</div>
              <div className="text-sm text-muted-foreground">{t('app.tagline')}</div>
            </div>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('nav.closeMenu')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav — 44px minimum touch targets */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label={t('nav.mainNav')}>
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('nav.timeline' as never) === 'الخط الزمني' ? 'التنقل' : 'Navigate'}
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
                      'flex h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors',
                      active
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className={cn('h-5 w-5 shrink-0', active && 'text-emerald-600 dark:text-emerald-400')} aria-hidden="true" />
                    <span className="flex-1 text-left">{t(item.labelKey)}</span>
                    {active && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="my-3 border-t" />

          {/* Notifications button — 44px touch target */}
          <button
            onClick={() => setNotifPanelOpen(true)}
            className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-foreground/70 hover:bg-accent hover:text-foreground"
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
          >
            <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{t('nav.notifications')}</span>
            {unread > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 text-sm font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        </nav>

        {/* Footer — settings button + status */}
        <div className="border-t p-3">
          <button
            onClick={() => setView('settings')}
            className={cn(
              'mb-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors',
              view === 'settings'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'text-foreground/70 hover:bg-accent hover:text-foreground',
            )}
            aria-label={t('nav.openSettings')}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            {t('nav.settings')}
          </button>
          <StreakBadge />
        </div>
      </aside>
    </>
  )
}

