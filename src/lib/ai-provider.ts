/**
 * AI Provider Abstraction Layer
 * -----------------------------
 * Unified layer for all AI functionality in the app (speech-to-text + chat).
 * Zero dependency on z.ai or any fixed vendor. Supports two provider types:
 *
 *   1. 'openai'  — any OpenAI-compatible endpoint (OpenAI, local servers…)
 *   2. 'gemini'  — Google Gemini API (free tier available via AI Studio)
 *
 * Configuration (all optional, via .env or the Settings UI → ai.config.json):
 *   AI_PROVIDER_TYPE — 'openai' | 'gemini' (default: 'openai')
 *   For OpenAI-compatible:
 *     AI_API_KEY / API Key in Settings
 *     AI_BASE_URL  — provider base URL (default https://api.openai.com/v1)
 *     AI_MODEL     — chat model (default gpt-4o-mini)
 *     AI_STT_MODEL — speech model (default gpt-4o-transcribe)
 *   For Gemini:
 *     GEMINI_API_KEY / Gemini API Key in Settings (free from aistudio.google.com/app/apikey)
 *     GEMINI_MODEL   — gemini-3.6-flash (audio + chat unified model)
 *
 * Behavior:
 *   - If the selected provider's key is set → uses the remote provider.
 *   - If no key → falls back to smart local logic (voice note parsing, local gap
 *     guessing, guidance message in the companion).
 */

import { getAIConfig, type AIProviderType } from './ai-config'

function getConfig() {
  const cfg = getAIConfig()
  return {
    providerType: cfg.providerType,
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl.replace(/\/$/, ''),
    model: cfg.model,
    sttModel: cfg.sttModel,
    geminiApiKey: cfg.geminiApiKey,
    geminiModel: cfg.geminiModel,
    geminiFallbackModels: cfg.geminiFallbackModels,
  }
}

export function getProviderType(): AIProviderType {
  return getConfig().providerType
}

function activeKey(): string {
  const cfg = getConfig()
  return cfg.providerType === 'gemini' ? cfg.geminiApiKey : cfg.apiKey
}

export function isRemoteAIConfigured(): boolean {
  return activeKey().length > 0
}

const TRANSCRIBE_PROMPT =
  'Write down exactly what is said in this audio, word for word, in the language used (it may be Arabic, Egyptian dialect, or any other language). Do not translate, do not summarize, do not add commentary — output only the raw transcript.'

const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'ffmpeg'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Wrap an async API call with automatic retries for rate-limit (429) errors.
 * Google free tier allows 15 requests/min and 1500/day per key. When that
 * window is hit we wait briefly and retry up to `maxAttempts` times.
 * All other errors are thrown immediately with a friendly Arabic message so
 * the user never sees raw English JSON.
 *
 * This is intentionally NOT a response cache — every retry asks Gemini
 * again, so answers stay fresh and time-dependent (no cached replies).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  ctx: { label: string },
  maxAttempts = 3,
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message
      const statusMatch = msg.match(/\((\d{3})\)/)
      const status = statusMatch ? Number(statusMatch[1]) : 0

      // Rate limit → wait (5s / 15s / 30s backoff) and retry
      if (status === 429 || /rate|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
        if (attempt < maxAttempts) {
          await sleep(5000 * Math.pow(3, attempt - 1))
          continue
        }
        throw new Error(
          `RATE_LIMIT:${ctx.label}:وصلنا لحد السماح المؤقت من Google (الطبقة المجانية). الخدمة هترجع تشتغل تلقائيًا خلال ساعة تقريبًا. جرّب تاني بعد شوية.`,
        )
      }

      // Invalid/revoked key
      if (status === 401 || status === 403) {
        throw new Error(
          `AUTH_ERROR:${ctx.label}:مفتاح Google Gemini مش شغال أو منتهي. افتح الإعدادات ← الذكاء الاصطناعي وتحقّق من المفتاح.`,
        )
      }

      // Any other error → immediate friendly Arabic message
      throw new Error(
        `AI_ERROR:${ctx.label}:حصل خطأ في الاتصال بخدمة الذكاء الاصطناعي (${status || 'خطأ غير معروف'}). جرّب تاني بعد شوية.`,
      )
    }
  }
  // All retries exhausted on rate limit
  throw lastError ?? new Error(`AI_ERROR:${ctx.label}:حدث خطأ غير معروف في خدمة الذكاء الاصطناعي.`)
}

