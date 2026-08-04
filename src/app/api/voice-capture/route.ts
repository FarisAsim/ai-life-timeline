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

export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  const { audio, create: shouldCreate, text } = body as { audio?: string; create?: boolean; text?: string }

  // If text is provided directly (fallback), skip ASR
  if (text) {
    return parseTextToEvent(user.id, text, shouldCreate)
  }

  if (!audio) return NextResponse.json({ error: 'audio or text required' }, { status: 400 })

  // Clean base64 - remove data URL prefix
  const base64 = audio.replace(/^data:audio\/[a-zA-Z]+;base64,/, '')

  try {
    const zai = await getZAI()

    // Transcribe
    let transcript = ''
    try {
      const asrResponse = await zai.audio.asr.create({ file_base64: base64 })
      transcript = (asrResponse as { text?: string }).text?.trim() ?? ''
    } catch (asrError) {
      // ASR failed - return error so frontend can show text fallback
      const errMsg = asrError instanceof Error ? asrError.message : 'ASR failed'
      return NextResponse.json({
        error: 'Could not transcribe audio. Please type instead.',
        asrError: errMsg,
        fallback: true,
      }, { status: 422 })
    }

    if (!transcript) {
      return NextResponse.json({
        error: 'No speech detected. Please try again or type manually.',
        fallback: true,
      }, { status: 422 })
    }

    return parseTextToEvent(user.id, transcript, shouldCreate)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Voice capture failed'
    return NextResponse.json({ error: msg, fallback: true }, { status: 500 })
  }
}

async function parseTextToEvent(userId: string, transcript: string, shouldCreate?: boolean) {
  const zai = await getZAI()

  // Detect language
  const arabicChars = (transcript.match(/[\u0600-\u06FF]/g) || []).length
  const totalChars = transcript.replace(/\s/g, '').length
  const arabicRatio = totalChars > 0 ? arabicChars / totalChars : 0
  const detectedLanguage = arabicRatio > 0.7 ? 'ar' : arabicRatio > 0.2 ? 'mixed' : 'en'

  // Parse into structured event
  const categories = await db.category.findMany({ where: { userId } })
  const categoryNames = categories.map((c) => c.name).join(', ')
  const now = new Date()

  const isArabic = detectedLanguage === 'ar' || detectedLanguage === 'mixed'
  const systemPrompt = isArabic
    ? `أنت مساعد صوتي لتطبيق تسجيل الحياة. حلل ما قاله المستخدم وحوله إلى حدث منظم.
المستخدم قال: "${transcript}"
الوقت الحالي: ${now.toISOString()}
الفئات المتاحة: ${categoryNames}
استخرج:
- title: عنوان قصير للحدث (بنفس لغة المستخدم)
- startTime: تاريخ ووقت بصيغة ISO (لو قال "دلوقتي" استخدم الوقت الحالي)
- endTime: تاريخ ووقت بصيغة ISO (استنتج مدة معقولة: جيم=ساعة، اجتماع=30-60د، أكل=30-45د)
- categoryName: أفضل فئة من القائمة
- description: أي تفاصيل إضافية
رد بـ JSON فقط:
{ "title": "...", "startTime": "ISO", "endTime": "ISO", "categoryName": "..." أو null, "description": "..." أو null }`
    : `You are a voice assistant for a life-logging app. Parse the user's spoken input into a structured timeline event.
The user said: "${transcript}"
Current time: ${now.toISOString()}
Available categories: ${categoryNames}
Extract:
- title: short label (same language as user)
- startTime: ISO datetime
- endTime: ISO datetime (infer duration: gym=1h, meeting=30-60m, meal=30-45m)
- categoryName: best matching category or null
- description: any extra context
Respond with ONLY valid JSON:
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
      where: { userId, name: { equals: parsed.categoryName } },
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

  let createdEvent = null
  if (shouldCreate) {
    createdEvent = await createEvent(userId, eventData)
  }

  return NextResponse.json({
    transcript,
    detectedLanguage,
    event: { ...eventData, categoryName: parsed.categoryName },
    created: createdEvent ? { id: createdEvent.id, title: createdEvent.title } : null,
  })
}
