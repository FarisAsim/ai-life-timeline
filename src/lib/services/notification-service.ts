import { db } from '@/lib/db'
import { format } from 'date-fns'
import { listOpenBlocks } from './gap-detection-service'

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

  return created
}
