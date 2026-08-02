'use client'

import { useAppStore } from '@/stores/app-store'
import { MobileMenuButton } from './app-sidebar'
import { DateJumpPicker } from '@/components/timeline/date-jump-picker'
import { Button } from '@/components/ui/button'
import { Bell, Sparkles, Menu } from 'lucide-react'
import { useNotifications, useSeed, useRunNotificationEngine, useTimelineDay, useUnknownBlocks } from '@/hooks/use-data'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/use-translation'

const VIEW_META: Record<string, { title: string; subtitle: string }> = {
  timeline: { title: 'timeline.title', subtitle: 'timeline.subtitle' },
  calendar: { title: 'nav.calendar', subtitle: 'Calendar completion score' },
  unknown: { title: 'unknown.title', subtitle: 'unknown.subtitle' },
  companion: { title: 'companion.title', subtitle: 'companion.subtitle' },
  insights: { title: 'insights.title', subtitle: 'insights.subtitle' },
  search: { title: 'search.title', subtitle: 'search.subtitle' },
  notifications: { title: 'nav.notifications', subtitle: 'Conversational reminders' },
  settings: { title: 'settings.title', subtitle: 'settings.subtitle' },
}

export function AppHeader() {
  const view = useAppStore((s) => s.view)
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)
  const notifPanelOpen = useAppStore((s) => s.notifPanelOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)

  const { data: notifData } = useNotifications()
  const unread = notifData?.unreadCount ?? 0
  const seed = useSeed()
  const runEngine = useRunNotificationEngine()

  const { data: events } = useTimelineDay()
  const { data: blocks } = useUnknownBlocks()

  const { t } = useTranslation()
  const meta = VIEW_META[view] ?? VIEW_META.timeline
  const showDatePicker = view === 'timeline'

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-6 md:py-3">
        {/* Left: menu + title */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight md:text-xl">{t(meta.title as never)}</h1>
            <p className="hidden truncate text-xs text-muted-foreground md:block">{meta.subtitle}</p>
          </div>
        </div>

        {/* Right: actions — minimal on mobile */}
        <div className="flex items-center gap-1.5">
          {showDatePicker && <DateJumpPicker />}

          {/* Scan + Seed — desktop only */}
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => {
              runEngine.mutate(undefined, {
                onSuccess: (d: { count?: number } | undefined) =>
                  toast.success(d?.count ? `Generated ${d.count} notification${d.count === 1 ? '' : 's'}` : 'No new notifications'),
              })
            }}
            disabled={runEngine.isPending}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Scan
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => {
              seed.mutate(undefined, {
                onSuccess: () => toast.success('Demo data seeded'),
                onError: () => toast.error('Failed to seed data'),
              })
            }}
            disabled={seed.isPending}
          >
            {seed.isPending ? 'Seeding…' : 'Seed demo data'}
          </Button>

          {/* Notifications bell — always visible */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 shrink-0"
            onClick={() => setNotifPanelOpen(!notifPanelOpen)}
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
