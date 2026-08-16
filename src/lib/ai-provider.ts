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

/**
 * Transcribe audio (base64 webm/m4a) to text using the active remote provider.
 * - 'openai': POST /v1/audio/transcriptions (multipart, webm/mp4)
 * - 'gemini': Gemini audio understanding (inline base64 audio/wav, via interactions API).
 *   The browser converts the microphone recording to 16kHz mono WAV via the
 *   Web Audio API before sending — no server-side ffmpeg/child_process needed.
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
  // Audio is pre-converted to WAV (16kHz mono) by the browser; Gemini supports audio/wav.

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
        { type: 'audio', data: base64Audio, mime_type: 'audio/wav' },
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
 * Parse a server-sent events body and collect all text fragments emitted by
 * Gemini model_output steps. Used for streaming responses.
 */
export async function collectSseText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const textParts: string[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (!payload) continue
        try {
          const ev = JSON.parse(payload) as {
            event_type?: string
            interaction_id?: string
            status?: string
            step?: {
              type?: string
              content?: Array<{ type?: string; text?: string; audio?: string }>
            }
            interaction?: { output?: { text?: string } }
          }
          if (ev.step?.type === 'model_output' && ev.step.content) {
            for (const part of ev.step.content) {
              if (part.type === 'text' && part.text) textParts.push(part.text)
            }
          }
          if (ev.interaction?.output?.text) textParts.push(ev.interaction.output.text)
        } catch {
          // skip malformed SSE frames
        }
      }
    }
  }
  return textParts.join('').trim()
}

/**
 * Streaming chat completion. Returns the full assistant reply text (collected
 * from the SSE stream). The caller may also pass an onChunk callback to push
 * incremental text to the client as it arrives.
 * - 'gemini': Gemini interactions API with stream: true + ?alt=sse
 * - 'openai': falls back to the non-streaming chat/completions path
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
): Promise<string> {
  if (!isRemoteAIConfigured()) {
    throw new Error('AI provider not configured (no API key)')
  }

  const cfg = getConfig()
  if (cfg.providerType === 'gemini') {
    return chatWithGeminiStream(messages, cfg.geminiApiKey, cfg.geminiModel, cfg.geminiFallbackModels, onChunk)
  }
  return chatWithOpenAI(messages, 0.7, cfg.apiKey, cfg.baseUrl, cfg.model)
}

async function chatWithGeminiStream(
  messages: ChatMessage[],
  geminiApiKey: string,
  geminiModel: string,
  geminiFallbackModels: string[],
  onChunk?: (text: string) => void,
): Promise<string> {
  const input: Array<Record<string, unknown>> = messages.map((msg) => ({ type: 'text', text: msg.content }))

  const doStream = async (model: string): Promise<string> => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        stream: true,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Gemini stream failed (${res.status}): ${errText.slice(0, 200)}`)
    }
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const textParts: string[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            const ev = JSON.parse(payload) as {
              step?: {
                type?: string
                content?: Array<{ type?: string; text?: string; audio?: string }>
              }
            }
            const evType = (ev as { event_type?: string }).event_type

            // Gemini Interactions SSE: text arrives in 'step.delta' events and the
            // full interaction finishes with 'interaction.completed'.
            if (evType === 'step.delta') {
              const delta = (ev as { step?: { content?: Array<{ type?: string; text?: string }> } }).step?.content
              if (delta) {
                for (const part of delta) {
                  if (part.type === 'text' && part.text) {
                    textParts.push(part.text)
                    onChunk?.(textParts.join(''))
                  }
                }
              }
            } else if (evType === 'interaction.completed') {
              const outputText = (ev as { interaction?: { output?: { text?: string } } }).interaction?.output?.text
              if (outputText && textParts.length === 0) textParts.push(outputText)
            }
            // Older server formats: full steps or final interaction payload
            if (ev.step?.type === 'model_output' && ev.step.content) {
              for (const part of ev.step.content) {
                if (part.type === 'text' && part.text) textParts.push(part.text)
              }
            }
            const finalText = (ev as { interaction?: { output?: { text?: string } } }).interaction?.output?.text
            if (finalText) {
              textParts.push(finalText as string)
            }
          } catch {
            // skip malformed SSE frames
          }
        }
      }
    }
    return textParts.join('').trim()
  }

  // Primary model, then fallback models on quota errors (same policy as non-stream)
  try {
    return await withRetry(() => doStream(geminiModel), { label: 'رد المساعد الذكي' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isQuota = /429|Quota exceeded|quota/.test(msg)
    if (!isQuota || geminiFallbackModels.length === 0) throw err
    for (const model of geminiFallbackModels) {
      try {
        return await withRetry(() => doStream(model), { label: `رد المساعد الذكي (${model})` })
      } catch (e) {
        if (!/429|Quota exceeded|quota/.test(e instanceof Error ? e.message : String(e))) throw e
      }
    }
    throw err
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