/** Convert any supported audio (base64) to audio/opus via ffmpeg. */
async function convertToOpus(base64Audio: string): Promise<string> {
  const { spawn } = await import('node:child_process')
  const buffer = Buffer.from(base64Audio, 'base64')
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-c:a', 'libopus', '-b:a', '48k',
      '-f', 'opus',
      'pipe:1',
    ])
    const chunks: Buffer[] = []
    proc.stdout.on('data', (c: Buffer) => chunks.push(c))
    proc.stderr.on('data', () => {})
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg conversion failed (exit ${code})`))
      resolve(Buffer.concat(chunks).toString('base64'))
    })
    proc.stdin.end(buffer)
  })
}

/**
 * Transcribe audio (base64 webm/m4a) to text using the active remote provider.
 * - 'openai': POST /v1/audio/transcriptions (multipart)
 * - 'gemini': Gemini audio understanding (inline base64 opus, via interactions API)
 */
export async function transcribeAudio(base64Audio: string): Promise<{ text: string }> {
  if (!isRemoteAIConfigured()) {
    return { text: '' }
  }

  const cfg = getConfig()
  if (cfg.providerType === 'gemini') {
    return withFallbackModels(
      cfg.geminiModel,
      cfg.geminiFallbackModels,
      (model) => transcribeWithGemini(base64Audio, cfg.geminiApiKey, model),
      { label: 'تحويل الصوت لنص' },
    )
  }
  return withRetry(
    () => transcribeWithOpenAI(base64Audio, cfg.apiKey, cfg.baseUrl, cfg.sttModel),
    { label: 'تحويل الصوت لنص' },
  )
}

async function transcribeWithOpenAI(
  base64Audio: string,
  apiKey: string,
  baseUrl: string,
  sttModel: string,
): Promise<{ text: string }> {
  const buffer = Buffer.from(base64Audio, 'base64')

  // Build multipart/form-data manually (no extra dependency needed)
  const boundary = '----AIBoundary' + Math.random().toString(36).slice(2)
  const disposition = (name: string, filename: string, contentType: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`

  const parts: Buffer[] = [
    Buffer.from(disposition('file', 'audio.webm', 'audio/webm')),
    buffer,
    Buffer.from('\r\n'),
    Buffer.from(disposition('model', 'model', 'text/plain')),
    Buffer.from(sttModel),
    Buffer.from('\r\n--' + boundary + '--\r\n'),
  ]
  const body = Buffer.concat(parts)

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Transcription failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { text?: string }
  return { text: (data.text ?? '').trim() }
}

async function transcribeWithGemini(
  base64Audio: string,
  geminiApiKey: string,
  geminiModel: string,
): Promise<{ text: string }> {
  // Gemini interactions API does not support audio/webm — convert to audio/opus first.
  const opusBase64 = await convertToOpus(base64Audio)

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': geminiApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: geminiModel,
      input: [
        { type: 'text', text: TRANSCRIBE_PROMPT },
        { type: 'audio', data: opusBase64, mime_type: 'audio/opus' },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini transcription failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    output?: { text?: string }
    outputText?: string
    steps?: Array<{
      type?: string
      content?: Array<{ type?: string; text?: string }>
    }>
  }
  let text = ''
  for (const step of data.steps ?? []) {
    if (step.type === 'model_output' && step.content) {
      for (const part of step.content) {
        if (part.type === 'text' && part.text) text += part.text
      }
    }
  }
  return { text: (text || data.output?.text || data.outputText || '').trim() }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * When the primary Gemini model hits a persistent quota (429), automatically
 * try each fallback model in order. Every Gemini model has its own free-tier
 * quota counter, so rotating effectively multiplies the free quota. After a
 * successful fallback we still retry the primary later — the caller uses
 * withRetry per model too.
 */
async function withFallbackModels<T>(
  primaryModel: string,
  fallbacks: string[],
  fn: (model: string) => Promise<T>,
  ctx: { label: string },
): Promise<T> {
  try {
    return await withRetry(() => fn(primaryModel), ctx)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isQuota = /429|Quota exceeded|quota/.test(msg)
    if (!isQuota || fallbacks.length === 0) throw err
    let lastErr: Error = err instanceof Error ? err : new Error(String(err))
    for (const model of fallbacks) {
      try {
        return await withRetry(() => fn(model), { ...ctx, label: ctx.label + ` (${model})` })
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
        const m = lastErr.message
        // If this fallback also failed with quota, try the next one; otherwise bail out
        if (!/429|Quota exceeded|quota/.test(m)) throw lastErr
      }
    }
    throw lastErr
  }
}

/**
 * Chat completion using the active remote provider (non-streaming).
 * - 'openai': POST /v1/chat/completions (OpenAI chat format)
 * - 'gemini': Gemini interactions API (text + optional audio input)
 */
export async function chatCompletion(messages: ChatMessage[], temperature = 0.7): Promise<string> {
  if (!isRemoteAIConfigured()) {
    throw new Error('AI provider not configured (no API key)')
  }

  const cfg = getConfig()
  if (cfg.providerType === 'gemini') {
    return withFallbackModels(
      cfg.geminiModel,
      cfg.geminiFallbackModels,
      (model) => chatWithGemini(messages, temperature, cfg.geminiApiKey, model),
      { label: 'رد المساعد الذكي' },
    )
  }
  return withRetry(
    () => chatWithOpenAI(messages, temperature, cfg.apiKey, cfg.baseUrl, cfg.model),
    { label: 'رد المساعد الذكي' },
  )
}

async function chatWithOpenAI(
  messages: ChatMessage[],
  temperature: number,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Chat completion failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content ?? ''
}

async function chatWithGemini(
  messages: ChatMessage[],
  temperature: number,
  geminiApiKey: string,
  geminiModel: string,
): Promise<string> {
  // Flatten system + user/assistant messages into Gemini input parts
  const input: Array<Record<string, unknown>> = []
  for (const msg of messages) {
    if (msg.role === 'system') {
      input.push({ type: 'text', text: msg.content })
    } else {
      input.push({ type: 'text', text: msg.content })
    }
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': geminiApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: geminiModel,
      input,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini chat failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    output?: { text?: string }
    outputText?: string
    steps?: Array<{
      type?: string
      content?: Array<{ type?: string; text?: string; audio?: string }>
    }>
  }

  // Gemini Interactions API response: text lives in steps of type 'model_output'
  const steps = data.steps ?? []
  for (const step of steps) {
    if (step.type === 'model_output' && step.content) {
      const parts: string[] = []
      for (const part of step.content) {
        if (part.type === 'text' && part.text) parts.push(part.text)
      }
      if (parts.length > 0) return parts.join('').trim()
    }
  }
  return (data.output?.text ?? data.outputText ?? '').trim()
}
