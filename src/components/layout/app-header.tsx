'use client'

import { useAppStore } from '@/stores/app-store'
import { MobileMenuButton } from './app-sidebar'
import { DateJumpPicker } from '@/components/timeline/date-jump-picker'
import { Button } from '@/components/ui/button'
import { Bell, Sparkles } from 'lucide-react'
import { useNotifications, useSeed, useRunNotificationEngine, useTimelineDay, useUnknownBlocks } from '@/hooks/use-data'
import { toast } from 'sonner'

const VIEW_META: Record<string, { title: string; subtitle: string }> = {
  timeline: { title: 'Timeline', subtitle: 'Hour-by-hour record of your day' },
  calendar: { title: 'Calendar', subtitle: 'Completion score across the month' },
  unknown: { title: 'Unknown Blocks', subtitle: 'Gaps the AI wants to fill' },
  companion: { title: 'AI Companion', subtitle: 'Chat grounded in your timeline' },
  insights: { title: 'Insights', subtitle: 'Patterns and analytics' },
  search: { title: 'Search', subtitle: 'Semantic search across events' },
  notifications: { title: 'Notifications', subtitle: 'Conversational reminders' },
  settings: { title: 'Settings', subtitle: 'Profile, privacy, and data controls' },
}

export function AppHeader() {
  const view = useAppStore((s) => s.view)
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)
  const notifPanelOpen = useAppStore((s) => s.notifPanelOpen)

  const { data: notifData } = useNotifications()
  const unread = notifData?.unreadCount ?? 0
  const seed = useSeed()
  const runEngine = useRunNotificationEngine()

  const { data: events } = useTimelineDay()
  const { data: blocks } = useUnknownBlocks()

  const meta = VIEW_META[view] ?? VIEW_META.timeline

  const showDatePicker = view === 'timeline'

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-md md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MobileMenuButton />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">{meta.title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {showDatePicker && <DateJumpPicker />}

          {view === 'timeline' && (
            <div className="hidden items-center gap-2 sm:flex">
              <StatChip label="Events" value={events?.length ?? 0} tone="emerald" />
              {blocks && blocks.length > 0 && (
                <StatChip label="Gaps" value={blocks.length} tone="amber" />
              )}
            </div>
          )}

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
                onSuccess: () => toast.success('Demo data seeded — explore your timeline!'),
                onError: () => toast.error('Failed to seed data'),
              })
            }}
            disabled={seed.isPending}
          >
            {seed.isPending ? 'Seeding…' : 'Seed demo data'}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
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

function StatChip({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' }) {
  const tones = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  }
  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${tones[tone]}`}>
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
