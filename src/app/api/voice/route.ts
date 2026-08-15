import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio, isRemoteAIConfigured } from '@/lib/ai-provider'

// Generic speech-to-text endpoint using the remote provider (graceful offline fallback)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { audio } = body as { audio?: string }
    if (!audio) return NextResponse.json({ error: 'audio base64 required' }, { status: 400 })

    if (!isRemoteAIConfigured()) {
      return NextResponse.json({
        text: '',
        aiUnavailable: true,
        hint: 'Add an AI API key in Settings to enable voice transcription',
      })
    }

    // Strip data URL prefix if present
    const base64 = audio.replace(/^data:audio\/[a-zA-Z]+;base64,/, '')
    const { text } = await transcribeAudio(base64)
    return NextResponse.json({ text })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'transcription failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
