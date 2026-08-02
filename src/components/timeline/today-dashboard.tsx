'use client'

import { useAppStore } from '@/stores/app-store'
import { useTimelineDay, useUnknownBlocks, useInsights, useMonthCompletion } from '@/hooks/use-data'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format, isToday, differenceInMinutes } from 'date-fns'
import {
  Clock, CheckCircle2, AlertCircle, TrendingUp, Target, Sparkles, Calendar,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CategoryDot } from '@/components/category-icon'

export function TodayDashboard() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const setView = useAppStore((s) => s.setView)
  const { data: events, isLoading: eventsLoading } = useTimelineDay()
  const { data: blocks } = useUnknownBlocks()
  const { data: insights } = useInsights(7)
  const now = new Date()
  const { data: monthData } = useMonthCompletion(now.getFullYear(), now.getMonth())

  const day = new Date(selectedDate + 'T00:00:00')
  const isTodayView = isToday(day)

  if (eventsLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  const dayEvents = events ?? []
  const trackedMinutes = dayEvents.reduce((s, e) => s + e.durationMinutes, 0)
  const dayBlocks = (blocks ?? []).filter((b) => {
    const bs = new Date(b.startTime)
    return bs.toDateString() === day.toDateString() && (b.status === 'open' || b.status === 'ai_guessed_pending_confirmation')
  })
  const awakeMinutes = isTodayView
    ? Math.max(0, differenceInMinutes(now, new Date(day.setHours(6, 0, 0, 0))))
    : 17 * 60
  const completion = awakeMinutes > 0 ? Math.min(100, Math.round((trackedMinutes / awakeMinutes) * 100)) : 0

  // Week stats
  const weekTrackedHours = insights ? Math.round((insights.totalTrackedMinutes / 60) * 10) / 10 : 0
  const weekCompleteness = insights?.completenessPercentage ?? 0

  // Month completion
  const monthScore = monthData?.monthScore ?? 0
  const todayMonthDay = monthData?.days?.find((d) => d.date === selectedDate)

  // Category breakdown for today
  const catMap = new Map<string, { name: string; color: string; minutes: number }>()
  for (const e of dayEvents) {
    if (e.category) {
      const key = e.category.color
      const existing = catMap.get(key)
      if (existing) existing.minutes += e.durationMinutes
      else catMap.set(key, { name: e.category.name, color: e.category.color, minutes: e.durationMinutes })
    }
  }
  const topCategories = Array.from(catMap.values()).sort((a, b) => b.minutes - a.minutes).slice(0, 3)

  const stats = [
    {
      label: isTodayView ? 'Today' : format(day, 'EEE'),
      value: `${completion}%`,
      subtitle: `${(trackedMinutes / 60).toFixed(1)}h tracked`,
      icon: Target,
      tone: completion >= 85 ? 'emerald' : completion >= 50 ? 'amber' : 'rose',
      onClick: () => setView('timeline'),
    },
    {
      label: 'Events',
      value: String(dayEvents.length),
      subtitle: `${dayBlocks.length} gaps to fill`,
      icon: CheckCircle2,
      tone: 'emerald',
      onClick: () => setView('timeline'),
    },
    {
      label: 'This week',
      value: `${weekTrackedHours}h`,
      subtitle: `${weekCompleteness}% complete`,
      icon: TrendingUp,
      tone: 'violet',
      onClick: () => setView('insights'),
    },
    {
      label: 'This month',
      value: `${Math.round(monthScore * 100)}%`,
      subtitle: `${todayMonthDay?.eventCount ?? 0} events today`,
      icon: Calendar,
      tone: 'teal',
      onClick: () => setView('calendar'),
    },
  ]

  return (
    <div className="space-y-3">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => {
          const Icon = s.icon
          const toneClasses = {
            emerald: 'bg-emerald-500/10 text-emerald-600',
            amber: 'bg-amber-500/10 text-amber-600',
            rose: 'bg-rose-500/10 text-rose-600',
            violet: 'bg-violet-500/10 text-violet-600',
            teal: 'bg-teal-500/10 text-teal-600',
          }[s.tone]
          return (
            <motion.button
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={s.onClick}
              className="group text-left"
            >
              <Card className="p-3 transition-all hover:shadow-md hover:shadow-emerald-500/5 group-hover:border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</span>
                  <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', toneClasses)}>
                    <Icon className="h-3 w-3" />
                  </div>
                </div>
                <div className="mt-1 text-xl font-bold tracking-tight">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.subtitle}</div>
              </Card>
            </motion.button>
          )
        })}
      </div>

      {/* Today's focus + gaps prompt */}
      {dayBlocks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  {dayBlocks.length} gap{dayBlocks.length === 1 ? '' : 's'} need{dayBlocks.length === 1 ? 's' : ''} your attention
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Total untracked: {(dayBlocks.reduce((s, b) => s + b.durationMinutes, 0) / 60).toFixed(1)}h
                </div>
              </div>
              <button
                onClick={() => setView('unknown')}
                className="shrink-0 rounded-md bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/30 dark:text-amber-300"
              >
                Resolve →
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Top categories today */}
      {topCategories.length > 0 && (
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top categories today</span>
          </div>
          <div className="flex items-center gap-3">
            {topCategories.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5">
                <CategoryDot color={c.color} />
                <span className="text-xs font-medium">{c.name}</span>
                <span className="text-[10px] text-muted-foreground">{(c.minutes / 60).toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
