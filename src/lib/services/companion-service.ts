import { chatCompletion, isRemoteAIConfigured } from '@/lib/ai-provider'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { listEventsForRange, createEvent, updateEvent } from './timeline-service'
import { listOpenBlocks, resolveBlockWithText } from './gap-detection-service'
import { OverlapError } from './overlap-service'


const SYSTEM_PROMPT = `You are the AI Companion for "AI Life Timeline" — an app that records a person's life hour-by-hour and never wants to lose a moment.

CRITICAL LANGUAGE RULE:
- ALWAYS reply in the SAME language the user used. If they speak Egyptian Arabic, reply in Egyptian Arabic (colloquial, not MSA). If they speak English, reply in English. If they mix, mix back.
- NEVER switch to English when the user spoke Arabic. NEVER use Modern Standard Arabic when the user used Egyptian colloquial.
- For event titles created via actions: use the SAME language the user spoke. If they said "جيم", the title must be "جيم", not "Gym" or "صالة رياضية".

SMART EVENT CREATION — ASK BEFORE CREATING:
- When the user mentions an activity but doesn't specify the TIME, DO NOT create the event yet. Instead, ASK them for the time.
  Examples:
  User: "انا رايح الجيم" → You: "تمام! رايح الجيم امتى؟" (don't create yet)
  User: "I'm going to the gym" → You: "Great! What time are you going?" (don't create yet)
- When the user mentions a time, CREATE the event with a reasonable duration:
  User: "رايح الجيم الساعة 7" → create event at 7pm, duration 1 hour
  User: "gym at 7" → create event at 7pm, duration 1 hour
- After creating an event with a specific end time, the system will send a follow-up notification when the event ends asking "لسه في الجيم ولا خلصت؟" / "Still at the gym or done?"
- Default durations: gym=1h, meeting=30-60m, meal=30-45m, prayer=15-30m, sleep=8h, study=1-2h, social=1-3h, commute=30-60m

Your role:
- Answer questions grounded ONLY in the timeline data provided to you in the user context. Never fabricate events.
- If the user asks about a time period with no recorded data, say so honestly and reference any Unknown Blocks that exist for that period.
- You can take actions by responding with a JSON action block. When you take an action, ALWAYS output it as a fenced JSON block tagged \`action\` so the client can parse and EXECUTE it.
- Be warm but concise. Use a friendly, conversational tone.

When the user asks you to create, move, or resolve something, USE an action block — do not just describe what you would do. The system will execute it immediately.

Action format (output as a fenced code block with language "action"):

Create an event:
\`\`\`action
{ "type": "create_event", "title": "short label in user's language", "startTime": "ISO 8601", "endTime": "ISO 8601", "categoryName": "Work|Study|Exercise|Sleep|Prayer|Social|Screen Time|Meals|Commute|Personal", "description": "optional" }
\`\`\`

Resolve a gap:
\`\`\`action
{ "type": "resolve_gap", "blockId": "block id from context", "title": "what they did in user's language", "categoryName": "category name or omit", "description": "optional" }
\`\`\`

Move/update an event:
\`\`\`action
{ "type": "move_event", "eventId": "event id", "startTime": "new ISO", "endTime": "new ISO" }
\`\`\`

Create a reminder:
\`\`\`action
{ "type": "create_reminder", "text": "reminder text in user's language" }
\`\`\`

IMPORTANT: Always include a short visible reply BEFORE the action block explaining what you're doing. Reply in the user's language. Times must be ISO 8601 strings. Infer reasonable durations if the user doesn't specify (gym=1h, meeting=30m, meal=45m).

If you are only answering a question (no action), reply in plain text in the user's language.`

export interface CompanionContext {
  userId: string
  recentEvents: {
    title: string
    category: string | null
    start: string
    end: string
    source: string
  }[]
  openBlocks: {
    start: string
    end: string
    severity: string
    durationMinutes: number
  }[]
}

export async function buildUserContext(userId: string, userTimezone: string): Promise<string> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const events = await listEventsForRange(userId, weekAgo.toISOString(), now.toISOString())
  const blocks = await listOpenBlocks(userId)

  const eventLines = events.slice(0, 40).map((e) => {
    const start = format(new Date(e.startTime), 'EEE MMM d, h:mm a')
    const end = format(new Date(e.endTime), 'h:mm a')
    return `- id=${e.id} | ${start} – ${end}: "${e.title}" [category: ${e.category?.name ?? 'none'}] [source: ${e.source}]`
  })
  const blockLines = blocks.slice(0, 10).map((b) => {
    const start = format(new Date(b.startTime), 'EEE MMM d, h:mm a')
    const end = format(new Date(b.endTime), 'h:mm a')
    return `- id=${b.id} | ${start} – ${end} (gap of ${Math.round(b.durationMinutes / 60)}h${Math.round(b.durationMinutes % 60)}m, severity: ${b.severity})`
  })

  return `USER CONTEXT (timezone: ${userTimezone}, current time: ${format(now, "EEE MMM d, yyyy h:mm a z")}):
Recent timeline events (last 7 days, up to 40):
${eventLines.length ? eventLines.join('\n') : '(none yet)'}

Unresolved Unknown Blocks (gaps needing answers):
${blockLines.length ? blockLines.join('\n') : '(none — timeline is complete)'}`
}

