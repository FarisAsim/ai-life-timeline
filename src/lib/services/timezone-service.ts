import { db } from '@/lib/db'

// The app currently runs with the server's local timezone, but every user
// stores a preferred timezone (IANA, e.g. "Africa/Cairo"). This module makes
// the conversion helpers explicit and consistent across services.
//
// Design note: timestamps stored in SQLite are wall-clock times tagged with
// the user's timezone. All conversions go through getUserTimezone() so that a
// future migration to per-user UTC storage only touches this module.

export async function getUserTimezone(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } })
  return user?.timezone || 'UTC'
}

/**
 * Returns the current moment in the user's timezone as a Date.
 */
export async function getUserNow(userId: string): Promise<Date> {
  const tz = await getUserTimezone(userId)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}

/**
 * Formats a Date for display in the user's timezone.
 */
export function formatInUserTz(date: Date, tz: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...options }).format(date)
}

/**
 * Converts a server-local "wall clock" date (e.g. day boundaries at 6:00) to
 * an approximation that respects the user's timezone: builds the same wall
 * clock fields but anchored to the user's tz offset.
 */
export function wallClockDate(tz: string, hours: number, minutes: number): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return new Date(get('year'), get('month') - 1, get('day'), hours, minutes, 0, 0)
}
