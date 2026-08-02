'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { EventFormDialog, formatTimeRange } from './event-form-dialog'
import { useDeleteEvent } from '@/hooks/use-data'
import type { TimelineEvent } from '@/lib/types'
import { CATEGORY_COLOR_MAP, SOURCE_LABELS } from '@/lib/types'
import { format } from 'date-fns'
import {
  MoreVertical, Pencil, Trash2, MapPin, Clock, AlignLeft, StickyNote, ChevronDown, ChevronRight, Sparkles, Bot,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function EventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const deleteMut = useDeleteEvent()

  const color = event.category ? (CATEGORY_COLOR_MAP[event.category.color] ?? CATEGORY_COLOR_MAP.slate) : null
  const start = new Date(event.startTime)
  const isAiSource = event.source === 'ai_guess' || event.source === 'ai_confirmed'
  const hasExtras = !!(event.description || event.notes || event.location)

  const handleDelete = () => {
    deleteMut.mutate(event.id, {
      onSuccess: () => toast.success('Event deleted'),
      onError: () => toast.error('Failed to delete'),
    })
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Card
          className={cn(
            'group relative overflow-hidden border-l-4 py-0 transition-all hover:shadow-md hover:shadow-emerald-500/5',
          )}
          style={color ? { borderLeftColor: getCategoryHex(event.category?.color) } : { borderLeftColor: '#cbd5e1' }}
        >
          {/* Color strip */}
          <div className={cn('absolute inset-y-0 left-0 w-1.5', color?.dot ?? 'bg-slate-300')} />
          <div className="flex items-stretch gap-3 pl-3.5 pr-3 py-3">
            {/* Time column */}
            <div className="hidden w-16 shrink-0 sm:block">
              <div className="text-xs font-semibold text-foreground">{format(start, 'h:mm a')}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{formatDuration(event.durationMinutes)}</div>
            </div>

            {/* Body */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{event.title}</h3>
                    {isAiSource && (
                      <Badge variant="outline" className="gap-1 border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                        {event.source === 'ai_confirmed' ? <Sparkles className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                        {SOURCE_LABELS[event.source]}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 sm:hidden">
                      <Clock className="h-3 w-3" />
                      {formatTimeRange(event.startTime, event.endTime)}
                    </span>
                    <span className="hidden items-center gap-1 sm:flex">
                      <Clock className="h-3 w-3" />
                      {format(start, 'h:mm a')} – {format(new Date(event.endTime), 'h:mm a')}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className={cn('inline-block h-2 w-2 rounded-full', color?.dot ?? 'bg-slate-300')} />
                      {event.category?.name ?? 'Uncategorized'}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {hasExtras && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setExpanded((v) => !v)}
                      aria-label="Toggle details"
                    >
                      <motion.span animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                        <ChevronDown className="h-4 w-4" />
                      </motion.span>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 group-hover:opacity-100" aria-label="Event menu">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(true)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setExpanded((v) => !v)}>
                        <AlignLeft className="mr-2 h-3.5 w-3.5" /> {expanded ? 'Hide details' : 'Show details'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={handleDelete}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {expanded && hasExtras && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1.5 border-t pt-2 text-xs">
                      {event.description && (
                        <div className="flex gap-1.5">
                          <AlignLeft className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-foreground/80">{event.description}</span>
                        </div>
                      )}
                      {event.notes && (
                        <div className="flex gap-1.5">
                          <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="italic text-muted-foreground">{event.notes}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          Confidence: {Math.round(event.confidenceScore * 100)}%
                        </span>
                        <span>·</span>
                        <span>Source: {SOURCE_LABELS[event.source]}</span>
                        <span>·</span>
                        <span>Created: {format(new Date(event.createdAt), 'MMM d')}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Card>
      </motion.div>

      {editing && <EventFormDialog open={editing} onOpenChange={setEditing} existing={event} />}
    </>
  )
}

function getCategoryHex(color: string | undefined): string {
  const map: Record<string, string> = {
    emerald: '#10b981',
    violet: '#8b5cf6',
    orange: '#f97316',
    indigo: '#6366f1',
    amber: '#f59e0b',
    rose: '#f43f5e',
    slate: '#64748b',
    yellow: '#eab308',
    cyan: '#06b6d4',
    teal: '#14b8a6',
  }
  return color ? (map[color] ?? '#64748b') : '#cbd5e1'
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
