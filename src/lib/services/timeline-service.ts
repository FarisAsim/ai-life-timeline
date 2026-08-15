import { db } from '@/lib/db'
import { differenceInMinutes } from 'date-fns'
import { validateEventTimes, OverlapError } from './overlap-service'
import type { TimelineEvent, Category, EventSource, Attachment } from '@/lib/types'

type EventWithRelations = Awaited<ReturnType<typeof db.timelineEvent.findFirst>> & {
  attachments?: { id: string; eventId: string; type: string; filename: string; mimeType: string; size: number; createdAt: Date }[]
}

function serialize(e: EventWithRelations, category: Category | null): TimelineEvent {
  return {
    id: e.id,
    userId: e.userId,
    title: e.title,
    description: e.description,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    durationMinutes: e.durationMinutes,
    location: e.location,
    notes: e.notes,
    tags: e.tags ? e.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    categoryId: e.categoryId,
    category,
    attachments: (e.attachments ?? []).map((a) => ({
      id: a.id,
      eventId: a.eventId,
      type: a.type as Attachment['type'],
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      hasData: true,
      transcript: 'transcript' in a ? (a as { transcript?: string }).transcript ?? null : null,
      createdAt: a.createdAt.toISOString(),
    })),
    confidenceScore: e.confidenceScore,
    source: e.source as EventSource,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

async function getCatMap(userId: string): Promise<Map<string, Category>> {
  const cats = await db.category.findMany({ where: { userId } })
  const m = new Map<string, Category>()
  cats.forEach((c) => m.set(c.id, { ...c, icon: c.icon }))
  return m
}

export async function listEventsForDay(userId: string, dateISO: string): Promise<TimelineEvent[]> {
  const day = new Date(dateISO + 'T00:00:00')
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(day)
  end.setHours(23, 59, 59, 999)

  const events = await db.timelineEvent.findMany({
    where: {
      userId,
      OR: [
        { startTime: { gte: start, lte: end } },
        { endTime: { gte: start, lte: end } },
        { AND: [{ startTime: { lte: start } }, { endTime: { gte: end } }] },
      ],
    },
    include: { attachments: { orderBy: { createdAt: 'asc' } } },
    orderBy: { startTime: 'asc' },
  })

  const catMap = await getCatMap(userId)
  return events.map((e) => serialize(e, e.categoryId ? catMap.get(e.categoryId) ?? null : null))
}

export async function listEventsForRange(userId: string, startISO: string, endISO: string): Promise<TimelineEvent[]> {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const events = await db.timelineEvent.findMany({
    where: {
      userId,
      OR: [
        { startTime: { gte: start, lte: end } },
        { endTime: { gte: start, lte: end } },
        { AND: [{ startTime: { lte: start } }, { endTime: { gte: end } }] },
      ],
    },
    include: { attachments: true },
    orderBy: { startTime: 'asc' },
  })
  const catMap = await getCatMap(userId)
  return events.map((e) => serialize(e, e.categoryId ? catMap.get(e.categoryId) ?? null : null))
}

export interface CreateEventInput {
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  notes?: string
  tags?: string[]
  categoryId?: string | null
  confidenceScore?: number
  source?: EventSource
}

export async function createEvent(userId: string, input: CreateEventInput): Promise<TimelineEvent> {
  const start = new Date(input.startTime)
  const end = new Date(input.endTime)
  await validateEventTimes(userId, start, end)
  const duration = Math.max(0, differenceInMinutes(end, start))
  const created = await db.timelineEvent.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      startTime: start,
      endTime: end,
      durationMinutes: duration,
      location: input.location ?? null,
      notes: input.notes ?? null,
      tags: input.tags && input.tags.length > 0 ? input.tags.join(',') : null,
      categoryId: input.categoryId ?? null,
      confidenceScore: input.confidenceScore ?? 1.0,
      source: input.source ?? 'user_manual',
    },
    include: { attachments: true },
  })
  const cat = created.categoryId ? await db.category.findUnique({ where: { id: created.categoryId } }) : null
  return serialize(created, cat ? { ...cat, icon: cat.icon } : null)
}

