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
import { Loader2 } from 'lucide-react'

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit event' : 'New timeline event'}</DialogTitle>
          <DialogDescription>
            {existing ? 'Update the details of this event.' : 'Add an activity to your timeline. The system will detect any new gaps.'}
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
  const { data: categories } = useCategories()
  const createMut = useCreateEvent()
  const updateMut = useUpdateEvent()

  const isEdit = !!existing
  const initStart = existing ? toLocalInput(new Date(existing.startTime)) : toLocalInput(defaultStart ?? new Date())
  const initEnd = existing ? toLocalInput(new Date(existing.endTime)) : toLocalInput(defaultEnd ?? new Date((defaultStart ?? new Date()).getTime() + 60 * 60 * 1000))

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
      toast.error('Title is required')
      return
    }
    if (!start || !end) {
      toast.error('Start and end time are required')
      return
    }
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (endDate <= startDate) {
      toast.error('End time must be after start time')
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
        toast.success('Event updated')
      } else {
        await createMut.mutateAsync(payload)
        toast.success('Event created')
      }
      onDone()
    } catch {
      toast.error('Failed to save event')
    }
  }

  return (
    <>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="ev-title">Title</Label>
          <Input
            id="ev-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Deep work — coding"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="ev-start">Start</Label>
            <Input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ev-end">End</Label>
            <Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ev-cat">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="ev-cat">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ev-loc">Location (optional)</Label>
          <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Office, Home, Gym" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ev-desc">Description (optional)</Label>
          <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What happened?" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ev-notes">Notes (optional)</Label>
          <Textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Private notes" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ev-tags">Tags (optional)</Label>
          <Input
            id="ev-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="project-x, health, urgent"
          />
          <p className="text-[10px] text-muted-foreground">Comma-separated. Use tags to group events across categories.</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Create event'}
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
