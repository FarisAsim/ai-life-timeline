'use client'

import { useAppStore } from '@/stores/app-store'
import { useNotifications, useMarkAllRead, useRunNotificationEngine } from '@/hooks/use-data'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell, Hourglass, CalendarClock, Sparkles, Lightbulb, CheckCheck, RefreshCw, BellOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAppStore as useStore } from '@/stores/app-store'

const TYPE_META: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  gap_prompt: { icon: Hourglass, color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Gap prompt' },
  pre_event: { icon: CalendarClock, color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Upcoming' },
  state_change: { icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-500/10', label: 'State change' },
  insight: { icon: Lightbulb, color: 'text-orange-600', bg: 'bg-orange-500/10', label: 'Insight' },
  ai_guess: { icon: Sparkles, color: 'text-fuchsia-600', bg: 'bg-fuchsia-500/10', label: 'AI Guess' },
}

export function NotificationsPanel() {
  const open = useAppStore((s) => s.notifPanelOpen)
  const setOpen = useAppStore((s) => s.setNotifPanelOpen)
  const setView = useStore((s) => s.setView)
  const { data, isLoading } = useNotifications()
  const markAll = useMarkAllRead()
  const runEngine = useRunNotificationEngine()

  const notifications = data?.notifications ?? []
  const unread = data?.unreadCount ?? 0

  const handleAction = (n: { actionType: string | null; actionPayload: string | null }) => {
    if (n.actionType === 'resolve_gap') {
      setView('unknown')
    } else if (n.actionType === 'view_event') {
      setView('timeline')
    } else if (n.actionType === 'view_insight') {
      setView('insights')
    }
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
            {unread > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
            )}
          </SheetTitle>
          <SheetDescription>Conversational nudges about your timeline</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 px-1 py-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate(undefined, { onSuccess: () => toast.success('All marked as read') })}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={runEngine.isPending}
            onClick={() =>
              runEngine.mutate(undefined, {
                onSuccess: (d: { count?: number } | undefined) =>
                  d?.count ? toast.success(`Generated ${d.count} new notification${d.count === 1 ? '' : 's'}`) : toast.info('No new notifications'),
              })
            }
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', runEngine.isPending && 'animate-spin')} />
            Scan now
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-12rem)] pr-1">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BellOff className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">You're all caught up</h3>
              <p className="max-w-xs text-xs text-muted-foreground">
                New notifications will appear here when the engine detects gaps or upcoming events.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n: {
                id: string
                type: string
                title: string
                body: string
                actionType: string | null
                actionPayload: string | null
                isRead: boolean
                createdAt: string
              }) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.insight
                const Icon = meta.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleAction(n)}
                    className={cn(
                      'block w-full rounded-xl border p-3 text-left transition-colors hover:bg-accent',
                      n.isRead ? 'border-border bg-card' : 'border-emerald-500/30 bg-emerald-500/5',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.bg, meta.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{n.title}</span>
                          {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