export async function updateEvent(userId: string, eventId: string, input: Partial<CreateEventInput>): Promise<TimelineEvent | null> {
  const existing = await db.timelineEvent.findFirst({ where: { id: eventId, userId } })
  if (!existing) return null
  const start = input.startTime ? new Date(input.startTime) : existing.startTime
  const end = input.endTime ? new Date(input.endTime) : existing.endTime
  await validateEventTimes(userId, start, end, eventId)
  const duration = Math.max(0, differenceInMinutes(end, start))
  const updated = await db.timelineEvent.update({
    where: { id: eventId },
    data: {
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      startTime: start,
      endTime: end,
      durationMinutes: duration,
      location: input.location ?? existing.location,
      notes: input.notes ?? existing.notes,
      tags: input.tags !== undefined ? (input.tags.length > 0 ? input.tags.join(',') : null) : existing.tags,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      confidenceScore: input.confidenceScore ?? existing.confidenceScore,
      source: input.source ?? existing.source,
    },
    include: { attachments: true },
  })
  const cat = updated.categoryId ? await db.category.findUnique({ where: { id: updated.categoryId } }) : null
  return serialize(updated, cat ? { ...cat, icon: cat.icon } : null)
}

export async function deleteEvent(userId: string, eventId: string): Promise<boolean> {
  const existing = await db.timelineEvent.findFirst({ where: { id: eventId, userId } })
  if (!existing) return false
  await db.timelineEvent.delete({ where: { id: eventId } })
  return true
}

export async function getEvent(userId: string, eventId: string): Promise<TimelineEvent | null> {
  const e = await db.timelineEvent.findFirst({ where: { id: eventId, userId }, include: { attachments: true } })
  if (!e) return null
  const cat = e.categoryId ? await db.category.findUnique({ where: { id: e.categoryId } }) : null
  return serialize(e, cat ? { ...cat, icon: cat.icon } : null)
}

// ---------- Attachments ----------

export async function addAttachment(userId: string, eventId: string, file: { filename: string; mimeType: string; size: number; data: string }) {
  // Verify ownership
  const event = await db.timelineEvent.findFirst({ where: { id: eventId, userId } })
  if (!event) return null
  const type: string = file.mimeType.startsWith('image/') ? 'photo' : file.mimeType.startsWith('audio/') ? 'voice_note' : 'file'
  const att = await db.attachment.create({
    data: {
      eventId,
      userId,
      type,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      data: file.data,
    },
  })

  // Auto-transcribe voice notes in the background (fire-and-forget, non-blocking)
  if (type === 'voice_note') {
    autoTranscribe(att.id, file.data).catch(() => {
      // Silent failure — user can retry via the Transcribe button
    })
  }

  return { id: att.id, type: att.type, filename: att.filename, mimeType: att.mimeType, size: att.size, eventId: att.eventId, hasData: true, transcript: att.transcript, createdAt: att.createdAt.toISOString() }
}

// Background auto-transcription using the unified AI provider (fire-and-forget)
async function autoTranscribe(attachmentId: string, audioBase64: string) {
  try {
    const { transcribeAudio, isRemoteAIConfigured } = await import('@/lib/ai-provider')
    if (!isRemoteAIConfigured()) return
    const { text } = await transcribeAudio(audioBase64)
    if (text) {
      await db.attachment.update({ where: { id: attachmentId }, data: { transcript: text } })
    }
  } catch {
    // Silent failure — non-critical background task
  }
}

export async function getAttachmentData(userId: string, attachmentId: string) {
  const att = await db.attachment.findFirst({ where: { id: attachmentId, userId } })
  if (!att) return null
  return { data: att.data, mimeType: att.mimeType, filename: att.filename }
}

export async function deleteAttachment(userId: string, attachmentId: string) {
  const att = await db.attachment.findFirst({ where: { id: attachmentId, userId } })
  if (!att) return false
  await db.attachment.delete({ where: { id: attachmentId } })
  return true
}
