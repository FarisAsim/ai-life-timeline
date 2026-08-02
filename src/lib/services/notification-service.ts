import { db } from '@/lib/db'
import { format, subDays } from 'date-fns'
import { listOpenBlocks } from './gap-detection-service'
import { listGoals } from './goal-service'
import { getInsights } from './analytics-service'

export interface CreateNotificationInput {
  userId: string
  type: string
  title: string
  body: string
  actionType?: string
  actionPayload?: Record<string, unknown>
}

export async function createNotification(input: CreateNotificationInput) {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionType: input.actionType ?? null,
      actionPayload: input.actionPayload ? JSON.stringify(input.actionPayload) : null,
    },
  })
}

export async function listNotifications(userId: string, onlyUnread = false) {
  return db.notification.findMany({
    where: { userId, ...(onlyUnread ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function markRead(userId: string, notificationId: string) {
  const n = await db.notification.findFirst({ where: { id: notificationId, userId } })
  if (!n) return null
  return db.notification.update({ where: { id: notificationId }, data: { isRead: true } })
}

export async function markAllRead(userId: string) {
  await db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } })
  return true
}

export async function countUnread(userId: string) {
  return db.notification.count({ where: { userId, isRead: false } })
}

// Notification Decision Engine — runs on demand to generate notifications
// from current timeline state (gaps, upcoming events, insights).
export async function runNotificationEngine(userId: string) {
  const blocks = await listOpenBlocks(userId)
  const now = new Date()
  const created = []

  // Only consider blocks from the last 2 days
  const recentBlocks = blocks.filter((b) => {
    const blockTime = new Date(b.startTime)
    return (now.getTime() - blockTime.getTime()) < 2 * 24 * 60 * 60 * 1000
  })

  for (const block of recentBlocks) {
    // Avoid duplicate notifications for the same block
    const existing = await db.notification.findFirst({
      where: {
        userId,
        type: 'gap_prompt',
        actionPayload: { contains: block.id },
      },
    })
    if (existing) continue

    const hours = Math.round(block.durationMinutes / 60 * 10) / 10
    const time = format(new Date(block.startTime), 'h:mm a')
    const n = await createNotification({
      userId,
      type: 'gap_prompt',
      title: `Missing ${hours}h of your day`,
      body: `I noticed a gap between ${time} and ${format(new Date(block.endTime), 'h:mm a')}. Help me complete your timeline.`,
      actionType: 'resolve_gap',
      actionPayload: { blockId: block.id, startTime: block.startTime, endTime: block.endTime },
    })
    created.push(n)
  }

  // Upcoming event nudges (look ahead 1 hour)
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const upcoming = await db.timelineEvent.findMany({
    where: { userId, startTime: { gte: inOneHour, lte: inTwoHours } },
  })
  for (const ev of upcoming) {
    const existing = await db.notification.findFirst({
      where: { userId, type: 'pre_event', actionPayload: { contains: ev.id } },
    })
    if (existing) continue
    const n = await createNotification({
      userId,
      type: 'pre_event',
      title: `Up next: ${ev.title}`,
      body: `Your "${ev.title}" starts in about an hour. Are you still going?`,
      actionType: 'view_event',
      actionPayload: { eventId: ev.id },
    })
    created.push(n)
  }

  // Goal achievement + at-risk notifications
  const goals = await listGoals(userId)
  for (const goal of goals) {
    const pct = Math.round(goal.progress * 100)
    const achieved = pct >= 100
    const goalKey = `goal-${goal.id}`

    // Achievement notification (only once per goal)
    if (achieved) {
      const existing = await db.notification.findFirst({
        where: { userId, type: 'insight', actionPayload: { contains: goalKey }, body: { contains: 'achieved' } },
      })
      if (!existing) {
        const n = await createNotification({
          userId,
          type: 'insight',
          title: `🎉 Goal achieved!`,
          body: `You hit "${goal.title}" — ${goal.currentValue.toFixed(1)} / ${goal.targetValue} this ${goal.period}. Keep it up!`,
          actionType: 'view_insight',
          actionPayload: { goalId: goal.id, goalKey },
        })
        created.push(n)
      }
    } else if (pct >= 75 && goal.period === 'weekly') {
      // Near-achievement nudge (75%+ on weekly goals)
      const existing = await db.notification.findFirst({
        where: { userId, type: 'insight', actionPayload: { contains: goalKey }, body: { contains: 'almost there' } },
      })
      if (!existing) {
        const n = await createNotification({
          userId,
          type: 'insight',
          title: `Almost there: ${goal.title}`,
          body: `You're at ${pct}% of your weekly goal (${goal.currentValue.toFixed(1)} / ${goal.targetValue}). One more push!`,
          actionType: 'view_insight',
          actionPayload: { goalId: goal.id, goalKey },
        })
        created.push(n)
      }
    }
  }

  // Weekly summary digest (once per week)
  const weekSummaryKey = `weekly-summary-${format(now, 'yyyy-MM-dd')}`
  const lastSummary = await db.notification.findFirst({
    where: {
      userId,
      type: 'insight',
      actionPayload: { contains: 'weekly-summary' },
    },
    orderBy: { createdAt: 'desc' },
  })
  // Generate if no summary exists in the last 7 days
  const weekAgoTime = now.getTime() - 7 * 24 * 60 * 60 * 1000
  if (!lastSummary || lastSummary.createdAt.getTime() < weekAgoTime) {
    try {
      const insights = await getInsights(userId, 7)
      const topCat = insights.categoryBreakdown[0]
      const topCatName = topCat?.category?.name ?? 'Uncategorized'
      const topCatHours = topCat ? Math.round(topCat.minutes / 60 * 10) / 10 : 0
      const totalHours = Math.round(insights.totalTrackedMinutes / 60)
      const completeness = insights.completenessPercentage

      const parts: string[] = []
      parts.push(`This week: ${totalHours}h tracked across ${insights.dailyTotals.length} days.`)
      parts.push(`Top activity: ${topCatName} (${topCatHours}h).`)
      parts.push(`Timeline completeness: ${completeness}%.`)
      if (completeness < 70) parts.push('Resolve a few more gaps to improve your insights.')
      else if (completeness >= 85) parts.push('Excellent coverage — your insights are highly representative.')

      const n = await createNotification({
        userId,
        type: 'insight',
        title: `📊 Your week in review`,
        body: parts.join(' '),
        actionType: 'view_insight',
        actionPayload: { weekly: true, key: weekSummaryKey },
      })
      created.push(n)
    } catch {
      // Silent failure — non-critical
    }
  }

  return created
}
