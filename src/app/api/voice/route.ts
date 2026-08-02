import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { audio } = body as { audio?: string }
    if (!audio) return NextResponse.json({ error: 'audio base64 required' }, { status: 400 })

    // Strip data URL prefix if present
    const base64 = audio.replace(/^data:audio\/[a-zA-Z]+;base64,/, '')

    const zai = await getZAI()
    const response = await zai.audio.asr.create({ file_base64: base64 })
    const text = (response as { text?: string }).text ?? ''
    return NextResponse.json({ text })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'transcription failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
