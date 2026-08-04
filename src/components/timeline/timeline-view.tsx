'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useTimelineDay, useUnknownBlocks, useDetectGaps } from '@/hooks/use-data'
import { EventCard } from './event-card'
import { EventFormDialog } from './event-form-dialog'
import { QuickAddButton } from './quick-add-button'
import { TodayDashboard } from './today-dashboard'
import { HourBar } from './hour-bar'
import { TagFilterBar } from './tag-filter-bar'
import { VoiceCaptureDialog } from './voice-capture-dialog'
import { ResolutionDialog } from '@/components/unknown-blocks/resolution-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { format, differenceInMinutes, isToday } from 'date-fns'
import { Plus, Clock, Sparkles, Hourglass, AlertCircle, ScanLine, Mic } from 'lucide-react'
import type { TimelineEvent, UnknownBlock } from '@/lib/types'
import { CATEGORY_COLOR_MAP } from '@/lib/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Row =
  | { kind: 'event'; data: TimelineEvent }
  | { kind: 'gap'; data: UnknownBlock }

export function TimelineView() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const { data: events, isLoading: eventsLoading } = useTimelineDay()
  const { data: blocks, isLoading: blocksLoading } = useUnknownBlocks()
  const detectGaps = useDetectGaps()

  // Listen for the 'timeline:new-event' CustomEvent (dispatched by the 'n' keyboard shortcut)
  const [creating, setCreating] = useState(false)
  const [resolving, setResolving] = useState<UnknownBlock | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [voiceCapture, setVoiceCapture] = useState(false)
  useEffect(() => {
    const handler = () => setCreating(true)
    window.addEventListener('timeline:new-event', handler)
    return () => window.removeEventListener('timeline:new-event', handler)
  }, [])

  // Interleave events and gaps by start time
  const rows = useMemo<Row[]>(() => {
    if (!events) return []
    const dayStart = new Date(selectedDate + 'T00:00:00')
    const dayEvents = events.filter((e) => {
      const s = new Date(e.startTime)
      return s.toDateString() === dayStart.toDateString()
    })
    // Apply tag filter if selected
    const filteredEvents = selectedTag ? dayEvents.filter((e) => e.tags.includes(selectedTag)) : dayEvents
    const dayBlocks = (blocks ?? []).filter((b) => {
      const s = new Date(b.startTime)
      return s.toDateString() === dayStart.toDateString() && (b.status === 'open' || b.status === 'ai_guessed_pending_confirmation')
    })
    // When filtering by tag, hide gaps (they don't have tags)
    const all: Row[] = selectedTag
      ? filteredEvents.map((e) => ({ kind: 'event' as const, data: e }))
      : [
          ...filteredEvents.map((e) => ({ kind: 'event' as const, data: e })),
          ...dayBlocks.map((b) => ({ kind: 'gap' as const, data: b })),
        ]
    all.sort((a, b) => new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime())
    return all
  }, [events, blocks, selectedDate, selectedTag])

  const totalTracked = useMemo(
    () => (events ?? []).reduce((s, e) => s + e.durationMinutes, 0),
    [events],
  )
  const day = new Date(selectedDate + 'T00:00:00')
  const today = isToday(day)

  const loading = eventsLoading || blocksLoading

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 md:px-6">
      {/* Today dashboard — stats overview */}
      <TodayDashboard />

      {/* Day summary hero */}
      <DaySummary
        date={day}
        eventCount={events?.length ?? 0}
        trackedMinutes={totalTracked}
        gapCount={rows.filter((r) => r.kind === 'gap').length}
        today={today}
        events={events ?? []}
        dateISO={selectedDate}
        onScan={() => {
          detectGaps.mutate(selectedDate, {
            onSuccess: (d: { count?: number } | undefined) =>
              d?.count
                ? toast.success(`Found ${d.count} new gap${d.count === 1 ? '' : 's'}`)
                : toast.info('No new gaps detected'),
          })
        }}
        scanning={detectGaps.isPending}
        onAdd={() => setCreating(true)}
        onVoiceCapture={() => setVoiceCapture(true)}
      />

      {/* Hour-by-hour visual bar */}
      <HourBar />

      {/* Tag filter bar */}
      <TagFilterBar events={events ?? []} selectedTag={selectedTag} onTagSelect={setSelectedTag} />

      {/* Timeline rows */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyTimeline onAdd={() => setCreating(true)} />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {rows.map((row) =>
              row.kind === 'event' ? (
                <EventCard key={`ev-${row.data.id}`} event={row.data} />
              ) : (
                <GapCard key={`gap-${row.data.id}`} block={row.data} onResolve={() => setResolving(row.data)} />
              ),
            )}
          </div>
        </AnimatePresence>
      )}

      <EventFormDialog open={creating} onOpenChange={setCreating} />
      <VoiceCaptureDialog open={voiceCapture} onOpenChange={setVoiceCapture} />
      <ResolutionDialog block={resolving} open={!!resolving} onOpenChange={(v) => !v && setResolving(null)} />
    </div>
  )
}

