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
    return transcribeWithGemini(base64Audio, cfg.geminiApiKey, cfg.geminiModel)
  }
  return transcribeWithOpenAI(base64Audio, cfg.apiKey, cfg.baseUrl, cfg.sttModel)
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
    return chatWithGemini(messages, temperature, cfg.geminiApiKey, cfg.geminiModel)
  }
  return chatWithOpenAI(messages, temperature, cfg.apiKey, cfg.baseUrl, cfg.model)
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
