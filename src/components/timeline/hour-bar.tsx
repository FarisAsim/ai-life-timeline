'use client'

import { useTimelineDay, useUnknownBlocks } from '@/hooks/use-data'
import { useAppStore } from '@/stores/app-store'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format, differenceInMinutes, isToday } from 'date-fns'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CATEGORY_COLOR_MAP, type TimelineEvent, type UnknownBlock } from '@/lib/types'
import { Sunrise, Sun, Sunset, Moon, Clock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '@/hooks/use-translation'

const CATEGORY_HEX: Record<string, string> = {
  emerald: '#10b981',
  violet: '#8b5cf6',
  orange: '#f97316',
  indigo: '#6366f1',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#94a3b8',
  yellow: '#eab308',
  cyan: '#06b6d4',
  teal: '#14b8a6',
}

const DAY_START_HOUR = 5
const DAY_END_HOUR = 24
const DAY_SPAN = DAY_END_HOUR - DAY_START_HOUR // 19 hours visualized

export function HourBar() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const setSelectedDate = useAppStore((s) => s.setSelectedDate)
  const setView = useAppStore((s) => s.setView)
  const { data: events, isLoading } = useTimelineDay()
  const { data: blocks } = useUnknownBlocks()
  const { locale, t } = useTranslation()
  const isAr = locale === 'ar-EG'
  const [hovered, setHovered] = useState<{ kind: 'event' | 'gap'; data: TimelineEvent | UnknownBlock } | null>(null)

  const day = new Date(selectedDate + 'T00:00:00')
  const todayFlag = isToday(day)

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl" />
  }

  const dayStart = new Date(day)
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0)
  const dayEnd = new Date(day)
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0)
  const totalMinutes = DAY_SPAN * 60

  const dayEvents = (events ?? []).filter((e) => {
    const s = new Date(e.startTime)
    return s.toDateString() === day.toDateString()
  })
  const dayBlocks = (blocks ?? []).filter((b) => {
    const s = new Date(b.startTime)
    return s.toDateString() === day.toDateString() && (b.status === 'open' || b.status === 'ai_guessed_pending_confirmation')
  })

  // Build segments
  type Seg = { kind: 'event' | 'gap' | 'empty'; startMin: number; durMin: number; data?: TimelineEvent | UnknownBlock }
  const segs: Seg[] = []
  for (const e of dayEvents) {
    const es = new Date(e.startTime)
    const ee = new Date(e.endTime)
    const startMin = Math.max(0, differenceInMinutes(es, dayStart))
    const endMin = Math.min(totalMinutes, differenceInMinutes(ee, dayStart))
    if (endMin > startMin) segs.push({ kind: 'event', startMin, durMin: endMin - startMin, data: e })
  }
  for (const b of dayBlocks) {
    const bs = new Date(b.startTime)
    const be = new Date(b.endTime)
    const startMin = Math.max(0, differenceInMinutes(bs, dayStart))
    const endMin = Math.min(totalMinutes, differenceInMinutes(be, dayStart))
    if (endMin > startMin) segs.push({ kind: 'gap', startMin, durMin: endMin - startMin, data: b })
  }
  segs.sort((a, b) => a.startMin - b.startMin)

  // Now indicator
  const now = new Date()
  const nowMin = todayFlag ? differenceInMinutes(now, dayStart) : -1
  const showNow = nowMin >= 0 && nowMin <= totalMinutes

  const trackedMin = dayEvents.reduce((s, e) => s + e.durationMinutes, 0)
  const gapMin = dayBlocks.reduce((s, b) => s + b.durationMinutes, 0)

  return (
    <Card className="overflow-hidden p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">{t('timeline.dayAtAGlance')}</span>
          <span className="text-[10px] text-muted-foreground">
            · {format(day, 'MMM d')} · {DAY_START_HOUR}:00–{DAY_END_HOUR}:00
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {Math.round(trackedMin / 60 * 10) / 10}{isAr ? 'س' : 'h'} {t('timeline.tracked')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-amber-400 bg-amber-500/20" />
            {Math.round(gapMin / 60 * 10) / 10}{isAr ? 'س' : 'h'} {t('unknown.gapsShort')}
          </span>
        </div>
      </div>

      {/* The bar */}
      <div className="relative">
        {/* Hour labels */}
        <div className="mb-1 flex justify-between px-0.5 text-[9px] font-medium text-muted-foreground">
          {[5, 8, 11, 14, 17, 20, 23].map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>

        {/* Bar track */}
        <div
          className="relative h-12 w-full overflow-hidden rounded-lg border bg-muted/40"
          onMouseLeave={() => setHovered(null)}
        >
          {/* Time-of-day background gradient zones */}
          <div className="absolute inset-0 flex">
            <div className="h-full bg-gradient-to-r from-indigo-500/5 to-transparent" style={{ width: `${(1 / DAY_SPAN) * 100}%` }} title={t("hourBar.dawn")} />
            <div className="h-full flex-1 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5" />
          </div>

          {/* Segments */}
          {segs.map((seg, i) => {
            const leftPct = (seg.startMin / totalMinutes) * 100
            const widthPct = (seg.durMin / totalMinutes) * 100
            if (seg.kind === 'event') {
              const e = seg.data as TimelineEvent
              const hex = e.category ? CATEGORY_HEX[e.category.color] ?? '#94a3b8' : '#cbd5e1'
              return (
                <motion.div
                  key={`ev-${i}`}
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="absolute inset-y-0 origin-left cursor-pointer"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: hex, minWidth: widthPct < 0.5 ? 2 : 0 }}
                  onMouseEnter={() => setHovered({ kind: 'event', data: e })}
                  onClick={() => { setSelectedDate(format(new Date(e.startTime), 'yyyy-MM-dd')); setView('timeline') }}
                  title={`${e.title} · ${format(new Date(e.startTime), 'h:mm a')}–${format(new Date(e.endTime), 'h:mm a')}`}
                />
              )
            }
            if (seg.kind === 'gap') {
              const b = seg.data as UnknownBlock
              return (
                <motion.div
                  key={`gap-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="absolute inset-y-0 cursor-pointer border-x border-dashed border-amber-500/50 bg-amber-500/15"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    minWidth: widthPct < 0.5 ? 1 : 0,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(245, 158, 11, 0.15) 3px, rgba(245, 158, 11, 0.15) 6px)',
                  }}
                  onMouseEnter={() => setHovered({ kind: 'gap', data: b })}
                  title={`Gap · ${format(new Date(b.startTime), 'h:mm a')}–${format(new Date(b.endTime), 'h:mm a')}`}
                />
              )
            }
            return null
          })}

          {/* Now indicator */}
          {showNow && (
            <div
              className="absolute inset-y-0 z-10 w-0.5 bg-rose-500"
              style={{ left: `${(nowMin / totalMinutes) * 100}%` }}
            >
              <div className="absolute -top-0.5 -left-1 h-2 w-2 rounded-full bg-rose-500 shadow-sm" />
              <div className="absolute -bottom-3 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-rose-600">
                {t('hourBar.now')}
              </div>
            </div>
          )}
        </div>

        {/* Time-of-day icons */}
        <div className="mt-3 flex justify-between text-muted-foreground">
          <div className="flex items-center gap-1 text-[9px]">
            <Sunrise className="h-3 w-3" /> {DAY_START_HOUR}:00
          </div>
          <div className="flex items-center gap-1 text-[9px]">
            <Sun className="h-3 w-3" /> 12:00
          </div>
          <div className="flex items-center gap-1 text-[9px]">
            <Sunset className="h-3 w-3" /> {DAY_END_HOUR - 1}:00
          </div>
        </div>

        {/* Hover tooltip */}
        {hovered && (
          <div className="mt-2 rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-sm">
            {hovered.kind === 'event' ? (
              <EventTooltip event={hovered.data as TimelineEvent} />
            ) : (
              <GapTooltip block={hovered.data as UnknownBlock} />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function EventTooltip({ event }: { event: TimelineEvent }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: event.category ? CATEGORY_HEX[event.category.color] ?? '#94a3b8' : '#cbd5e1' }}
      />
      <span className="font-medium">{event.title}</span>
      <span className="text-muted-foreground">
        {format(new Date(event.startTime), 'h:mm a')}–{format(new Date(event.endTime), 'h:mm a')}
      </span>
      {event.category && <span className="text-muted-foreground">· {event.category.name}</span>}
    </div>
  )
}

function GapTooltip({ block }: { block: UnknownBlock }) {
  const { locale, t } = useTranslation()
  const isAr = locale === 'ar-EG'
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span className="h-2 w-2 rounded-sm border border-amber-500 bg-amber-500/30" />
      </span>
      <span className="font-medium text-amber-700 dark:text-amber-300">{t('hourBar.unknownTime')}</span>
      <span className="text-muted-foreground">
        {format(new Date(block.startTime), 'h:mm a')}–{format(new Date(block.endTime), 'h:mm a')}
      </span>
      <span className="text-muted-foreground">{isAr ? '،' : '·'} {(block.durationMinutes / 60).toFixed(1)}{isAr ? 'س' : 'h'}</span>
    </div>
  )
}
