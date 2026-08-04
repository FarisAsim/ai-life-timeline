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

  // CRITICAL: Use a unified prompt that enforces same-language title and correct time parsing
  const systemPrompt = isArabic
    ? `أنت مساعد صوتي لتطبيق تسجيل الحياة. مهمتك تحليل كلام المستخدم وإنشاء حدث.

قواعد صارمة:
1. العنوان (title) لازم يكون بنفس لغة المستخدم. لو قال "جيم" اكتب "جيم". لو قال "meeting" اكتب "meeting".
2. التوقيت: استخدم الوقت الحالي كمرجع. الوقت الحالي: ${now.toISOString()}
   - لو قال "دلوقتي" أو "النهارده" → startTime = الوقت الحالي
   - لو قال "من ساعة" → startTime = قبل ساعة من دلوقتي
   - لو قال الساعة بالرقم (مثلا "الساعة 3") → فسرها على إنها 3 العصر (15:00) لو النهارده بعد الفجر، أو 3 الفجر لو قبل كده
   - كل الأوقات بصيغة ISO 8601 بصيطة (UTC): 2026-08-04T13:00:00.000Z
3. المدة: استنتج مدة معقولة: جيم=60د، اجتماع=30-60د، أكل=30-45د، صلاة=15-30د، نوم=480د، دراسة=60-120د

المستخدم قال: "${transcript}"
الفئات المتاحة: ${categoryNames}

رد بـ JSON فقط بدون أي نص إضافي:
{ "title": "العنوان بنفس لغة المستخدم", "startTime": "ISO", "endTime": "ISO", "categoryName": "اسم الفئة أو null", "description": "تفاصيل أو null" }`
    : `You are a voice assistant for a life-logging app. Parse the user's input into a timeline event.

STRICT RULES:
1. The title MUST be in the same language the user spoke. If they said "gym", write "gym". If they said "جيم", write "جيم".
2. Time: Current time is ${now.toISOString()}. Use it as reference.
   - "just now" or "right now" → startTime = current time
   - "an hour ago" → startTime = 1 hour before now
   - "at 3pm" → startTime = today at 15:00
   - All times in ISO 8601 UTC format: 2026-08-04T13:00:00.000Z
3. Duration: gym=60m, meeting=30-60m, meal=30-45m, prayer=15-30m, sleep=480m, study=60-120m

User said: "${transcript}"
Available categories: ${categoryNames}

Respond with ONLY valid JSON, no extra text:
{ "title": "title in user's language", "startTime": "ISO", "endTime": "ISO", "categoryName": "category or null", "description": "details or null" }`

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'You output strictly valid JSON with no extra text. Never translate the title to a different language than what the user spoke.' },
      { role: 'user', content: systemPrompt },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  let parsed: { title?: string; startTime?: string; endTime?: string; categoryName?: string | null; description?: string | null } = {}
  try {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    parsed = JSON.parse(cleaned)

    // Validate and fix times
    const parsedStart = new Date(parsed.startTime || '')
    const parsedEnd = new Date(parsed.endTime || '')

    // If times are invalid, use sensible defaults
    if (isNaN(parsedStart.getTime())) {
      parsed.startTime = now.toISOString()
    }
    if (isNaN(parsedEnd.getTime())) {
      parsed.endTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    }

    // If end is before start, fix it
    if (new Date(parsed.endTime!).getTime() <= new Date(parsed.startTime!).getTime()) {
      parsed.endTime = new Date(new Date(parsed.startTime!).getTime() + 60 * 60 * 1000).toISOString()
    }

    // Ensure title is not empty
    if (!parsed.title || parsed.title.trim().length === 0) {
      parsed.title = transcript.slice(0, 60)
    }
  } catch {
    parsed = {
      title: transcript.slice(0, 60),
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      categoryName: null,
      description: transcript,
    }
  }

  // Resolve category - try exact match, then case-insensitive
  let categoryId: string | null = null
  if (parsed.categoryName) {
    const cat = await db.category.findFirst({
      where: { userId, name: { equals: parsed.categoryName } },
    })
    if (cat) {
      categoryId = cat.id
    } else {
      // Try case-insensitive by fetching all and matching manually (SQLite limitation)
      const allCats = await db.category.findMany({ where: { userId } })
      const matched = allCats.find((c) => c.name.toLowerCase() === parsed.categoryName!.toLowerCase())
      categoryId = matched?.id ?? null
    }
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
