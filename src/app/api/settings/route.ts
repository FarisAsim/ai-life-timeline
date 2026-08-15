import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  const stats = {
    eventCount: await db.timelineEvent.count({ where: { userId: user.id } }),
    unknownBlockCount: await db.unknownBlock.count({ where: { userId: user.id } }),
    conversationCount: await db.aIConversation.count({ where: { userId: user.id } }),
    notificationCount: await db.notification.count({ where: { userId: user.id } }),
    habitCount: await db.habitPattern.count({ where: { userId: user.id } }),
    categoryCount: await db.category.count({ where: { userId: user.id } }),
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      quietHoursStart: user.quietHoursStart,
      quietHoursEnd: user.quietHoursEnd,
    },
    stats,
  })
}

export async function PATCH(req: NextRequest) {
  const user = await resolveUser(req)
  const body = await req.json()
  const { name, timezone, quietHoursStart, quietHoursEnd } = body
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(timezone !== undefined && { timezone }),
      ...(quietHoursStart !== undefined && { quietHoursStart }),
      ...(quietHoursEnd !== undefined && { quietHoursEnd }),
    },
  })
  return NextResponse.json({ user: { id: updated.id, email: updated.email, name: updated.name, timezone: updated.timezone, quietHoursStart: updated.quietHoursStart, quietHoursEnd: updated.quietHoursEnd } })
}