export interface CompanionResponse {
  reply: string
  action: { type: string; data?: unknown } | null
  raw: string
  actionResult: { executed: boolean; detail: string; eventId?: string } | null
}

export async function chat(userId: string, conversationId: string | null, userMessage: string, userTimezone: string): Promise<CompanionResponse> {
  const context = await buildUserContext(userId, userTimezone)

  // Load or create conversation
  let conversation: { id: string; messages: { role: string; content: string }[] } | null = null
  if (conversationId) {
    const conv = await db.aIConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
    })
    if (conv && conv.userId === userId) {
      conversation = { id: conv.id, messages: conv.messages.map((m) => ({ role: m.role, content: m.content })) }
    }
  }
  if (!conversation) {
    const conv = await db.aIConversation.create({ data: { userId, title: userMessage.slice(0, 40) } })
    conversation = { id: conv.id, messages: [] }
  }

  const history = conversation.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const messages = [
    { role: 'assistant' as const, content: SYSTEM_PROMPT },
    { role: 'assistant' as const, content: context },
    ...history,
    { role: 'user' as const, content: userMessage },
  ]

  let raw: string
  if (!isRemoteAIConfigured()) {
    raw = noAIReply(userMessage)
  } else {
    try {
      raw = await chatCompletion(messages)
    } catch {
      raw = noAIReply(userMessage)
    }
  }

  // Persist messages
  await db.aIMessage.create({ data: { conversationId: conversation.id, role: 'user', content: userMessage } })
  await db.aIMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: raw } })

  // Parse action block if present
  let action: { type: string; data?: unknown } | null = null
  const actionMatch = raw.match(/```action\s*([\s\S]*?)```/)
  let reply = raw
  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1].trim())
      action = { type: parsed.type, data: parsed }
      if (parsed.text) reply = parsed.text
      else reply = raw.replace(/```action[\s\S]*?```/, '').trim()
    } catch {
      // ignore parse failure
    }
  }

  // Execute the action through the validated service layer
  let actionResult: { executed: boolean; detail: string; eventId?: string } | null = null
  if (action) {
    actionResult = await executeAction(userId, action)
  }

  return { reply, action, raw, actionResult }
}

// Executes a companion action through the same validated service calls a UI action would use.
async function executeAction(
  userId: string,
  action: { type: string; data?: unknown },
): Promise<{ executed: boolean; detail: string; eventId?: string }> {
  const d = (action.data ?? {}) as {
    title?: string
    startTime?: string
    endTime?: string
    categoryId?: string | null
    categoryName?: string
    description?: string
    eventId?: string
    blockId?: string
    text?: string
  }
  try {
    switch (action.type) {
      case 'create_event': {
        if (!d.title || !d.startTime || !d.endTime) {
          return { executed: false, detail: 'Missing title, startTime, or endTime' }
        }
        // Resolve category by name if provided
        let categoryId = d.categoryId ?? null
        if (!categoryId && d.categoryName) {
          const cat = await db.category.findFirst({
            where: { userId, name: { equals: d.categoryName } },
          })
          categoryId = cat?.id ?? null
        }
        const event = await createEvent(userId, {
          title: d.title,
          startTime: d.startTime,
          endTime: d.endTime,
          categoryId,
          description: d.description,
          source: 'ai_confirmed',
          confidenceScore: 0.8,
        })
        return { executed: true, detail: `Created event "${event.title}"`, eventId: event.id }
      }
      case 'move_event': {
        if (!d.eventId) return { executed: false, detail: 'Missing eventId' }
        const update: Parameters<typeof updateEvent>[2] = {}
        if (d.startTime) update.startTime = d.startTime
        if (d.endTime) update.endTime = d.endTime
        if (d.title) update.title = d.title
        try {
          const event = await updateEvent(userId, d.eventId, update)
          if (!event) return { executed: false, detail: 'Event not found' }
          return { executed: true, detail: `Updated event "${event.title}"`, eventId: event.id }
        } catch (e) {
          if (e instanceof OverlapError) {
            return { executed: false, detail: 'The new time overlaps another event' }
          }
          throw e
        }
      }
      case 'resolve_gap': {
        if (!d.blockId || !d.title) return { executed: false, detail: 'Missing blockId or title' }
        let categoryId = d.categoryId ?? null
        if (!categoryId && d.categoryName) {
          const cat = await db.category.findFirst({
            where: { userId, name: { equals: d.categoryName } },
          })
          categoryId = cat?.id ?? null
        }
        const result = await resolveBlockWithText(userId, d.blockId, d.title, categoryId, d.description)
        if (!result) return { executed: false, detail: 'Block not found' }
        return { executed: true, detail: `Resolved gap with "${d.title}"`, eventId: result.event.id }
      }
      case 'create_reminder': {
        // Reminders are stored as notifications
        await db.notification.create({
          data: {
            userId,
            type: 'insight',
            title: 'Reminder',
            body: d.text ?? d.title ?? 'Reminder',
            actionType: 'view_event',
          },
        })
        return { executed: true, detail: 'Created a reminder' }
      }
      default:
        return { executed: false, detail: `Unknown action type: ${action.type}` }
    }
  } catch (e) {
    return { executed: false, detail: e instanceof Error ? e.message : 'Action failed' }
  }
}

