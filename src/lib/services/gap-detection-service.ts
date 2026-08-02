import { db } from '@/lib/db'
import { differenceInMinutes } from 'date-fns'
import type { UnknownBlock, UnknownBlockSeverity, UnknownBlockStatus, Category, TimelineEvent } from '@/lib/types'

const MIN_GAP_MINUTES = 15

function severityForDuration(min: number): UnknownBlockSeverity {
  if (min >= 120) return 'high'
  if (min >= 45) return 'medium'
  return 'low'
}

export async function detectGapsForDay(userId: string, dateISO: string): Promise<UnknownBlock[]> {
  const day = new Date(dateISO + 'T00:00:00')
  const dayStart = new Date(day)
  dayStart.setHours(6, 0, 0, 0) // assume waking day starts at 6am
  const dayEnd = new Date(day)
  dayEnd.setHours(23, 0, 0, 0) // assume day ends at 11pm

  // If the selected date is today, only detect up to "now"
  const now = new Date()
  const isToday = dayStart.toDateString() === now.toDateString()
  const scanEnd = isToday && now < dayEnd ? now : dayEnd

  const events = await db.timelineEvent.findMany({
    where: {
      userId,
      OR: [
        { startTime: { gte: dayStart, lte: scanEnd } },
        { endTime: { gte: dayStart, lte: scanEnd } },
        { AND: [{ startTime: { lte: dayStart } }, { endTime: { gte: scanEnd } }] },
      ],
    },
    orderBy: { startTime: 'asc' },
  })

  const gaps: { start: Date; end: Date }[] = []
  let cursor = dayStart
  for (const ev of events) {
    const evStart = ev.startTime < dayStart ? dayStart : ev.startTime
    const evEnd = ev.endTime > scanEnd ? scanEnd : ev.endTime
    if (evStart > cursor) {
      const gapMin = differenceInMinutes(evStart, cursor)
      if (gapMin >= MIN_GAP_MINUTES) {
        gaps.push({ start: cursor, end: evStart })
      }
    }
    if (evEnd > cursor) cursor = evEnd
  }
  if (scanEnd > cursor) {
    const gapMin = differenceInMinutes(scanEnd, cursor)
    if (gapMin >= MIN_GAP_MINUTES) gaps.push({ start: cursor, end: scanEnd })
  }

  const created: UnknownBlock[] = []
  for (const g of gaps) {
    const duration = differenceInMinutes(g.end, g.start)
    // Avoid duplicate: if an open block already covers this range, skip
    const existing = await db.unknownBlock.findFirst({
      where: {
        userId,
        status: { in: ['open', 'ai_guessed_pending_confirmation'] },
        startTime: { lte: g.start },
        endTime: { gte: g.end },
      },
    })
    if (existing) continue
    const block = await db.unknownBlock.create({
      data: {
        userId,
        startTime: g.start,
        endTime: g.end,
        durationMinutes: duration,
        status: 'open',
        severity: severityForDuration(duration),
      },
    })
    created.push(serializeBlock(block, null))
  }
  return created
}

export async function listOpenBlocks(userId: string): Promise<UnknownBlock[]> {
  const blocks = await db.unknownBlock.findMany({
    where: { userId, status: { in: ['open', 'ai_guessed_pending_confirmation'] } },
    orderBy: { startTime: 'desc' },
  })
  const eventIds = blocks.map((b) => b.resolvedEventId).filter(Boolean) as string[]
  const events = eventIds.length ? await db.timelineEvent.findMany({ where: { id: { in: eventIds } } }) : []
  const evMap = new Map(events.map((e) => [e.id, e]))
  return blocks.map((b) => serializeBlock(b, b.resolvedEventId ? (evMap.get(b.resolvedEventId) ?? null) : null))
}

export async function listAllBlocks(userId: string): Promise<UnknownBlock[]> {
  const blocks = await db.unknownBlock.findMany({
    where: { userId },
    orderBy: { startTime: 'desc' },
    take: 100,
  })
  const eventIds = blocks.map((b) => b.resolvedEventId).filter(Boolean) as string[]
  const events = eventIds.length ? await db.timelineEvent.findMany({ where: { id: { in: eventIds } } }) : []
  const evMap = new Map(events.map((e) => [e.id, e]))
  return blocks.map((b) => serializeBlock(b, b.resolvedEventId ? (evMap.get(b.resolvedEventId) ?? null) : null))
}

