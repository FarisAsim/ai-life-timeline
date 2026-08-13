import { db } from '@/lib/db'

export class OverlapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OverlapError'
  }
}

/**
 * Checks whether a time range overlaps with any EXISTING events for the user,
 * optionally excluding one event (used when updating the event itself).
 *
 * Two ranges [aStart, aEnd) and [bStart, bEnd) overlap when:
 *   aStart < bEnd AND bStart < aEnd
 *
 * Returns the conflicting event if any, null otherwise.
 */
export async function findOverlappingEvent(
  userId: string,
  startTime: Date,
  endTime: Date,
  excludeEventId?: string,
): Promise<{ id: string; title: string; startTime: Date; endTime: Date } | null> {
  if (endTime <= startTime) return null
  const where = {
    userId,
    startTime: { lt: endTime },
    endTime: { gt: startTime },
    ...(excludeEventId ? { NOT: { id: excludeEventId } } : {}),
  }
  const conflict = await db.timelineEvent.findFirst({ where })
  if (!conflict) return null
  return { id: conflict.id, title: conflict.title, startTime: conflict.startTime, endTime: conflict.endTime }
}

/**
 * Throws OverlapError if the given range overlaps any existing event.
 */
export async function assertNoOverlap(
  userId: string,
  startTime: Date,
  endTime: Date,
  excludeEventId?: string,
): Promise<void> {
  const conflict = await findOverlappingEvent(userId, startTime, endTime, excludeEventId)
  if (conflict) {
    throw new OverlapError(
      `Time range overlaps existing event "${conflict.title}" (${conflict.startTime.toISOString()} – ${conflict.endTime.toISOString()})`,
    )
  }
}

/**
 * Adjacency-aware overlap check: allows events that merely touch (end of one == start of another)
 * but rejects anything that actually overlaps in time.
 */
export async function validateEventTimes(
  userId: string,
  startTime: Date,
  endTime: Date,
  excludeEventId?: string,
): Promise<void> {
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) {
    throw new Error('Invalid start or end time')
  }
  if (endTime <= startTime) {
    throw new Error('Event end time must be after start time')
  }
  await assertNoOverlap(userId, startTime, endTime, excludeEventId)
}
