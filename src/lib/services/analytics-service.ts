import { db } from '@/lib/db'
import { getUserTimezone, getUserNow, formatInUserTz, wallClockDate } from './timezone-service'
import { differenceInMinutes, format, subDays, startOfDay, endOfDay } from 'date-fns'
import type { Category, InsightData } from '@/lib/types'

export async function getInsights(userId: string, rangeDays = 30): Promise<InsightData> {
  // "Today" and day buckets are computed in the user's timezone
  const tz = await getUserTimezone(userId)
  const end = await getUserNow(userId)
  const start = subDays(end, rangeDays)

  const events = await db.timelineEvent.findMany({
    where: {
      userId,
      startTime: { gte: start, lte: end },
    },
  })

  const cats = await db.category.findMany({ where: { userId } })
  const catMap = new Map<string, Category>()
  cats.forEach((c) => catMap.set(c.id, { ...c, icon: c.icon }))

  const totalTrackedMinutes = events.reduce((s, e) => s + e.durationMinutes, 0)

  // Category breakdown
  const catMinutes = new Map<string, number>()
  let uncategorized = 0
  for (const ev of events) {
    if (ev.categoryId) {
      catMinutes.set(ev.categoryId, (catMinutes.get(ev.categoryId) ?? 0) + ev.durationMinutes)
    } else {
      uncategorized += ev.durationMinutes
    }
  }
  const categoryBreakdown = Array.from(catMinutes.entries())
    .map(([catId, minutes]) => ({
      category: catMap.get(catId) ?? null,
      minutes,
      percentage: totalTrackedMinutes > 0 ? minutes / totalTrackedMinutes : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes)
  if (uncategorized > 0) {
    categoryBreakdown.push({ category: null, minutes: uncategorized, percentage: totalTrackedMinutes > 0 ? uncategorized / totalTrackedMinutes : 0 })
  }

  // Productive hours — minutes per hour-of-day, weighted by category productivity
  const productiveCats = new Set(['Work', 'Study', 'Exercise', 'Prayer', 'Personal'])
  const tzHour = await getUserTimezone(userId)
  const hourBuckets: { minutes: number; score: number }[] = Array.from({ length: 24 }, () => ({ minutes: 0, score: 0 }))
  for (const ev of events) {
    // Bucket by the event's hour in the USER's timezone
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tzHour, hour: 'numeric', hour12: false }).format(ev.startTime)) % 24
    const cat = ev.categoryId ? catMap.get(ev.categoryId) : null
    const isProductive = cat ? productiveCats.has(cat.name) : false
    hourBuckets[hour].minutes += ev.durationMinutes
    hourBuckets[hour].score += isProductive ? ev.durationMinutes : 0
  }
  const productiveHours = hourBuckets.map((b, hour) => ({
    hour,
    minutes: b.minutes,
    score: b.score,
  }))

  // Daily totals (in user timezone), keyed as ISO yyyy-MM-dd so the
  // Insights chart can parse each date with `new Date(d + 'T00:00:00')`
  const dayMap = new Map<string, number>()
  for (const ev of events) {
    const key = formatInUserTz(ev.startTime, tz, { year: 'numeric', month: '2-digit', day: '2-digit' })
    dayMap.set(key, (dayMap.get(key) ?? 0) + ev.durationMinutes)
  }
  const dailyTotals = Array.from(dayMap.entries())
    .map(([date, minutes]) => {
      // Convert MM/DD/YYYY wall key back to ISO yyyy-MM-dd
      const [m, d, y] = date.split('/')
      return { date: `${y}-${m}-${d}`, minutes }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  // Completeness for range (day boundaries in user timezone)
  let totalCovered = 0
  let totalPossible = 0
  const tzNow = await getUserNow(userId)
  for (let i = 0; i < rangeDays; i++) {
    const day = subDays(tzNow, i)
    const dayStart = wallClockDate(tz, 6, 0)
    const dayEnd = wallClockDate(tz, 23, 0)
    // Only count wall-clock dates up to the user's current date
    const dayKey = formatInUserTzKey(day, tz)
    const nowKey = formatInUserTzKey(tzNow, tz)
    if (dayKey > nowKey) continue
    const scanEnd = dayKey === nowKey && new Date() < dayEnd ? new Date() : dayEnd
    const possible = Math.max(0, differenceInMinutes(scanEnd, dayStart))
    totalPossible += possible
  }
  totalCovered = totalTrackedMinutes
  const completenessPercentage = totalPossible > 0 ? Math.min(100, Math.round((totalCovered / totalPossible) * 100)) : 0

  // Top habits
  const habits = await db.habitPattern.findMany({ where: { userId } })
  const topHabits = habits
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5)
    .map((h) => ({ patternKey: h.patternKey, categoryId: h.categoryId, frequency: h.frequency, confidence: h.confidence }))

  // Tag breakdown — aggregate minutes per tag across all tagged events
  const tagMinutes = new Map<string, { minutes: number; count: number }>()
  for (const ev of events) {
    if (!ev.tags) continue
    const tags = ev.tags.split(',').map((t) => t.trim()).filter(Boolean)
    for (const tag of tags) {
      const existing = tagMinutes.get(tag)
      if (existing) {
        existing.minutes += ev.durationMinutes
        existing.count += 1
      } else {
        tagMinutes.set(tag, { minutes: ev.durationMinutes, count: 1 })
      }
    }
  }
  const tagBreakdown = Array.from(tagMinutes.entries())
    .map(([tag, { minutes, count }]) => ({
      tag,
      minutes,
      percentage: totalTrackedMinutes > 0 ? minutes / totalTrackedMinutes : 0,
      eventCount: count,
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 12)

  // Streak — consecutive days with at least 1 event (in user timezone)
  const daySet = new Set<string>()
  for (const ev of events) {
    daySet.add(formatInUserTzKey(ev.startTime, tz))
  }
  let streakDays = 0
  for (let i = 0; i < rangeDays; i++) {
    const checkDay = formatInUserTzKey(subDays(new Date(), i), tz)
    const isToday = i === 0
    const logged = daySet.has(checkDay)
    if (logged) {
      streakDays++
    } else if (!isToday) {
      // Allow today to be empty (haven't logged yet) but break on a past empty day
      break
    }
  }

  // Weekly summary text
  const weeklySummary = generateWeeklySummary(categoryBreakdown, completenessPercentage, totalTrackedMinutes)

  return {
    totalTrackedMinutes,
    categoryBreakdown,
    productiveHours,
    dailyTotals,
    completenessPercentage,
    topHabits,
    weeklySummary,
    tagBreakdown,
    streakDays,
  }
}

function formatInUserTzKey(date: Date, tz: string): string {
  return formatInUserTz(date, tz, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function generateWeeklySummary(
  breakdown: { category: Category | null; minutes: number; percentage: number }[],
  completeness: number,
  total: number,
): string {
  if (total === 0) return "No timeline data yet. Start logging events to see your weekly insights."
  const top = breakdown[0]
  const topName = top?.category?.name ?? 'Uncategorized'
  const topHours = Math.round((top?.minutes ?? 0) / 60)
  const totalHours = Math.round(total / 60)
  const parts: string[] = []
  parts.push(`You tracked ${totalHours} hours over this period with ${completeness}% timeline completeness.`)
  parts.push(`Your top category was ${topName} at ${topHours} hours.`)
  if (completeness < 70) {
    parts.push("There are notable gaps in your timeline — resolve Unknown Blocks to improve your insights accuracy.")
  } else if (completeness >= 85) {
    parts.push("Excellent coverage — your insights are highly representative of your actual time.")
  } else {
    parts.push("Decent coverage — resolving a few more gaps will sharpen these insights.")
  }
  return parts.join(' ')
}
