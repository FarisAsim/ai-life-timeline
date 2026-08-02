import { db } from '@/lib/db'
import { differenceInMinutes } from 'date-fns'
import type { TimelineEvent, Category, EventSource } from '@/lib/types'

function serialize(e: Awaited<ReturnType<typeof db.timelineEvent.findFirst>> & object, category: Category | null): TimelineEvent {
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
    categoryId: e.categoryId,
    category,
    confidenceScore: e.confidenceScore,
    source: e.source as EventSource,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
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
    orderBy: { startTime: 'asc' },
  })

  const catMap = new Map<string, Category>()
  const cats = await db.category.findMany({ where: { userId } })
  cats.forEach((c) => catMap.set(c.id, { ...c, icon: c.icon }))

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
    orderBy: { startTime: 'asc' },
  })
  const catMap = new Map<string, Category>()
  const cats = await db.category.findMany({ where: { userId } })
  cats.forEach((c) => catMap.set(c.id, { ...c, icon: c.icon }))
  return events.map((e) => serialize(e, e.categoryId ? catMap.get(e.categoryId) ?? null : null))
}

export interface CreateEventInput {
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  notes?: string
  categoryId?: string | null
  confidenceScore?: number
  source?: EventSource
}

export async function createEvent(userId: string, input: CreateEventInput): Promise<TimelineEvent> {
  const start = new Date(input.startTime)
  const end = new Date(input.endTime)
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
      categoryId: input.categoryId ?? null,
      confidenceScore: input.confidenceScore ?? 1.0,
      source: input.source ?? 'user_manual',
    },
  })
  const cat = created.categoryId ? await db.category.findUnique({ where: { id: created.categoryId } }) : null
  return serialize(created, cat ? { ...cat, icon: cat.icon } : null)
}

export async function updateEvent(userId: string, eventId: string, input: Partial<CreateEventInput>): Promise<TimelineEvent | null> {
  const existing = await db.timelineEvent.findFirst({ where: { id: eventId, userId } })
  if (!existing) return null
  const start = input.startTime ? new Date(input.startTime) : existing.startTime
  const end = input.endTime ? new Date(input.endTime) : existing.endTime
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
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      confidenceScore: input.confidenceScore ?? existing.confidenceScore,
      source: input.source ?? existing.source,
    },
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
  const e = await db.timelineEvent.findFirst({ where: { id: eventId, userId } })
  if (!e) return null
  const cat = e.categoryId ? await db.category.findUnique({ where: { id: e.categoryId } }) : null
  return serialize(e, cat ? { ...cat, icon: cat.icon } : null)
}