function serializeBlock(b: Awaited<ReturnType<typeof db.unknownBlock.findFirst>> & object, resolvedEvent: TimelineEvent | null): UnknownBlock {
  return {
    id: b.id,
    userId: b.userId,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    durationMinutes: b.durationMinutes,
    status: b.status as UnknownBlockStatus,
    severity: b.severity as UnknownBlockSeverity,
    resolutionSource: b.resolutionSource,
    resolvedEventId: b.resolvedEventId,
    resolvedEvent,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

export async function resolveBlockWithText(
  userId: string,
  blockId: string,
  title: string,
  categoryId: string | null,
  description?: string,
): Promise<{ block: UnknownBlock; event: TimelineEvent } | null> {
  const block = await db.unknownBlock.findFirst({ where: { id: blockId, userId } })
  if (!block) return null

  const start = block.startTime
  const end = block.endTime
  const duration = differenceInMinutes(end, start)

  const cat = categoryId ? await db.category.findUnique({ where: { id: categoryId } }) : null

  const event = await db.timelineEvent.create({
    data: {
      userId,
      title,
      description: description ?? null,
      startTime: start,
      endTime: end,
      durationMinutes: duration,
      categoryId: categoryId ?? null,
      confidenceScore: 0.95,
      source: 'ai_confirmed',
    },
  })

  const updated = await db.unknownBlock.update({
    where: { id: blockId },
    data: { status: 'resolved', resolutionSource: 'text', resolvedEventId: event.id },
  })

  // Update habit model
  await recordHabit(userId, start, categoryId, title)

  return {
    block: serializeBlock(updated, null),
    event: {
      id: event.id,
      userId: event.userId,
      title: event.title,
      description: event.description,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      durationMinutes: event.durationMinutes,
      location: event.location,
      notes: event.notes,
      categoryId: event.categoryId,
      category: cat ? { ...cat, icon: cat.icon } : null,
      confidenceScore: event.confidenceScore,
      source: event.source as TimelineEvent['source'],
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    },
  }
}

export async function resolveBlockAsUnknown(userId: string, blockId: string): Promise<UnknownBlock | null> {
  const block = await db.unknownBlock.findFirst({ where: { id: blockId, userId } })
  if (!block) return null
  const updated = await db.unknownBlock.update({
    where: { id: blockId },
    data: { status: 'unknown_confirmed', resolutionSource: 'confirmed_unknown' },
  })
  return serializeBlock(updated, null)
}

export async function deleteBlock(userId: string, blockId: string): Promise<boolean> {
  const block = await db.unknownBlock.findFirst({ where: { id: blockId, userId } })
  if (!block) return false
  await db.unknownBlock.delete({ where: { id: blockId } })
  return true
}

// Habit model helpers — learns from user resolutions
async function recordHabit(userId: string, when: Date, categoryId: string | null, title: string) {
  const hour = when.getHours()
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][when.getDay()]
  let timeKey: string
  if (hour < 12) timeKey = 'morning'
  else if (hour < 17) timeKey = 'afternoon'
  else if (hour < 21) timeKey = 'evening'
  else timeKey = 'night'

  // Time-of-day habit
  if (categoryId) {
    const existing = await db.habitPattern.findUnique({
      where: { userId_patternType_patternKey: { userId, patternType: 'time_of_day', patternKey: timeKey } },
    })
    if (existing) {
      await db.habitPattern.update({
        where: { id: existing.id },
        data: {
          categoryId,
          frequency: { increment: 1 },
          confidence: Math.min(1, existing.confidence + 0.1),
          eventName: title,
        },
      })
    } else {
      await db.habitPattern.create({
        data: { userId, patternType: 'time_of_day', patternKey: timeKey, categoryId, eventName: title, frequency: 1, confidence: 0.5 },
      })
    }
  }

  // Day-of-week habit
  const dowExisting = await db.habitPattern.findUnique({
    where: { userId_patternType_patternKey: { userId, patternType: 'day_of_week', patternKey: dayOfWeek } },
  })
  if (dowExisting) {
    await db.habitPattern.update({
      where: { id: dowExisting.id },
      data: { frequency: { increment: 1 }, confidence: Math.min(1, dowExisting.confidence + 0.05) },
    })
  } else {
    await db.habitPattern.create({
      data: { userId, patternType: 'day_of_week', patternKey: dayOfWeek, categoryId, eventName: title, frequency: 1, confidence: 0.4 },
    })
  }
}

export async function getHabitModelSummary(userId: string) {
  const habits = await db.habitPattern.findMany({ where: { userId } })
  return habits
}

export async function guessCategoryFromHabit(userId: string, when: Date): Promise<{ categoryId: string | null; title: string | null; confidence: number }> {
  const hour = when.getHours()
  let timeKey: string
  if (hour < 12) timeKey = 'morning'
  else if (hour < 17) timeKey = 'afternoon'
  else if (hour < 21) timeKey = 'evening'
  else timeKey = 'night'

  const habit = await db.habitPattern.findUnique({
    where: { userId_patternType_patternKey: { userId, patternType: 'time_of_day', patternKey: timeKey } },
  })
  if (habit && habit.confidence > 0.5) {
    return { categoryId: habit.categoryId, title: habit.eventName, confidence: habit.confidence }
  }
  return { categoryId: null, title: null, confidence: 0 }
}
