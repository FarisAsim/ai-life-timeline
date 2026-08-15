import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { db } from '@/lib/db'
import { createEvent } from '@/lib/services/timeline-service'
import { OverlapError } from '@/lib/services/overlap-service'
import { transcribeAudio, chatCompletion, isRemoteAIConfigured } from '@/lib/ai-provider'

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  const body = await req.json()
  const { audio, create: shouldCreate, text } = body as { audio?: string; create?: boolean; text?: string }

  // If text is provided directly (fallback), skip ASR
  if (text) {
    return parseTextToEvent(user.id, text, req, shouldCreate)
  }

  if (!audio) return NextResponse.json({ error: 'audio or text required' }, { status: 400 })

  // Clean base64 - remove data URL prefix
  const base64 = audio.replace(/^data:audio\/[a-zA-Z]+;base64,/, '')

  try {
    // Transcribe with remote provider; fall back to keyword parser on failure
    let transcript = ''
    let remoteSTT = isRemoteAIConfigured()
    if (remoteSTT) {
      try {
        const result = await transcribeAudio(base64)
        transcript = result.text
      } catch {
        remoteSTT = false
      }
    }

    if (!transcript) {
      // Remote STT unavailable or empty → keyword-based local fallback
      return fallbackParse(base64, req, shouldCreate)
    }

    return parseTextToEvent(user.id, transcript, req, shouldCreate)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Voice capture failed'
    const friendly = translateAIError(msg)
    return NextResponse.json({ error: friendly, fallback: true }, { status: 500 })
  }
}

