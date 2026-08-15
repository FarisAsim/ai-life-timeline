'use client'

import { useAppStore } from '@/stores/app-store'
import { DateJumpPicker } from '@/components/timeline/date-jump-picker'
import { Button } from '@/components/ui/button'
import { Bell, Menu, Sparkles } from 'lucide-react'
import { useNotifications, useRunNotificationEngine } from '@/hooks/use-data'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/use-translation'

const VIEW_META: Record<string, { titleKey: string; subtitleKey: string }> = {
  timeline: { titleKey: 'nav.timeline', subtitleKey: 'header.subTimeline' },
  calendar: { titleKey: 'nav.calendar', subtitleKey: 'header.subCalendar' },
  unknown: { titleKey: 'unknown.title', subtitleKey: 'header.subUnknown' },
  companion: { titleKey: 'companion.title', subtitleKey: 'header.subCompanion' },
  insights: { titleKey: 'insights.title', subtitleKey: 'header.subInsights' },
  search: { titleKey: 'search.title', subtitleKey: 'header.subSearch' },
  settings: { titleKey: 'settings.title', subtitleKey: 'header.subSettings' },
}

export function AppHeader() {
  const view = useAppStore((s) => s.view)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)

  const { data: notifData } = useNotifications()
  const unread = notifData?.unreadCount ?? 0
  const runEngine = useRunNotificationEngine()
  const { t } = useTranslation()

  const meta = VIEW_META[view] ?? VIEW_META.timeline
  const showDatePicker = view === 'timeline'

  return (
    <header
      className="sticky top-0 z-20 border-b border-border/50 glass"
      role="banner"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-6">
        {/* Left: hamburger (mobile) + title */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={t('header.openNav')}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight md:text-xl">
              {t(meta.titleKey as never)}
            </h1>
            <p className="hidden truncate text-sm text-muted-foreground md:block">
              {t(meta.subtitleKey as never)}
            </p>
          </div>
        </div>

        {/* Right: date picker (timeline only) + actions */}
        <div className="flex items-center gap-2">
          {showDatePicker && <DateJumpPicker />}

          {/* Scan button — desktop only */}
          <Button
            variant="outline"
            size="sm"
            className="hidden h-11 px-4 md:inline-flex"
            onClick={() => {
              runEngine.mutate(undefined, {
                onSuccess: (d: { count?: number } | undefined) =>
                  toast.success(d?.count ? t('header.generated', { count: d.count }) : t('header.noNew')),
              })
            }}
            disabled={runEngine.isPending}
          >
            <Sparkles className="h-4 w-4" />
            <span className="ml-1.5">{t('header.scan')}</span>
          </Button>

          {/* Notifications — always visible, 44px touch target */}
          <button
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent"
            onClick={() => setNotifPanelOpen(true)}
            aria-label={unread > 0 ? t('header.notifsUnread', { n: unread }) : t('header.notifs')}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white"
                aria-label={t('header.notifsUnread', { n: unread })}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
