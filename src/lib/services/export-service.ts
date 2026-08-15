/**
 * Full data export / import service.
 * - exportAllData: dumps every table belonging to a user into a single JSON
 *   object (events, categories, unknown blocks, conversations + messages,
 *   notifications, habit patterns, templates, goals, attachments metadata).
 *   Attachments' base64 payloads are intentionally EXCLUDED (they can be huge)
 *   but can be toggled on via `includeAttachmentBlobs`.
 * - importAllData: restores a previously exported snapshot into a user's
 *   account. Existing rows are NOT deleted first — the import is additive,
 *   and id collisions are avoided by regenerating IDs on import.
 */
import { db } from '@/lib/db'

export interface ExportedData {
  app: string
  version: number
  exportedAt: string
  user: { name: string | null; timezone: string; quietHoursStart: string | null; quietHoursEnd: string | null }
  categories: object[]
  events: object[]
  unknownBlocks: object[]
  conversations: object[]
  notifications: object[]
  habitPatterns: object[]
  templates: object[]
  goals: object[]
}

const EXPORT_VERSION = 1

export async function exportAllData(userId: string, includeAttachmentBlobs = false): Promise<ExportedData> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const categories = await db.category.findMany({ where: { userId } })
  const events = await db.timelineEvent.findMany({ where: { userId }, include: { attachments: includeAttachmentBlobs } })
  const blocks = await db.unknownBlock.findMany({ where: { userId } })
  const conversations = await db.aIConversation.findMany({
    where: { userId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  const notifications = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  const habits = await db.habitPattern.findMany({ where: { userId } })
  const templates = await db.eventTemplate.findMany({ where: { userId } })
  const goals = await db.goal.findMany({ where: { userId } })

  return {
    app: 'ai-life-timeline',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    user: { name: user.name, timezone: user.timezone, quietHoursStart: user.quietHoursStart, quietHoursEnd: user.quietHoursEnd },
    categories,
    events,
    unknownBlocks: blocks,
    conversations,
    notifications,
    habitPatterns: habits,
    templates,
    goals,
  }
}

/**
 * Validate an import payload and report problems without mutating anything.
 */
export function validateImportData(raw: unknown): { ok: boolean; error?: string; counts?: { events: number; categories: number } } {
  const d = raw as { app?: string; version?: number; events?: unknown[]; categories?: unknown[] }
  if (!d || typeof d !== 'object') return { ok: false, error: 'الملف ليس بيانات صالحة' }
  if (d.app !== 'ai-life-timeline') return { ok: false, error: 'الملف ليس تصديرًا من تطبيق AI Life Timeline' }
  if (!Array.isArray(d.events) || !Array.isArray(d.categories)) {
    return { ok: false, error: 'الملف ناقص بيانات أساسية (events / categories)' }
  }
  return { ok: true, counts: { events: d.events.length, categories: d.categories.length } }
}

const newId = () => {
  // Lightweight cuid-like id without external dependency
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  return `${t}${r}`
}

/**
 * Restore an exported snapshot. Returns counts of what was imported.
 * Category names are matched by name (case-insensitive) to avoid duplicating
 * the defaults; everything else gets fresh IDs.
 */
export async function importAllData(
  userId: string,
  data: ExportedData,
): Promise<{ events: number; categories: number; conversations: number; notifications: number; habits: number; templates: number; goals: number }> {
  const result = { events: 0, categories: 0, conversations: 0, notifications: 0, habits: 0, templates: 0, goals: 0 }

  // 1. Categories — match existing by name first
  const existingCats = await db.category.findMany({ where: { userId } })
  const catNameById = new Map<string, string>()
  for (const c of data.categories as { id: string; name: string; color: string; icon?: string | null; isDefault?: boolean }[]) {
    const match = existingCats.find((e) => e.name.toLowerCase() === (c.name || '').toLowerCase())
    if (match) {
      catNameById.set(c.id, match.id)
    } else {
      const created = await db.category.create({
        data: {
          userId,
          name: c.name,
          color: c.color,
          icon: c.icon ?? null,
          isDefault: false,
        },
      })
      catNameById.set(c.id, created.id)
      result.categories++
    }
  }

  // 2. Events
  const catIds = Array.from(catNameById.values())
  for (const e of data.events as {
    id?: string
    title: string
    description?: string | null
    startTime: string | Date
    endTime: string | Date
    durationMinutes?: number
    location?: string | null
    notes?: string | null
    tags?: string | null
    categoryId?: string | null
    confidenceScore?: number
    source?: string
  }[]) {
    const durationMinutes =
      typeof e.durationMinutes === 'number'
        ? e.durationMinutes
        : Math.max(1, Math.round((new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 60000))
    await db.timelineEvent.create({
      data: {
        userId,
        title: e.title,
        description: e.description ?? null,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
        durationMinutes,
        location: e.location ?? null,
        notes: e.notes ?? null,
        tags: e.tags ?? null,
        categoryId: (e.categoryId && catNameById.get(e.categoryId)) || null,
        confidenceScore: typeof e.confidenceScore === 'number' ? e.confidenceScore : 1,
        source: e.source || 'user_manual',
      },
    })
    result.events++
  }

  // 3. Unknown blocks
  for (const b of data.unknownBlocks as {
    startTime: string | Date
    endTime: string | Date
    durationMinutes?: number
    status?: string
    severity?: string
    resolutionSource?: string | null
  }[]) {
    await db.unknownBlock.create({
      data: {
        userId,
        startTime: new Date(b.startTime),
        endTime: new Date(b.endTime),
        durationMinutes: b.durationMinutes ?? 60,
        status: b.status || 'open',
        severity: b.severity || 'low',
        resolutionSource: b.resolutionSource ?? null,
      },
    })
  }

  // 4. Conversations + messages
  for (const conv of data.conversations as { title?: string; messages: { role: string; content: string; metadata?: string | null; createdAt?: string | Date }[] }[]) {
    const created = await db.aIConversation.create({ data: { userId, title: conv.title || 'Imported conversation' } })
    for (const m of conv.messages || []) {
      await db.aIMessage.create({
        data: {
          conversationId: created.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          metadata: m.metadata ?? null,
        },
      })
    }
    result.conversations++
  }

  // 5. Notifications (read-only mirror — optional, import anyway)
  for (const n of data.notifications as {
    type: string
    title: string
    body: string
    actionType?: string | null
    actionPayload?: string | null
    isRead?: boolean
  }[]) {
    await db.notification.create({
      data: {
        userId,
        type: n.type,
        title: n.title,
        body: n.body,
        actionType: n.actionType ?? null,
        actionPayload: n.actionPayload ?? null,
        isRead: n.isRead || false,
      },
    })
    result.notifications++
  }

  // 6. Habit patterns, templates, goals
  for (const h of data.habitPatterns as {
    patternType: string
    patternKey: string
    categoryId?: string | null
    eventName?: string | null
    frequency?: number
    confidence?: number
  }[]) {
    try {
      await db.habitPattern.create({
        data: {
          userId,
          patternType: h.patternType,
          patternKey: h.patternKey,
          categoryId: (h.categoryId && catNameById.get(h.categoryId)) || null,
          eventName: h.eventName ?? null,
          frequency: typeof h.frequency === 'number' ? h.frequency : 1,
          confidence: typeof h.confidence === 'number' ? h.confidence : 0.5,
        },
      })
      result.habits++
    } catch {
      /* unique conflict — skip */
    }
  }
  for (const t of data.templates as {
    title: string
    categoryId?: string | null
    durationMin?: number
    description?: string | null
    icon?: string | null
  }[]) {
    await db.eventTemplate.create({
      data: {
        userId,
        title: t.title,
        categoryId: (t.categoryId && catNameById.get(t.categoryId)) || null,
        durationMin: typeof t.durationMin === 'number' ? t.durationMin : 60,
        description: t.description ?? null,
        icon: t.icon ?? null,
      },
    })
    result.templates++
  }
  for (const g of data.goals as {
    title: string
    type: string
    categoryId?: string | null
    tag?: string | null
    targetValue?: number
    period?: string
  }[]) {
    await db.goal.create({
      data: {
        userId,
        title: g.title,
        type: g.type,
        categoryId: (g.categoryId && catNameById.get(g.categoryId)) || null,
        tag: g.tag ?? null,
        targetValue: typeof g.targetValue === 'number' ? g.targetValue : 1,
        period: g.period || 'weekly',
      },
    })
    result.goals++
  }

  // 7. User preferences
  const u = data.user
  if (u && (u.timezone || u.quietHoursStart || u.quietHoursEnd)) {
    await db.user.update({
      where: { id: userId },
      data: {
        ...(u.timezone ? { timezone: u.timezone } : {}),
        ...(u.quietHoursStart ? { quietHoursStart: u.quietHoursStart } : {}),
        ...(u.quietHoursEnd ? { quietHoursEnd: u.quietHoursEnd } : {}),
      },
    })
  }

  return result
}
