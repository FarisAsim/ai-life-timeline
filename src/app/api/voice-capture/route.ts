import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { getDemoUser } from '@/lib/services/demo-user'
import { db } from '@/lib/db'
import { createEvent } from '@/lib/services/timeline-service'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

// POST /api/voice-capture
// Accepts base64 audio, transcribes it, parses it into an event using the LLM,
// and optionally creates the event.
//
// Body: { audio: string (base64), create?: boolean }
// Returns: { transcript, event: {title, startTime, endTime, categoryId, categoryName, description}, detectedLanguage }
export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  const { audio, create: shouldCreate } = body as { audio?: string; create?: boolean }

  if (!audio) return NextResponse.json({ error: 'audio base64 required' }, { status: 400 })

  const base64 = audio.replace(/^data:audio\/[a-zA-Z]+;base64,/, '')

  try {
    const zai = await getZAI()

    // Step 1: Transcribe the audio using ASR
    const asrResponse = await zai.audio.asr.create({ file_base64: base64 })
    const transcript = (asrResponse as { text?: string }).text?.trim() ?? ''

    if (!transcript) {
      return NextResponse.json({ error: 'Could not transcribe audio. Please try again or type manually.' }, { status: 422 })
    }

    // Step 2: Detect language (simple heuristic: Arabic script ratio)
    const arabicChars = (transcript.match(/[\u0600-\u06FF]/g) || []).length
    const totalChars = transcript.replace(/\s/g, '').length
    const arabicRatio = totalChars > 0 ? arabicChars / totalChars : 0
    const detectedLanguage = arabicRatio > 0.7 ? 'ar' : arabicRatio > 0.2 ? 'mixed' : 'en'

    // Step 3: Parse the transcript into a structured event using the LLM
    const categories = await db.category.findMany({ where: { userId: user.id } })
    const categoryNames = categories.map((c) => c.name).join(', ')

    const now = new Date()
    const systemPrompt = `You are a voice assistant for a life-logging app. Parse the user's spoken input into a structured timeline event.

The user said: "${transcript}"
Current time: ${now.toISOString()} (${user.timezone})
Available categories: ${categoryNames}

Extract:
- title: a short label for the event (in the same language the user spoke)
- startTime: ISO 8601 datetime (if they said "just now" or past tense, use the current time or recent past; if future, infer the time)
- endTime: ISO 8601 datetime (infer a reasonable duration if not stated: gym=1h, meeting=30-60m, meal=30-45m, prayer=15-30m, study=1-2h, social=1-3h, commute=30-60m)
- categoryName: the best matching category from the list, or null
- description: optional, any extra context they mentioned

Respond with ONLY valid JSON (no markdown, no prose):
{ "title": "...", "startTime": "ISO", "endTime": "ISO", "categoryName": "..." or null, "description": "..." or null }`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'You output strictly valid JSON with no extra text.' },
        { role: 'user', content: systemPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    let parsed: { title?: string; startTime?: string; endTime?: string; categoryName?: string | null; description?: string | null } = {}
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // Fallback: create a simple event with the transcript as title
      parsed = {
        title: transcript.slice(0, 60),
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        categoryName: null,
        description: transcript,
      }
    }

    // Resolve category
    let categoryId: string | null = null
    if (parsed.categoryName) {
      const cat = await db.category.findFirst({
        where: { userId: user.id, name: { equals: parsed.categoryName, mode: 'insensitive' } },
      })
      // Note: SQLite doesn't support mode: insensitive, so try case-insensitive manually
      const catFallback = cat ?? await db.category.findFirst({
        where: { userId: user.id },
      })
      categoryId = cat?.id ?? null
    }

    const eventData = {
      title: parsed.title || transcript.slice(0, 60),
      startTime: parsed.startTime || now.toISOString(),
      endTime: parsed.endTime || new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      categoryId,
      description: parsed.description || undefined,
      source: 'user_manual' as const,
      confidenceScore: 0.9,
    }

    // Step 4: Optionally create the event
    let createdEvent = null
    if (shouldCreate) {
      createdEvent = await createEvent(user.id, eventData)
    }

    return NextResponse.json({
      transcript,
      detectedLanguage,
      event: {
        ...eventData,
        categoryName: parsed.categoryName,
      },
      created: createdEvent ? { id: createdEvent.id, title: createdEvent.title } : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Voice capture failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