async function parseTextToEvent(userId: string, transcript: string, req: NextRequest, shouldCreate?: boolean) {
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

  // CRITICAL: The prompt MUST enforce same-language title and ask for missing info
  const systemPrompt = isArabic
    ? `أنت مساعد صوتي ذكي لتطبيق تسجيل الحياة.

قواعد صارمة جداً:
1. العنوان (title) لازم يكون بنفس لغة المستخدم بالظبط. لو قال "جيم" اكتب "جيم". لو قال "meeting" اكتب "meeting". لو قال "صلاة" اكتب "صلاة". ممنوع تترجم.
2. التوقيت: الوقت الحالي: ${now.toISOString()}
   - لو قال "دلوقتي" أو "النهارده" → startTime = الوقت الحالي
   - لو قال "من ساعة" → startTime = قبل ساعة
   - لو قال "الساعة 7" أو "7" → فسرها 7 مساءً (19:00) لو النهارده بعد الفجر
   - كل الأوقات بصيغة ISO 8601 UTC
3. المدة: جيم=60د، اجتماع=30-60د، أكل=30-45د، صلاة=15-30د، نوم=480د، دراسة=60-120د
4. لو المستخدم ماقالش وقت: ضع startTime = null و endTime = null (النظام هيسأله بعدين)
5. لو المستخدم قال وقت بس ماقالش مدة: استنتج مدة معقولة

المستخدم قال: "${transcript}"
الفئات المتاحة: ${categoryNames}

رد بـ JSON فقط:
{ "title": "العنوان بنفس لغة المستخدم", "startTime": "ISO أو null", "endTime": "ISO أو null", "categoryName": "اسم الفئة أو null", "description": "تفاصيل أو null", "missingTime": true أو false }`
    : `You are a smart voice assistant for a life-logging app.

STRICT RULES:
1. The title MUST be in the EXACT same language the user spoke. "gym" → "gym", "جيم" → "جيم". NEVER translate.
2. Time: Current time: ${now.toISOString()}
   - "just now" → startTime = current time
   - "an hour ago" → startTime = 1 hour before now
   - "at 7" or "7pm" → startTime = today at 19:00
   - All times in ISO 8601 UTC
3. Duration: gym=60m, meeting=30-60m, meal=30-45m, prayer=15-30m, sleep=480m, study=60-120m
4. If user didn't mention a time: set startTime = null, endTime = null (system will ask them)
5. If user mentioned time but no duration: infer a reasonable duration

User said: "${transcript}"
Available categories: ${categoryNames}

Respond with ONLY valid JSON:
{ "title": "title in user's language", "startTime": "ISO or null", "endTime": "ISO or null", "categoryName": "category or null", "description": "details or null", "missingTime": true or false }`

  let parsed: { title?: string; startTime?: string | null; endTime?: string | null; categoryName?: string | null; description?: string | null; missingTime?: boolean } = {}

  if (!isRemoteAIConfigured()) {
    // No remote AI → use smart local keyword parsing
    return fallbackParse('', req, shouldCreate, transcript)
  }

  try {
    const raw = await chatCompletion([
      { role: 'system', content: 'You output strictly valid JSON with no extra text. Never translate the title to a different language than what the user spoke.' },
      { role: 'user', content: systemPrompt },
    ])
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // AI provider failed mid-request — fall back to basic parsing
    return fallbackParse('', req, shouldCreate, transcript)
  }

  // Handle missingTime — if user didn't specify time, return a prompt asking for it
  if (parsed.missingTime || !parsed.startTime) {
    const isAr = detectedLanguage === 'ar' || detectedLanguage === 'mixed'
    const askMessage = isAr
      ? `تمام! ${parsed.title || 'الحدث'} امتى؟`
      : `Got it! What time is ${parsed.title || 'this event'}?`
    return NextResponse.json({
      transcript,
      detectedLanguage,
      event: {
        title: parsed.title || transcript.slice(0, 60),
        startTime: null,
        endTime: null,
        categoryName: parsed.categoryName ?? null,
        description: parsed.description ?? null,
      },
      missingTime: true,
      askMessage,
    })
  }

  // Validate and fix times
  const parsedStart = new Date(parsed.startTime || '')
  const parsedEnd = new Date(parsed.endTime || '')

  if (isNaN(parsedStart.getTime())) {
    parsed.startTime = now.toISOString()
  }
  if (isNaN(parsedEnd.getTime())) {
    parsed.endTime = new Date(new Date(parsed.startTime!).getTime() + 60 * 60 * 1000).toISOString()
  }
  if (new Date(parsed.endTime!).getTime() <= new Date(parsed.startTime!).getTime()) {
    parsed.endTime = new Date(new Date(parsed.startTime!).getTime() + 60 * 60 * 1000).toISOString()
  }

  if (!parsed.title || parsed.title.trim().length === 0) {
    parsed.title = transcript.slice(0, 60)
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

  let createdEvent: Awaited<ReturnType<typeof createEvent>> | null = null
  if (shouldCreate) {
    try {
      createdEvent = await createEvent(userId, eventData)
    } catch (e) {
      if (e instanceof OverlapError) {
        return NextResponse.json({ error: 'The parsed time overlaps an existing event', fallback: true }, { status: 409 })
      }
      throw e
    }
  }

  return NextResponse.json({
    transcript,
    detectedLanguage,
    event: { ...eventData, categoryName: parsed.categoryName },
    created: createdEvent ? { id: createdEvent.id, title: createdEvent.title } : null,
  })
}

/**
 * No-AI / ASR-failed path: smart keyword parsing.
 * Supports an optional transcript override (when ASR worked but LLM is unavailable).
 * Arabic hour mentions: "الساعة ثلاثة"/"الساعة ٣" etc.
 */
async function fallbackParse(base64: string, req: NextRequest, shouldCreate?: boolean, transcriptOverride?: string): Promise<NextResponse> {
  const now = new Date()
  const transcript = transcriptOverride ?? ''
  const detectedLanguage = /[\u0600-\u06FF]/.test(transcript) ? 'ar' : 'en'

  if (!transcript) {
    // ASR and AI both unavailable — record a voice note with a generic title
    const userId = (await resolveUser(req)).id
    const eventData = {
      title: detectedLanguage === 'ar' ? 'ملاحظة صوتية' : 'Voice note',
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      categoryId: null,
      description: detectedLanguage === 'ar' ? 'ملاحظة صوتية مسجلة بدون نص (ادخل النص يدويًا من تعديل الحدث)' : 'Voice note recorded without transcription (enter the text by editing the event)',
      source: 'user_manual' as const,
      confidenceScore: 0.5,
    }
    let createdEvent: Awaited<ReturnType<typeof createEvent>> | null = null
    if (shouldCreate) {
      try {
        createdEvent = await createEvent(userId, eventData)
      } catch (e) {
        if (e instanceof OverlapError) {
          return NextResponse.json({ error: 'The parsed time overlaps an existing event', fallback: true }, { status: 409 })
        }
        throw e
      }
    }
    return NextResponse.json({
      transcript: '',
      detectedLanguage,
      event: eventData,
      created: createdEvent ? { id: createdEvent.id, title: createdEvent.title } : null,
      aiUnavailable: true,
      sttUnavailable: true,
    })
  }

  // Extract hour: Arabic "الساعة ثلاثة/٣" or English "at 3" / "3pm"
  const hourNum: { [key: string]: number } = {
    'واحد': 1, 'اثنين': 2, 'ثلاث': 3, 'أربع': 4, 'خمس': 5, 'ست': 6, 'سبع': 7, 'ثمان': 8, 'تسع': 9, 'عشر': 10, '١٢': 12,
    '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '١٠': 10, '١١': 11,
  }
  const hourMatch =
    transcript.match(/الساعة\s+(واحد|اثنين|ثلاث|أربع|خمس|ست|سبع|ثمان|تسع|عشر|١٢|١|٢|٣|٤|٥|٦|٧|٨|٩|١٠|١١)/i) ||
    transcript.match(/\b(?:at\s+)?(1[0-2]|\d)\s*(pm)\b/i) ||
    transcript.match(/\b(?:at\s+)?(\d{1,2})\b/i)
  const userId = (await resolveUser(req)).id

  let startTime: string = now.toISOString()
  if (hourMatch) {
    const isPm = /pm|مساء/i.test(transcript)
    const token = hourMatch[1]
    let num = hourNum[token] ?? Number(token)
    if (isNaN(num) || num < 1 || num > 12) num = now.getHours() % 12 || 12
    const hour24 = isPm && num < 12 ? num + 12 : num === 12 && !isPm ? 0 : hourMatch[2] ? num + (isPm && num < 12 ? 12 : 0) : num
    const clamped = Math.max(0, Math.min(23, hour24))
    startTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), clamped, 0, 0)).toISOString()
  }

  const categories = await db.category.findMany({ where: { userId } })
  const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
  const matchedCat = categories.find((c) => transcript.toLowerCase().includes(c.name.toLowerCase()))
  const categoryId = matchedCat?.id ?? catMap.get(detectedLanguage === 'ar' ? 'عمل' : 'work') ?? null

  const eventData = {
    title: transcript.slice(0, 60),
    startTime,
    endTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
    categoryId,
    description: transcript,
    source: 'user_manual' as const,
    confidenceScore: 0.6,
  }

  let createdEvent: Awaited<ReturnType<typeof createEvent>> | null = null
  if (shouldCreate) {
    try {
      createdEvent = await createEvent(userId, eventData)
    } catch (e) {
      if (e instanceof OverlapError) {
        return NextResponse.json({ error: 'The parsed time overlaps an existing event', fallback: true }, { status: 409 })
      }
      throw e
    }
  }

  return NextResponse.json({
    transcript,
    detectedLanguage,
    event: { ...eventData, categoryName: matchedCat?.name ?? null },
    created: createdEvent ? { id: createdEvent.id, title: createdEvent.title } : null,
    aiUnavailable: true,
  })
}

/**
 * Turn raw ai-provider error messages into friendly Arabic messages.
 * ai-provider prefixes errors with TYPE:label:message (all in Arabic already)
 * or throws raw English errors; this normalizes both.
 */
function translateAIError(msg: string): string {
  if (msg.startsWith('RATE_LIMIT:')) return msg.split(':').slice(2).join(':')
  if (msg.startsWith('AUTH_ERROR:')) return msg.split(':').slice(2).join(':')
  if (msg.startsWith('AI_ERROR:')) return msg.split(':').slice(2).join(':')
  if (/429|quota|rate|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'وصلنا لحد السماح المؤقت من Google (الطبقة المجانية). الخدمة هترجع تشتغل تلقائيًا خلال ساعة تقريبًا. جرّب تاني بعد شوية.'
  }
  if (/401|403|API key|Invalid API|invalid key/i.test(msg)) {
    return 'مفتاح Google Gemini مش شغال أو منتهي. افتح الإعدادات ← الذكاء الاصطناعي وتحقّق من المفتاح.'
  }
  return msg || 'حصل خطأ أثناء معالجة التسجيل الصوتي. جرّب تاني بعد شوية.'
}
