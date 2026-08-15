/**
 * AI Provider Abstraction Layer
 * -----------------------------
 * Unified layer for all AI functionality in the app (speech-to-text + chat).
 * Zero dependency on z.ai or any fixed vendor.
 *
 * Configuration (all optional, via .env or environment variables):
 *   AI_API_KEY   - API key for the OpenAI-compatible provider
 *   AI_BASE_URL  - Base URL of the provider (must expose /v1/audio/transcriptions & /v1/chat/completions)
 *   AI_MODEL     - Default chat model name (e.g. gpt-4o-mini, gpt-5-nano)
 *   AI_STT_MODEL - Speech-to-text model name (e.g. gpt-4o-transcribe, whisper-1)
 *
 * Behavior:
 *   - If AI_API_KEY is set → uses the remote OpenAI-compatible endpoint.
 *   - If AI_API_KEY is NOT set → falls back to smart local logic:
 *       transcribe() → Web Speech friendly note (browser STT handled client-side
 *                        where possible; server fallback acknowledges the limit)
 *       chat()       → not available server-side without a provider (handled as
 *                        "AI not configured" with graceful UX fallback)
 *
 * Endpoints expected at AI_BASE_URL:
 *   POST /v1/audio/transcriptions  (multipart: file=webm audio, model)
 *   POST /v1/chat/completions      (OpenAI chat format, stream:false)
 */

import { getAIConfig } from './ai-config'

function getConfig() {
  const cfg = getAIConfig()
  return {
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl.replace(/\/$/, ''),
    model: cfg.model,
    sttModel: cfg.sttModel,
  }
}

export function isRemoteAIConfigured(): boolean {
  return getConfig().apiKey.length > 0
}

/**
 * Transcribe audio (base64 webm/m4a) to text using the remote provider.
 */
export async function transcribeAudio(base64Audio: string): Promise<{ text: string }> {
  if (!isRemoteAIConfigured()) {
    return { text: '' }
  }

  const { apiKey, baseUrl, sttModel } = getConfig()
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

  void sttModel

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Transcription failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { text?: string }
  return { text: (data.text ?? '').trim() }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Chat completion using the remote provider (non-streaming).
 */
export async function chatCompletion(messages: ChatMessage[], temperature = 0.7): Promise<string> {
  if (!isRemoteAIConfigured()) {
    throw new Error('AI provider not configured (no AI_API_KEY)')
  }

  const { apiKey, baseUrl, model } = getConfig()
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
