import { db } from '@/lib/db'
import { differenceInMinutes, eachDayOfInterval, format, endOfMonth, startOfMonth, isSameDay } from 'date-fns'
import type { DayCompletion, MonthCompletion } from '@/lib/types'

const GREEN_THRESHOLD = 0.85
const YELLOW_THRESHOLD = 0.5
const AWAKE_START_HOUR = 6
const AWAKE_END_HOUR = 23

function statusForScore(score: number, openBlocks: number): 'green' | 'yellow' | 'red' {
  if (openBlocks > 0 && score < GREEN_THRESHOLD) {
    if (score < YELLOW_THRESHOLD) return 'red'
    return 'yellow'
  }
  if (score >= GREEN_THRESHOLD) return 'green'
  if (score >= YELLOW_THRESHOLD) return 'yellow'
  return 'red'
}

export async function getMonthCompletion(userId: string, year: number, month: number): Promise<MonthCompletion> {
  const monthDate = new Date(year, month, 1)
  const start = startOfMonth(monthDate)
  const end = endOfMonth(monthDate)
  const today = new Date()

  const days = eachDayOfInterval({ start, end })
  const result: DayCompletion[] = []

  for (const day of days) {
    // Don't compute for future days
    if (day > today && !isSameDay(day, today)) {
      result.push({
        date: format(day, 'yyyy-MM-dd'),
        coveredMinutes: 0,
        totalMinutes: 0,
        score: 0,
        status: 'green',
        eventCount: 0,
        openBlockCount: 0,
      })
      continue
    }
    const dc = await computeDayCompletion(userId, format(day, 'yyyy-MM-dd'))
    result.push(dc)
  }

  const pastDays = result.filter((d) => d.totalMinutes > 0)
  const monthScore = pastDays.length ? pastDays.reduce((s, d) => s + d.score, 0) / pastDays.length : 0
  return { days: result, monthScore }
}

export async function computeDayCompletion(userId: string, dateISO: string): Promise<DayCompletion> {
  const day = new Date(dateISO + 'T00:00:00')
  const awakeStart = new Date(day)
  awakeStart.setHours(AWAKE_START_HOUR, 0, 0, 0)
  const awakeEnd = new Date(day)
  awakeEnd.setHours(AWAKE_END_HOUR, 0, 0, 0)

  const now = new Date()
  const isToday = isSameDay(day, now)
  const scanEnd = isToday && now < awakeEnd ? now : awakeEnd
  const totalMinutes = isToday ? Math.max(0, differenceInMinutes(scanEnd, awakeStart)) : differenceInMinutes(awakeEnd, awakeStart)

  if (totalMinutes <= 0) {
    return {
      date: dateISO,
      coveredMinutes: 0,
      totalMinutes: 0,
      score: 0,
      status: 'green',
      eventCount: 0,
      openBlockCount: 0,
    }
  }

  const events = await db.timelineEvent.findMany({
    where: {
      userId,
      OR: [
        { startTime: { gte: awakeStart, lte: scanEnd } },
        { endTime: { gte: awakeStart, lte: scanEnd } },
        { AND: [{ startTime: { lte: awakeStart } }, { endTime: { gte: scanEnd } }] },
      ],
    },
  })

  let covered = 0
  for (const ev of events) {
    const s = ev.startTime < awakeStart ? awakeStart : ev.startTime
    const e = ev.endTime > scanEnd ? scanEnd : ev.endTime
    const min = differenceInMinutes(e, s)
    if (min > 0) covered += min
  }

  const openBlocks = await db.unknownBlock.count({
    where: {
      userId,
      status: { in: ['open', 'ai_guessed_pending_confirmation'] },
      startTime: { gte: awakeStart, lte: scanEnd },
    },
  })

  const score = Math.min(1, covered / totalMinutes)
  return {
    date: dateISO,
    coveredMinutes: covered,
    totalMinutes,
    score,
    status: statusForScore(score, openBlocks),
    eventCount: events.length,
    openBlockCount: openBlocks,
  }
}
