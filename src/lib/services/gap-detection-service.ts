import { db } from '@/lib/db'
import { differenceInMinutes } from 'date-fns'
import { getUserTimezone, wallClockDate } from './timezone-service'
import { assertNoOverlap, OverlapError } from './overlap-service'
import type { UnknownBlock, UnknownBlockSeverity, UnknownBlockStatus, Category, TimelineEvent, Attachment } from '@/lib/types'

const MIN_GAP_MINUTES = 15

function severityForDuration(min: number): UnknownBlockSeverity {
  if (min >= 120) return 'high'
  if (min >= 45) return 'medium'
  return 'low'
}

export async function detectGapsForDay(userId: string, dateISO: string): Promise<UnknownBlock[]> {
  // Day boundaries are wall-clock in the USER'S timezone, not the server's.
  const tz = await getUserTimezone(userId)
  const dayStart = wallClockDate(tz, 6, 0)
  const dayEnd = wallClockDate(tz, 23, 0)

  // If the selected date is today (in the user's timezone), only detect up to "now"
  const tzParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const tzToday = `${tzParts.find((p) => p.type === 'year')?.value}-${tzParts.find((p) => p.type === 'month')?.value}-${tzParts.find((p) => p.type === 'day')?.value}`
  const isToday = dateISO === tzToday
  const scanEnd = isToday && new Date() < dayEnd ? new Date() : dayEnd

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
  const events = eventIds.length
    ? await db.timelineEvent.findMany({ where: { id: { in: eventIds } }, include: { category: true, attachments: true } })
    : []
  const evMap = new Map(events.map((e) => [e.id, serializeEvent(e)]))
  return blocks.map((b) => serializeBlock(b, b.resolvedEventId ? (evMap.get(b.resolvedEventId) ?? null) : null))
}

export async function listAllBlocks(userId: string): Promise<UnknownBlock[]> {
  const blocks = await db.unknownBlock.findMany({
    where: { userId },
    orderBy: { startTime: 'desc' },
    take: 100,
  })
  const eventIds = blocks.map((b) => b.resolvedEventId).filter(Boolean) as string[]
  const events = eventIds.length
    ? await db.timelineEvent.findMany({ where: { id: { in: eventIds } }, include: { category: true, attachments: true } })
    : []
  const evMap = new Map(events.map((e) => [e.id, serializeEvent(e)]))
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

/**
 * Serializes a Prisma TimelineEvent row into the shared TimelineEvent type,
 * including tags and attachments — previously these were dropped in manual
 * serialization paths.
 */
function serializeEvent(
  e: Awaited<ReturnType<typeof db.timelineEvent.findFirst>> & {
    category?: { id: string; name: string; color: string; icon: string | null; isDefault: boolean } | null
    attachments?: { id: string; type: string; filename: string; mimeType: string; size: number; transcript: string | null; createdAt: Date }[]
  },
): TimelineEvent {
  const cat = e.category ?? null
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
    category: cat ? { ...cat, icon: cat.icon } : null,
    attachments: (e.attachments ?? []).map((a) => ({
      id: a.id,
      eventId: e.id,
      type: a.type as Attachment['type'],
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      hasData: true,
      transcript: a.transcript,
      createdAt: a.createdAt.toISOString(),
    })),
    confidenceScore: e.confidenceScore,
    source: e.source as TimelineEvent['source'],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
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

  let start = block.startTime
  let end = block.endTime
  const blockDuration = differenceInMinutes(end, start)
  let duration = blockDuration

  // Ensure the resolving event fits inside the block without overlapping
  // existing events. If something overlaps within the block range, shrink the
  // range to the uncovered sub-segment — this guarantees "overlap-free
  // reconstruction" instead of silently creating conflicts.
  const withinBlock = await db.timelineEvent.findMany({
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
  if (withinBlock.length > 0) {
    // Find the largest uncovered gap inside [start, end)
    let cursor = start
    let bestStart: Date | null = null
    let bestEnd: Date | null = null
    let bestSize = 0
    const candidates: { start: Date; end: Date }[] = []
    for (const ev of withinBlock) {
      const evStart = ev.startTime > start ? ev.startTime : start
      const evEnd = ev.endTime < end ? ev.endTime : end
      if (evStart > cursor && evStart < end && evEnd > cursor) {
        candidates.push({ start: cursor, end: evStart })
      }
      if (evEnd > cursor) cursor = evEnd
    }
    if (end > cursor) candidates.push({ start: cursor, end })
    for (const c of candidates) {
      const size = differenceInMinutes(c.end, c.start)
      if (size > bestSize) {
        bestSize = size
        bestStart = c.start
        bestEnd = c.end
      }
    }
    if (!bestStart || !bestEnd) {
      throw new OverlapError('No uncovered time remains inside this block — it is already fully accounted for')
    }
    start = bestStart
    end = bestEnd
  }
  await assertNoOverlap(userId, start, end)

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

  const serializedEvent = serializeEvent({ ...event, category: cat })
  return { block: serializeBlock(updated, null), event: serializedEvent }
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
