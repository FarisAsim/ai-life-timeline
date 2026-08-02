'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { EventFormDialog, formatTimeRange } from './event-form-dialog'
import { useDeleteEvent, useUploadAttachment, useDeleteAttachment, attachmentUrl, useCreateTemplate } from '@/hooks/use-data'
import { useDragDrop } from '@/hooks/use-drag-drop'
import type { TimelineEvent } from '@/lib/types'
import { CATEGORY_COLOR_MAP, SOURCE_LABELS } from '@/lib/types'
import { format } from 'date-fns'
import {
  MoreVertical, Pencil, Trash2, MapPin, Clock, AlignLeft, StickyNote, ChevronDown, Sparkles, Bot, Paperclip, Image as ImageIcon, FileText, X, Loader2, Mic, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { VoiceNoteRecorder, VoiceNotePlayer } from './voice-note-recorder'

export function EventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const deleteMut = useDeleteEvent()
  const uploadMut = useUploadAttachment()
  const deleteAttMut = useDeleteAttachment()
  const createTemplateMut = useCreateTemplate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isDragging, dragHandlers, dropzoneClassName } = useDragDrop({ eventId: event.id, onUploaded: () => setExpanded(true) })

  const color = event.category ? (CATEGORY_COLOR_MAP[event.category.color] ?? CATEGORY_COLOR_MAP.slate) : null
  const start = new Date(event.startTime)
  const isAiSource = event.source === 'ai_guess' || event.source === 'ai_confirmed'
  const hasExtras = !!(event.description || event.notes || event.location || event.attachments.length > 0)
  const photoAttachments = event.attachments.filter((a) => a.type === 'photo')
  const voiceAttachments = event.attachments.filter((a) => a.type === 'voice_note')
  const otherAttachments = event.attachments.filter((a) => a.type !== 'photo' && a.type !== 'voice_note')

  const handleDelete = () => {
    deleteMut.mutate(event.id, {
      onSuccess: () => toast.success('Event deleted'),
      onError: () => toast.error('Failed to delete'),
    })
  }

  const handleSaveAsTemplate = () => {
    createTemplateMut.mutate(
      {
        title: event.title,
        categoryId: event.categoryId,
        durationMin: event.durationMinutes,
        description: event.description ?? undefined,
      },
      {
        onSuccess: () => toast.success(`"${event.title}" saved as template`),
        onError: () => toast.error('Failed to save template'),
      },
    )
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
          {...dragHandlers}
          className={cn(
            'group relative overflow-hidden border-l-4 py-0 transition-all hover:shadow-md hover:shadow-emerald-500/5',
            dropzoneClassName,
            isDragging && 'border-emerald-500/60 bg-emerald-500/5',
          )}
          style={color ? { borderLeftColor: getCategoryHex(event.category?.color) } : { borderLeftColor: '#cbd5e1' }}
        >
          {/* Drag overlay hint */}
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                <Paperclip className="h-3.5 w-3.5" />
                Drop photos to attach
              </div>
            </div>
          )}
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
                    {event.attachments.length > 0 && (
                      <Badge variant="outline" className="gap-1 border-slate-400/30 bg-slate-400/10 px-1.5 py-0 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                        <Paperclip className="h-2.5 w-2.5" />
                        {event.attachments.length}
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
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="mr-2 h-3.5 w-3.5" /> Attach photo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setExpanded(true)}>
                        <Mic className="mr-2 h-3.5 w-3.5" /> Record voice note
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSaveAsTemplate}>
                        <Star className="mr-2 h-3.5 w-3.5" /> Save as template
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
                    <div className="mt-2 space-y-2 border-t pt-2 text-xs">
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
                      {/* Photo gallery */}
                      {photoAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {photoAttachments.map((att) => (
                            <div key={att.id} className="group/photo relative">
                              <img
                                src={attachmentUrl(att.id)}
                                alt={att.filename}
                                className="h-16 w-16 cursor-pointer rounded-md border object-cover transition-transform hover:scale-105"
                                onClick={() => setLightbox(attachmentUrl(att.id))}
                              />
                              <button
                                onClick={() => deleteAttMut.mutate(att.id, { onSuccess: () => toast.success('Photo removed') })}
                                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white group-hover/photo:flex"
                                aria-label="Delete photo"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Voice notes */}
                      {voiceAttachments.length > 0 && (
                        <div className="space-y-1">
                          {voiceAttachments.map((att) => (
                            <VoiceNotePlayer
                              key={att.id}
                              attachmentId={att.id}
                              filename={att.filename}
                              transcript={att.transcript}
                              onDelete={() => deleteAttMut.mutate(att.id, { onSuccess: () => toast.success('Voice note removed') })}
                            />
                          ))}
                        </div>
                      )}
                      {/* Voice note recorder */}
                      <VoiceNoteRecorder eventId={event.id} onDone={() => setExpanded(true)} />
                      {/* Other attachments */}
                      {otherAttachments.length > 0 && (
                        <div className="space-y-1">
                          {otherAttachments.map((att) => (
                            <div key={att.id} className="flex items-center gap-2 rounded-md border p-1.5">
                              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <a href={attachmentUrl(att.id)} download={att.filename} className="flex-1 truncate text-foreground/80 hover:underline">
                                {att.filename}
                              </a>
                              <span className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</span>
                              <button
                                onClick={() => deleteAttMut.mutate(att.id, { onSuccess: () => toast.success('Attachment removed') })}
                                className="text-rose-500 hover:text-rose-700"
                                aria-label="Delete attachment"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
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

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          if (!file.type.startsWith('image/')) {
            toast.error('Only image files are supported')
            return
          }
          uploadMut.mutate(
            { eventId: event.id, file },
            {
              onSuccess: () => {
                toast.success('Photo attached')
                setExpanded(true)
              },
              onError: (err) => toast.error(err.message),
            },
          )
          e.target.value = ''
        }}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Attachment" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

void ImageIcon
void Loader2
