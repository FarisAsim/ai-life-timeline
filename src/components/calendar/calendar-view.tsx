'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useMonthCompletion } from '@/hooks/use-data'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, isToday, getDay, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange } from 'lucide-react'
import type { DayCompletion } from '@/lib/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarView() {
  const [cursor, setCursor] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const setSelectedDate = useAppStore((s) => s.setSelectedDate)
  const setView = useAppStore((s) => s.setView)
  const selectedDate = useAppStore((s) => s.selectedDate)

  const { data, isLoading } = useMonthCompletion(cursor.getFullYear(), cursor.getMonth())

  const completionMap = useMemo(() => {
    const m = new Map<string, DayCompletion>()
    data?.days?.forEach((d) => m.set(d.date, d))
    return m
  }, [data])

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor)
    const monthEnd = endOfMonth(cursor)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [cursor])

  const monthScore = data?.monthScore ?? 0
  const pastDays = completionMap
  const greenDays = Array.from(pastDays.values()).filter((d) => d.status === 'green').length
  const yellowDays = Array.from(pastDays.values()).filter((d) => d.status === 'yellow').length
  const redDays = Array.from(pastDays.values()).filter((d) => d.status === 'red').length

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 md:px-6">
      {/* Summary header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {viewMode === 'month' ? <CalendarDays className="h-4 w-4 text-emerald-600" /> : <CalendarRange className="h-4 w-4 text-emerald-600" />}
              <h2 className="text-lg font-semibold">
                {viewMode === 'month' ? format(cursor, 'MMMM yyyy') : `Week of ${format(startOfWeek(cursor, { weekStartsOn: 0 }), 'MMM d')}`}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {viewMode === 'month'
                ? <>Average completion: <span className="font-semibold text-foreground">{Math.round(monthScore * 100)}%</span> · {greenDays} green · {yellowDays} yellow · {redDays} red</>
                : <>7-day completion overview · click any day to drill in</>
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'week')}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(viewMode === 'month' ? subMonths(cursor, 1) : subWeeks(cursor, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(viewMode === 'month' ? addMonths(cursor, 1) : addWeeks(cursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 border-t bg-muted/30 px-5 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Complete (≥85%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Partial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Incomplete
          </span>
          <span className="ml-auto hidden sm:inline">Click any day to view its timeline</span>
        </div>
      </Card>

      {/* Calendar grid */}
      <Card className="p-3 md:p-4">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : viewMode === 'week' ? (
          <WeekView cursor={cursor} completionMap={completionMap} selectedDate={selectedDate} onSelect={(key) => { setSelectedDate(key); setView('timeline') }} />
        ) : (
          <>
            <div className="mb-2 grid grid-cols-7 gap-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const inMonth = isSameMonth(day, cursor)
                const key = format(day, 'yyyy-MM-dd')
                const completion = completionMap.get(key)
                const isSelected = selectedDate === key
                const isCurrentDay = isToday(day)
                const future = day > new Date() && !isCurrentDay
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedDate(key)
                      setView('timeline')
                    }}
                    disabled={future}
                    className={cn(
                      'group relative flex aspect-square flex-col items-center justify-center rounded-lg border p-1 text-center transition-all',
                      inMonth ? 'hover:border-emerald-500/50 hover:shadow-sm' : 'opacity-40',
                      isSelected && 'ring-2 ring-emerald-500 ring-offset-1',
                      future && 'cursor-not-allowed opacity-30',
                    )}
                  >
                    <DayCell day={day} completion={completion} isToday={isCurrentDay} />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </Card>

      {/* Selected day detail */}
      <SelectedDayDetail />
    </div>
  )
}

