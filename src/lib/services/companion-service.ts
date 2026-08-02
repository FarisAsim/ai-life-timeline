import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { listEventsForRange } from './timeline-service'
import { listOpenBlocks } from './gap-detection-service'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

const SYSTEM_PROMPT = `You are the AI Companion for "AI Life Timeline" — an app that records a person's life hour-by-hour and never wants to lose a moment.

Your role:
- Answer questions grounded ONLY in the timeline data provided to you in the user context. Never fabricate events.
- If the user asks about a time period with no recorded data, say so honestly and reference any Unknown Blocks that exist for that period.
- You can take actions by responding with a JSON action block. When you take an action, ALWAYS output it as a fenced JSON block tagged \`action\` so the client can parse it.
- Be warm but concise. Use a friendly, conversational tone.

Action format (output as a fenced code block with language "action"):
\`\`\`action
{ "type": "create_event", "title": "...", "startTime": "ISO", "endTime": "ISO", "categoryId": "...|null", "description": "..." }
\`\`\`
or
\`\`\`action
{ "type": "answer", "text": "your visible reply if you also took an action" }
\`\`\`

If you are only answering (no action), reply in plain text without a code block.

The user's timezone is the one in their context. All times you reference must be human-readable.`

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
    return `- ${start} – ${end}: "${e.title}" [category: ${e.category?.name ?? 'none'}] [source: ${e.source}]`
  })
  const blockLines = blocks.slice(0, 10).map((b) => {
    const start = format(new Date(b.startTime), 'EEE MMM d, h:mm a')
    const end = format(new Date(b.endTime), 'h:mm a')
    return `- ${start} – ${end} (gap of ${Math.round(b.durationMinutes / 60)}h${Math.round(b.durationMinutes % 60)}m, severity: ${b.severity})`
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
}

export async function chat(userId: string, conversationId: string | null, userMessage: string, userTimezone: string): Promise<CompanionResponse> {
  const zai = await getZAI()
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

  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices[0]?.message?.content ?? ''

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

  return { reply, action, raw }
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

  const zai = await getZAI()
  const events = await listEventsForRange(userId, new Date(block.startTime.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), block.startTime.toISOString())

  const prompt = `Based on this user's recent timeline patterns, guess what they were doing during an unexplained gap.

Gap: ${format(block.startTime, 'EEE MMM d, h:mm a')} to ${format(block.endTime, 'h:mm a')} (${block.durationMinutes} minutes)

Recent events for pattern reference:
${events.slice(0, 20).map((e) => `- ${format(new Date(e.startTime), 'EEE h:mm a')}: "${e.title}" [${e.category?.name ?? 'none'}]`).join('\n') || '(no recent events)'}

Respond with ONLY a JSON object (no markdown, no prose):
{ "title": "short label", "categoryId": null, "categoryName": "Work|Study|Exercise|Sleep|Prayer|Social|Screen Time|Meals|Commute|Personal or null", "confidence": 0.0-1.0, "reasoning": "one sentence" }`

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'You output strictly valid JSON with no extra text.' },
      { role: 'user', content: prompt },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    let categoryId: string | null = null
    if (parsed.categoryName) {
      const cat = await db.category.findFirst({ where: { userId, name: { equals: parsed.categoryName, mode: 'insensitive' } } })
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