export async function listConversations(userId: string) {
  return db.aIConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 1 } },
    take: 20,
  })
}

export async function getConversation(userId: string, conversationId: string) {
  const conv = await db.aIConversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  return conv
}

export async function generateAiGuess(userId: string, blockId: string): Promise<{ title: string; categoryId: string | null; confidence: number; reasoning: string } | null> {
  const block = await db.unknownBlock.findFirst({ where: { id: blockId, userId } })
  if (!block) return null

  const events = await listEventsForRange(userId, new Date(block.startTime.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), block.startTime.toISOString())

  const prompt = `Based on this user's recent timeline patterns, guess what they were doing during an unexplained gap.

Gap: ${format(block.startTime, 'EEE MMM d, h:mm a')} to ${format(block.endTime, 'h:mm a')} (${block.durationMinutes} minutes)

Recent events for pattern reference:
${events.slice(0, 20).map((e) => `- ${format(new Date(e.startTime), 'EEE h:mm a')}: "${e.title}" [${e.category?.name ?? 'none'}]`).join('\n') || '(no recent events)'}

Respond with ONLY a JSON object (no markdown, no prose):
{ "title": "short label", "categoryId": null, "categoryName": "Work|Study|Exercise|Sleep|Prayer|Social|Screen Time|Meals|Commute|Personal or null", "confidence": 0.0-1.0, "reasoning": "one sentence" }`

  let raw: string
  if (!isRemoteAIConfigured()) {
    return localAiGuess(block, events)
  }
  try {
    raw = await chatCompletion([
      { role: 'system', content: 'You output strictly valid JSON with no extra text.' },
      { role: 'user', content: prompt },
    ])
  } catch {
    return localAiGuess(block, events)
  }
  try {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    let categoryId: string | null = null
    if (parsed.categoryName) {
      const cat = await db.category.findFirst({ where: { userId, name: { equals: parsed.categoryName } } })
      if (cat) categoryId = cat.id
    }
    return {
      title: parsed.title ?? 'Unknown activity',
      categoryId,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning ?? 'Based on recent patterns',
    }
  } catch {
    return { title: 'Activity', categoryId: null, confidence: 0.3, reasoning: 'Could not determine a confident guess' }
  }
}

/** Friendly reply when no AI provider is configured (fully offline mode). */
function noAIReply(userMessage: string): string {
  const hasArabic = /[\u0600-\u06FF]/.test(userMessage)
  if (hasArabic) {
    return 'المساعد الذكي محتاج مفتاح خدمة ذكاء اصطناعي عشان يشتغل.\n\nروح للإعدادات وافتح قسم "الذكاء الاصطناعي" وحطّ مفتاح API — والمساعد هيرد عليك فورًا.\n\nوفي الوقت ده كل باقي مميزات التطبيق شغالة عادي: التسجيل اليدوي، الإضافة السريعة، والفجوات.'
  }
  return "The AI assistant needs an AI service API key to be enabled.\n\nOpen Settings → 'AI Provider' and add your API key — the assistant will reply immediately after.\n\nEverything else works normally: manual entry, quick add, and gap detection."
}

/** Smart local pattern-based guess with zero AI dependency. */
function localAiGuess(
  block: { startTime: Date; endTime: Date; durationMinutes: number },
  events: Array<{ startTime: Date | string; title: string; category?: { name: string } | null }>,
): { title: string; categoryId: string | null; confidence: number; reasoning: string } {
  const hour = block.startTime.getHours()
  const freq: Record<string, number> = {}
  for (const e of events) {
    const h = new Date(e.startTime).getHours()
    if (Math.abs(h - hour) <= 2 && e.category?.name) freq[e.category.name] = (freq[e.category.name] ?? 0) + 1
  }
  let best: string | null = null
  let bestCount = 0
  for (const [cat, count] of Object.entries(freq)) {
    if (count > bestCount) {
      best = cat
      bestCount = count
    }
  }
  if (!best) {
    if (hour >= 22 || hour < 6) best = 'Sleep'
    else if (hour >= 12 && hour <= 15) best = 'Meals'
    else best = 'Work'
  }
  const ar = best === 'Sleep' ? 'نوم' : best === 'Meals' ? 'أكلة' : best === 'Prayer' ? 'صلاة' : best === 'Exercise' ? 'تمارين' : best === 'Study' ? 'مذاكرة' : `غالبًا ${best}`
  return {
    title: best,
    categoryId: null,
    confidence: bestCount > 0 ? Math.min(0.9, 0.4 + bestCount * 0.25) : 0.45,
    reasoning:
      bestCount > 0
        ? `Based on your recent patterns around this time, you usually do ${best}`
        : ar === 'نوم'
          ? 'Based on the late hour, most likely sleep'
          : 'No pattern data available — best guess based on the time of day',
  }
}