function DaySummary({
  date,
  eventCount,
  trackedMinutes,
  gapCount,
  today,
  events,
  dateISO,
  onScan,
  scanning,
  onAdd,
  onVoiceCapture,
}: {
  date: Date
  eventCount: number
  trackedMinutes: number
  gapCount: number
  today: boolean
  events: TimelineEvent[]
  dateISO: string
  onScan: () => void
  scanning: boolean
  onAdd: () => void
  onVoiceCapture: () => void
}) {
  const hours = (trackedMinutes / 60).toFixed(1)
  const awakeMinutes = today
    ? Math.max(0, differenceInMinutes(new Date(), new Date(date.setHours(6, 0, 0, 0))))
    : 17 * 60
  const completion = awakeMinutes > 0 ? Math.min(100, Math.round((trackedMinutes / awakeMinutes) * 100)) : 0
  const status =
    gapCount > 0 ? (completion < 50 ? 'red' : 'yellow') : completion >= 85 ? 'green' : completion >= 50 ? 'yellow' : 'red'
  const statusColor = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-rose-500',
  }[status]

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-background/80 text-center shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{format(date, 'MMM')}</span>
            <span className="text-xl font-bold leading-none">{format(date, 'd')}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">
                {today ? 'Today' : format(date, 'EEEE')}
              </h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${statusColor}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                {status === 'green' ? 'Complete' : status === 'yellow' ? 'Partial' : 'Incomplete'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {eventCount} event{eventCount === 1 ? '' : 's'} · {hours}h tracked · {completion}% of waking hours
            </p>
            <div className="mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <motion.div
                className={`h-full rounded-full ${statusColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            {/* Category breakdown mini-bar */}
            {trackedMinutes > 0 && (
              <div className="mt-2 flex h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted/50">
                {getCategoryBreakdown(events).map((seg, i) => (
                  <div
                    key={i}
                    className={cn('h-full', seg.color)}
                    style={{ width: `${seg.percentage}%` }}
                    title={`${seg.name}: ${seg.hours}h`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-11 px-4" onClick={onScan} disabled={scanning}>
            <ScanLine className="mr-1.5 h-4 w-4" />
            {scanning ? 'Scanning…' : 'Scan'}
          </Button>
          <Button
            variant="outline"
            className="h-11 border-violet-500/40 px-4 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
            onClick={onVoiceCapture}
          >
            <Mic className="mr-1.5 h-4 w-4" />
            Speak
          </Button>
          <QuickAddButton date={dateISO} />
          <Button className="h-11 bg-emerald-600 px-4 hover:bg-emerald-700" onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add event
          </Button>
        </div>
      </div>
    </Card>
  )
}

function GapCard({ block, onResolve }: { block: UnknownBlock; onResolve: () => void }) {
  const hours = (block.durationMinutes / 60).toFixed(1)
  const severityColor = {
    low: 'border-amber-500/30 bg-amber-500/5',
    medium: 'border-orange-500/40 bg-orange-500/10',
    high: 'border-rose-500/50 bg-rose-500/10',
  }[block.severity]
  const severityDot = {
    low: 'bg-amber-500',
    medium: 'bg-orange-500',
    high: 'bg-rose-500',
  }[block.severity]

  return (
    <Card className={`border-dashed ${severityColor} group`}>
      <div className="flex items-center gap-3 p-3 pl-4">
        <div className={`absolute inset-y-0 left-0 w-1.5 ${severityDot} opacity-50`} />
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/60">
          <Hourglass className="h-4 w-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">Unknown time</span>
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              {hours}h gap
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(block.startTime), 'h:mm a')} – {format(new Date(block.endTime), 'h:mm a')} ·{' '}
            <button onClick={onResolve} className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
              What happened?
            </button>
          </p>
        </div>
        <Button variant="outline" className="h-11 border-amber-500/40 bg-background/50 px-4 hover:bg-amber-500/10" onClick={onResolve}>
          <Sparkles className="mr-1.5 h-4 w-4" /> Resolve
        </Button>
      </div>
    </Card>
  )
}

function EmptyTimeline({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="border-dashed py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <Clock className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">No events yet for this day</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Start logging your day. Every event you add helps the AI learn your patterns and fill future gaps.
          </p>
        </div>
        <Button size="lg" onClick={onAdd} className="h-12 bg-emerald-600 px-6 hover:bg-emerald-700">
          <Plus className="mr-2 h-5 w-5" />
          Add your first event
        </Button>
      </div>
    </Card>
  )
}

// Unused but reserved for future hint icon
void AlertCircle

function getCategoryBreakdown(events: TimelineEvent[]): { name: string; hours: string; percentage: number; color: string }[] {
  const map = new Map<string, number>()
  let total = 0
  for (const e of events) {
    const key = e.category?.color ?? 'slate'
    map.set(key, (map.get(key) ?? 0) + e.durationMinutes)
    total += e.durationMinutes
  }
  if (total === 0) return []
  const dotMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    orange: 'bg-orange-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
    yellow: 'bg-yellow-500',
    cyan: 'bg-cyan-500',
    teal: 'bg-teal-500',
  }
  return Array.from(map.entries())
    .map(([color, minutes]) => ({
      name: getCategoryName(color, events),
      hours: (minutes / 60).toFixed(1),
      percentage: (minutes / total) * 100,
      color: dotMap[color] ?? 'bg-slate-400',
    }))
    .sort((a, b) => b.percentage - a.percentage)
}

function getCategoryName(color: string, events: TimelineEvent[]): string {
  const found = events.find((e) => e.category?.color === color)
  return found?.category?.name ?? 'Other'
}
