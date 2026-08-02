import { NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { db } from '@/lib/db'
import { format } from 'date-fns'

// Data export — right to be informed / portability (PRD §9)
export async function GET() {
  const user = await getDemoUser()

  const [events, blocks, categories, conversations, notifications, habits] = await Promise.all([
    db.timelineEvent.findMany({ where: { userId: user.id }, orderBy: { startTime: 'desc' } }),
    db.unknownBlock.findMany({ where: { userId: user.id }, orderBy: { startTime: 'desc' } }),
    db.category.findMany({ where: { userId: user.id } }),
    db.aIConversation.findMany({ where: { userId: user.id }, include: { messages: true }, orderBy: { createdAt: 'desc' } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    db.habitPattern.findMany({ where: { userId: user.id } }),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      quietHoursStart: user.quietHoursStart,
      quietHoursEnd: user.quietHoursEnd,
    },
    stats: {
      events: events.length,
      unknownBlocks: blocks.length,
      categories: categories.length,
      conversations: conversations.length,
      notifications: notifications.length,
      habits: habits.length,
    },
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      durationMinutes: e.durationMinutes,
      location: e.location,
      notes: e.notes,
      categoryId: e.categoryId,
      confidenceScore: e.confidenceScore,
      source: e.source,
      createdAt: e.createdAt.toISOString(),
    })),
    unknownBlocks: blocks.map((b) => ({
      id: b.id,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      durationMinutes: b.durationMinutes,
      status: b.status,
      severity: b.severity,
      resolutionSource: b.resolutionSource,
      resolvedEventId: b.resolvedEventId,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      isDefault: c.isDefault,
    })),
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      messages: c.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    habitModel: habits.map((h) => ({
      id: h.id,
      patternType: h.patternType,
      patternKey: h.patternKey,
      categoryId: h.categoryId,
      eventName: h.eventName,
      frequency: h.frequency,
      confidence: h.confidence,
    })),
  }

  const filename = `life-timeline-export-${format(new Date(), 'yyyy-MM-dd')}.json`
  return NextResponse.json(exportData, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