function DayCell({ day, completion, isToday }: { day: Date; completion: DayCompletion | undefined; isToday: boolean }) {
  const dayNum = format(day, 'd')
  if (!completion || completion.totalMinutes === 0) {
    return (
      <>
        <span className={cn('text-sm font-medium', isToday && 'text-emerald-600')}>{dayNum}</span>
        {isToday && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      </>
    )
  }
  const score = Math.round(completion.score * 100)
  const status = completion.status
  const bg = {
    green: 'bg-emerald-500/15 border-emerald-500/30',
    yellow: 'bg-amber-500/15 border-amber-500/30',
    red: 'bg-rose-500/15 border-rose-500/30',
  }[status]
  const dot = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-rose-500',
  }[status]
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center rounded-md border', bg)}>
      <span className={cn('text-sm font-semibold', isToday && 'text-emerald-600')}>{dayNum}</span>
      <span className={cn('mt-0.5 text-[9px] font-bold', status === 'green' ? 'text-emerald-700 dark:text-emerald-300' : status === 'yellow' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300')}>
        {score}%
      </span>
      <div className="mt-0.5 flex gap-0.5">
        {completion.openBlockCount > 0 && <span className={cn('h-1 w-1 rounded-full', dot)} />}
        <span className={cn('h-1 w-1 rounded-full', dot)} />
      </div>
    </div>
  )
}

function SelectedDayDetail() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const [cursor] = useState(new Date())
  const { data } = useMonthCompletion(cursor.getFullYear(), cursor.getMonth())
  const completion = data?.days?.find((d) => d.date === selectedDate)
  if (!completion || completion.totalMinutes === 0) return null
  const hours = (completion.coveredMinutes / 60).toFixed(1)
  const possibleHours = (completion.totalMinutes / 60).toFixed(1)
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')}</div>
          <div className="text-lg font-semibold">
            {hours}h <span className="text-muted-foreground">of {possibleHours}h waking hours</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{completion.eventCount}</div>
            <div className="text-muted-foreground">events</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-600">{completion.openBlockCount}</div>
            <div className="text-muted-foreground">open gaps</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-600">{Math.round(completion.score * 100)}%</div>
            <div className="text-muted-foreground">complete</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function WeekView({ cursor, completionMap, selectedDate, onSelect }: {
  cursor: Date
  completionMap: Map<string, DayCompletion>
  selectedDate: string
  onSelect: (key: string) => void
}) {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000) })
  const now = new Date()

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const completion = completionMap.get(key)
          const isSelected = selectedDate === key
          const isCurrentDay = isToday(day)
          const future = day > now && !isCurrentDay
          const status = completion?.status
          const barColor = status === 'green' ? 'bg-emerald-500' : status === 'yellow' ? 'bg-amber-500' : status === 'red' ? 'bg-rose-500' : 'bg-slate-300'
          return (
            <button
              key={key}
              onClick={() => !future && onSelect(key)}
              disabled={future}
              className={cn(
                'group relative flex min-h-[7rem] flex-col rounded-lg border p-2 text-left transition-all',
                future ? 'cursor-not-allowed opacity-30' : 'hover:border-emerald-500/50 hover:shadow-sm',
                isSelected && 'ring-2 ring-emerald-500 ring-offset-1',
                status === 'green' && 'border-emerald-500/30 bg-emerald-500/5',
                status === 'yellow' && 'border-amber-500/30 bg-amber-500/5',
                status === 'red' && 'border-rose-500/30 bg-rose-500/5',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-sm font-semibold', isCurrentDay && 'text-emerald-600')}>{format(day, 'd')}</span>
                {isCurrentDay && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </div>
              {completion && completion.totalMinutes > 0 ? (
                <div className="mt-1.5 flex-1 space-y-1">
                  <div className="text-[10px] font-bold text-foreground">
                    {Math.round(completion.score * 100)}%
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {completion.eventCount} ev
                    {completion.openBlockCount > 0 && ` · ${completion.openBlockCount} gaps`}
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${Math.round(completion.score * 100)}%` }} />
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 flex-1 text-[9px] text-muted-foreground">
                  {future ? 'Upcoming' : 'No data'}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
