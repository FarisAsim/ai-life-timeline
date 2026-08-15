'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCategories, useCreateEvent, useUpdateEvent } from '@/hooks/use-data'
import type { TimelineEvent } from '@/lib/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Loader2, ChevronDown } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventFormDialog({
  open,
  onOpenChange,
  existing,
  defaultStart,
  defaultEnd,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  existing?: TimelineEvent | null
  defaultStart?: Date
  defaultEnd?: Date
}) {
  // Keyed remount: when `open` toggles or the target event changes, the form
  // body re-initializes its state from props via useState initializers.
  const formKey = `${open}-${existing?.id ?? 'new'}-${defaultStart?.getTime() ?? 0}`
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? t('event.edit') : t('event.new')}</DialogTitle>
          <DialogDescription>
            {existing ? t('event.updateDesc') : t('event.newDesc')}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EventFormBody
            key={formKey}
            existing={existing ?? null}
            defaultStart={defaultStart}
            defaultEnd={defaultEnd}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EventFormBody({
  existing,
  defaultStart,
  defaultEnd,
  onDone,
}: {
  existing: TimelineEvent | null
  defaultStart?: Date
  defaultEnd?: Date
  onDone: () => void
}) {
  const { t, locale } = useTranslation()
  const isAr = locale === 'ar-EG'
  const { data: categories } = useCategories()
  const createMut = useCreateEvent()
  const updateMut = useUpdateEvent()

  const isEdit = !!existing
  const initStart = existing ? toLocalInput(new Date(existing.startTime)) : toLocalInput(defaultStart ?? new Date())
  // DON'T default end to +1h — leave it empty so user must set it
  const initEnd = existing ? toLocalInput(new Date(existing.endTime)) : (defaultEnd ? toLocalInput(defaultEnd) : '')

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [start, setStart] = useState(initStart)
  const [end, setEnd] = useState(initEnd)
  const [categoryId, setCategoryId] = useState<string>(existing?.categoryId ?? 'none')
  const [location, setLocation] = useState(existing?.location ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [tagsInput, setTagsInput] = useState(existing?.tags?.join(', ') ?? '')

  const pending = createMut.isPending || updateMut.isPending

  const submit = async () => {
    if (!title.trim()) {
      toast.error(t('event.titleRequired'))
      return
    }
    if (!start) {
      toast.error(t('event.startRequired'))
      return
    }
    if (!end) {
      toast.error(t('event.endRequired'))
      return
    }
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (endDate <= startDate) {
      toast.error(t('event.endAfterStart'))
      return
    }
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        categoryId: categoryId === 'none' ? null : categoryId,
      }
      if (isEdit && existing) {
        await updateMut.mutateAsync({ id: existing.id, ...payload })
        toast.success(t('timeline.eventUpdated'))
      } else {
        await createMut.mutateAsync(payload)
        toast.success(t('timeline.eventCreated'))
      }
      onDone()
    } catch {
      toast.error(t('timeline.saveFailed'))
    }
  }

  return (
    <>
      <div className="grid gap-3 py-2">
        {/* Title - the only required field, big and prominent */}
        <Input
          id="ev-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isEdit ? t('event.titlePlaceholder') : t('event.whatNow')}
          autoFocus
          className="h-12 text-base"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) {
              e.preventDefault()
              submit()
            }
          }}
        />

        {/* Quick time row - simple and mobile-friendly */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="ev-start" className="mb-1 block text-xs text-muted-foreground">{t('event.start')}</Label>
            <Input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="h-11" />
          </div>
          <div>
            <Label htmlFor="ev-end" className="mb-1 block text-xs text-muted-foreground">{t('event.end')}</Label>
            <Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11" />
          </div>
        </div>

        {/* Category - quick horizontal scroll on mobile */}
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">{t('settings.templateCategory')}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="ev-cat" className="h-11"><SelectValue placeholder={t('settings.selectCategory')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('settings.noCategory')}</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Optional details - collapsible */}
        <details className="group">
          <summary className="flex h-9 cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            {t('event.moreDetails')}
          </summary>
          <div className="mt-2 space-y-2">
            <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('event.locPlaceholder')} className="h-11" />
            <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('event.descPlaceholder')} />
            <Textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('event.notesPlaceholder')} />
            <Input id="ev-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder={t('event.tagsPlaceholder')} className="h-11" />
          </div>
        </details>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending} className="h-11">
          {t('event.cancel')}
        </Button>
        <Button onClick={submit} disabled={pending || !title.trim()} className="h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {isEdit ? t('event.save') : t('event.add')}
        </Button>
      </DialogFooter>
    </>
  )
}

export function formatTimeRange(startISO: string, endISO: string) {
  const s = new Date(startISO)
  const e = new Date(endISO)
  const sameDay = s.toDateString() === e.toDateString()
  if (sameDay) {
    return `${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`
  }
  return `${format(s, 'MMM d, h:mm a')} – ${format(e, 'MMM d, h:mm a')}`
}
