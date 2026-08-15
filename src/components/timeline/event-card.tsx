'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { EventFormDialog, formatTimeRange } from './event-form-dialog'
import { useDeleteEvent, useUploadAttachment, useDeleteAttachment, attachmentUrl, useCreateTemplate, useCreateEvent } from '@/hooks/use-data'
import { useDragDrop } from '@/hooks/use-drag-drop'
import type { TimelineEvent } from '@/lib/types'
import { CATEGORY_COLOR_MAP, SOURCE_LABELS } from '@/lib/types'
import { format } from 'date-fns'
import {
  Pencil, Trash2, MapPin, Clock, ChevronDown, Sparkles, Bot, Paperclip, X, Star, Copy, MoreHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'
import { VoiceNoteRecorder, VoiceNotePlayer } from './voice-note-recorder'

const CATEGORY_HEX: Record<string, string> = {
  emerald: '#10b981', violet: '#8b5cf6', orange: '#f97316', indigo: '#6366f1',
  amber: '#f59e0b', rose: '#f43f5e', slate: '#64748b', yellow: '#eab308',
  cyan: '#06b6d4', teal: '#14b8a6',
}

function formatDuration(minutes: number, isAr: boolean): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (isAr) {
    if (h === 0) return `${m} دقيقة`
    if (m === 0) return `${h}س`
    return `${h}س ${m}د`
  }
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EventCard({ event }: { event: TimelineEvent }) {
  const { locale, t } = useTranslation()
  const isAr = locale === 'ar-EG'
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const deleteMut = useDeleteEvent()
  const uploadMut = useUploadAttachment()
  const deleteAttMut = useDeleteAttachment()
  const createTemplateMut = useCreateTemplate()
  const createEventMut = useCreateEvent()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { dragHandlers, dropzoneClassName, isDragging } = useDragDrop({ eventId: event.id, onUploaded: () => setExpanded(true) })

  const color = event.category ? (CATEGORY_COLOR_MAP[event.category.color] ?? CATEGORY_COLOR_MAP.slate) : null
  const start = new Date(event.startTime)
  const isAiSource = event.source === 'ai_guess' || event.source === 'ai_confirmed'
  const hasExtras = !!(event.description || event.notes || event.location || event.attachments.length > 0)
  const photoAttachments = event.attachments.filter((a) => a.type === 'photo')
  const voiceAttachments = event.attachments.filter((a) => a.type === 'voice_note')
  const otherAttachments = event.attachments.filter((a) => a.type !== 'photo' && a.type !== 'voice_note')

  const handleDelete = () => {
    setActionSheetOpen(false)
    deleteMut.mutate(event.id, {
      onSuccess: () => toast.success(t('timeline.eventDeleted')),
      onError: () => toast.error(t('timeline.deleteFailed')),
    })
  }

  const handleSaveAsTemplate = () => {
    setActionSheetOpen(false)
    createTemplateMut.mutate(
      { title: event.title, categoryId: event.categoryId, durationMin: event.durationMinutes, description: event.description ?? undefined },
      {
        onSuccess: () => toast.success(t('event.savedTemplate', { title: event.title })),
        onError: () => toast.error(t('event.saveTemplateFailed')),
      },
    )
  }

  const handleDuplicate = () => {
    setActionSheetOpen(false)
    const now = new Date()
    createEventMut.mutate(
      {
        title: event.title,
        description: event.description ?? undefined,
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() + event.durationMinutes * 60 * 1000).toISOString(),
        location: event.location ?? undefined,
        notes: event.notes ?? undefined,
        tags: event.tags,
        categoryId: event.categoryId,
        source: 'user_manual',
        confidenceScore: 1.0,
      },
      {
        onSuccess: () => toast.success(t('event.duplicated', { title: event.title })),
        onError: () => toast.error(t('event.duplicateFailed')),
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
            'group relative overflow-hidden border-l-4 py-0 transition-all hover:shadow-md',
            dropzoneClassName,
            isDragging && 'border-emerald-500/60 bg-emerald-500/5',
          )}
          style={color ? { borderLeftColor: CATEGORY_HEX[event.category?.color ?? 'slate'] ?? '#64748b' } : { borderLeftColor: '#cbd5e1' }}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
                <Paperclip className="h-4 w-4" />
                {t('event.dropPhotos')}
              </div>
            </div>
          )}

          <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color?.dot?.replace('bg-', '') ? CATEGORY_HEX[event.category?.color ?? 'slate'] ?? '#64748b' : '#cbd5e1' }} />

          <div className="p-4 pl-5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold">{event.title}</h3>
                  {isAiSource && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                      {event.source === 'ai_confirmed' ? <Sparkles className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      {SOURCE_LABELS[event.source]}
                    </span>
                  )}
                  {event.attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-400/10 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <Paperclip className="h-3 w-3" />
                      {event.attachments.length}
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {isAr ? `${format(start, 'h:mm a')} – ${format(new Date(event.endTime), 'h:mm a')}` : `${format(start, 'h:mm a')} – ${format(new Date(event.endTime), 'h:mm a')}`}
                  </span>
                  <span className="text-muted-foreground/60">{isAr ? '،' : '·'}</span>
                  <span>{formatDuration(event.durationMinutes, isAr)}</span>
                  {event.location && (
                    <>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground/60">·</span>
                  <span className="flex items-center gap-1">
                    <span className={cn('inline-block h-2.5 w-2.5 rounded-full', color?.dot ?? 'bg-slate-300')} />
                    {event.category?.name ?? t('settings.uncategorized')}
                  </span>
                </div>

                {/* Tags */}
                {event.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {event.tags.map((tag) => (
                      <span key={tag} className="rounded bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action button — 44px touch target, opens bottom sheet */}
              <button
                onClick={() => setActionSheetOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                aria-label={t('event.actions')}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>

            {/* Expandable details */}
            <AnimatePresence initial={false}>
              {expanded && hasExtras && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                    {event.description && (
                      <p className="text-foreground/80">{event.description}</p>
                    )}
                    {event.notes && (
                      <p className="italic text-muted-foreground">{event.notes}</p>
                    )}
                    {/* Photos */}
                    {photoAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {photoAttachments.map((att) => (
                          <div key={att.id} className="group/photo relative">
                            <img
                              src={attachmentUrl(att.id)}
                              alt={att.filename}
                              className="h-20 w-20 cursor-pointer rounded-lg border object-cover transition-transform hover:scale-105"
                              onClick={() => setLightbox(attachmentUrl(att.id))}
                            />
                            <button
                              onClick={() => deleteAttMut.mutate(att.id, { onSuccess: () => toast.success(t('event.photoRemoved')) })}
                              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover/photo:opacity-100"
                              aria-label={t('event.deletePhoto')}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Voice notes */}
                    {voiceAttachments.length > 0 && (
                      <div className="space-y-2">
                        {voiceAttachments.map((att) => (
                          <VoiceNotePlayer
                            key={att.id}
                            attachmentId={att.id}
                            filename={att.filename}
                            transcript={att.transcript}
                            onDelete={() => deleteAttMut.mutate(att.id, { onSuccess: () => toast.success(t('event.voiceRemoved')) })}
                          />
                        ))}
                      </div>
                    )}
                    {/* Voice recorder */}
                    <VoiceNoteRecorder eventId={event.id} onDone={() => setExpanded(true)} />
                    {/* Other attachments */}
                    {otherAttachments.length > 0 && (
                      <div className="space-y-1">
                        {otherAttachments.map((att) => (
                          <div key={att.id} className="flex items-center gap-2 rounded-lg border p-2">
                            <span className="flex-1 truncate text-sm">{att.filename}</span>
                            <span className="text-xs text-muted-foreground">{formatBytes(att.size)}</span>
                            <button onClick={() => deleteAttMut.mutate(att.id, { onSuccess: () => toast.success(t('event.removed')) })} className="text-rose-500" aria-label={t('event.delete')}>
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Meta */}
                    <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                      <span>{t('event.confidence')}: {Math.round(event.confidenceScore * 100)}%</span>
                      <span>·</span>
                      <span>{t('event.sourceLabel')}: {SOURCE_LABELS[event.source]}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expand toggle — 44px touch target */}
            {hasExtras && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-lg text-sm text-muted-foreground hover:bg-accent"
                aria-label={expanded ? t('event.hideDetails') : t('event.showDetails')}
                aria-expanded={expanded}
              >
                <motion.span animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
                <span>{expanded ? t('event.less') : t('event.more')}</span>
              </button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          uploadMut.mutate({ eventId: event.id, file }, {
            onSuccess: () => { toast.success(t('event.photoAttached')); setExpanded(true) },
            onError: (err) => toast.error(err.message),
          })
          e.target.value = ''
        }}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label={t('event.photoViewer')}
        >
          <img src={lightbox} alt="Attachment" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
          <button className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label={t("event.close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Action sheet — touch-friendly bottom sheet instead of dropdown */}
      <Sheet open={actionSheetOpen} onOpenChange={setActionSheetOpen}>
        <SheetContent className="p-0" side="bottom">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="truncate">{event.title}</SheetTitle>
          </SheetHeader>
          <div className="space-y-1 p-2">
            {/* Each action: 48px touch target */}
            <button
              onClick={() => { setActionSheetOpen(false); setEditing(true) }}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-medium hover:bg-accent"
            >
              <Pencil className="h-5 w-5 text-emerald-600" />
              {t('event.edit')}
            </button>
            <button
              onClick={() => { setActionSheetOpen(false); fileInputRef.current?.click() }}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-medium hover:bg-accent"
            >
              <Paperclip className="h-5 w-5 text-blue-600" />
              {t('event.attachPhoto')}
            </button>
            <button
              onClick={handleDuplicate}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-medium hover:bg-accent"
            >
              <Copy className="h-5 w-5 text-violet-600" />
              {t('event.duplicate')}
            </button>
            <button
              onClick={handleSaveAsTemplate}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-medium hover:bg-accent"
            >
              <Star className="h-5 w-5 text-amber-600" />
              {t('event.saveAsTemplate')}
            </button>
            <div className="my-1 border-t" />
            <button
              onClick={handleDelete}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-medium text-rose-600 hover:bg-rose-500/10"
            >
              <Trash2 className="h-5 w-5" />
              {t('event.delete')}
            </button>
          </div>
          <SheetFooter className="p-2 pt-0">
            <button
              onClick={() => setActionSheetOpen(false)}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-muted text-base font-medium"
            >
              {t('event.cancel')}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {editing && <EventFormDialog open={editing} onOpenChange={setEditing} existing={event} />}
    </>
  )
}
