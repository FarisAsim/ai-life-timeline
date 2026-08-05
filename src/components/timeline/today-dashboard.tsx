'use client'

import { useAppStore } from '@/stores/app-store'
import { useTimelineDay, useUnknownBlocks, useInsights, useMonthCompletion } from '@/hooks/use-data'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isToday, differenceInMinutes } from 'date-fns'
import {
  CheckCircle2, AlertCircle, TrendingUp, Target, Calendar,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'
import { useEffect, useState } from 'react'

export function TodayDashboard() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const setView = useAppStore((s) => s.setView)
  const { data: events, isLoading: eventsLoading } = useTimelineDay()
  const { data: blocks } = useUnknownBlocks()
  const { data: insights } = useInsights(7)
  const now = new Date()
  const { data: monthData } = useMonthCompletion(now.getFullYear(), now.getMonth())
  const { t, locale } = useTranslation()

  // Live clock
  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const day = new Date(selectedDate + 'T00:00:00')
  const isTodayView = isToday(day)

  if (eventsLoading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
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

  const weekTrackedHours = insights ? Math.round((insights.totalTrackedMinutes / 60) * 10) / 10 : 0
  const weekCompleteness = insights?.completenessPercentage ?? 0
  const monthScore = monthData?.monthScore ?? 0
  const todayMonthDay = monthData?.days?.find((d) => d.date === selectedDate)

  const isAr = locale === 'ar-EG'
  const timeStr = currentTime.toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })

  const stats = [
    {
      value: `${completion}%`,
      subtitle: isAr ? `${(trackedMinutes / 60).toFixed(1)}س` : `${(trackedMinutes / 60).toFixed(1)}h`,
      icon: Target,
      tone: completion >= 85 ? 'emerald' : completion >= 50 ? 'amber' : 'rose',
      onClick: () => setView('timeline'),
    },
    {
      value: String(dayEvents.length),
      subtitle: isAr ? `${dayBlocks.length} فجوة` : `${dayBlocks.length} gaps`,
      icon: CheckCircle2,
      tone: 'emerald',
      onClick: () => setView('timeline'),
    },
    {
      value: `${weekTrackedHours}${isAr ? 'س' : 'h'}`,
      subtitle: `${weekCompleteness}%`,
      icon: TrendingUp,
      tone: 'violet',
      onClick: () => setView('insights'),
    },
    {
      value: `${Math.round(monthScore * 100)}%`,
      subtitle: isAr ? `${todayMonthDay?.eventCount ?? 0} حدث` : `${todayMonthDay?.eventCount ?? 0} ev`,
      icon: Calendar,
      tone: 'teal',
      onClick: () => setView('calendar'),
    },
  ]

  return (
    <div className="space-y-2">
      {/* Compact stats row + live clock */}
      <div className="flex items-center gap-2">
        {/* Live clock */}
        <div className="glass-card flex h-14 shrink-0 flex-col items-center justify-center rounded-xl px-3">
          <span className="text-lg font-bold tabular-nums leading-none">{timeStr}</span>
          <span className="text-[10px] text-muted-foreground">{isAr ? 'الآن' : 'now'}</span>
        </div>

        {/* Compact stat cards */}
        <div className="grid flex-1 grid-cols-4 gap-1.5">
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
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                onClick={s.onClick}
                className="group text-left"
              >
                <Card className="glass-card flex h-14 flex-col items-center justify-center p-2 text-center transition-all hover:shadow-md">
                  <div className="flex items-center gap-1">
                    <div className={cn('flex h-5 w-5 items-center justify-center rounded', toneClasses)}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <span className="text-sm font-bold leading-none">{s.value}</span>
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{s.subtitle}</span>
                </Card>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Gaps prompt */}
      {dayBlocks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="glass-card border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  {isAr ? `${dayBlocks.length} فجوة محتاجة اهتمامك` : `${dayBlocks.length} gaps need attention`}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {isAr ? `غير متتبع: ${(dayBlocks.reduce((s, b) => s + b.durationMinutes, 0) / 60).toFixed(1)}س` : `Untracked: ${(dayBlocks.reduce((s, b) => s + b.durationMinutes, 0) / 60).toFixed(1)}h`}
                </div>
              </div>
              <button
                onClick={() => setView('unknown')}
                className="shrink-0 rounded-md bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/30 dark:text-amber-300"
              >
                {isAr ? 'حل ←' : 'Resolve →'}
              </button>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
