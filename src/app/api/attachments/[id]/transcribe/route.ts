import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { getDemoUser } from '@/lib/services/demo-user'
import { db } from '@/lib/db'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

// Transcribe a voice note attachment using ASR
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser()
  const { id } = await params

  const att = await db.attachment.findFirst({ where: { id, userId: user.id } })
  if (!att) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (att.type !== 'voice_note') return NextResponse.json({ error: 'not a voice note' }, { status: 400 })

  // Already transcribed?
  if (att.transcript) return NextResponse.json({ transcript: att.transcript })

  try {
    const zai = await getZAI()
    const response = await zai.audio.asr.create({ file_base64: att.data })
    const text = (response as { text?: string }).text ?? ''
    const updated = await db.attachment.update({
      where: { id },
      data: { transcript: text },
    })
    return NextResponse.json({ transcript: updated.transcript })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'transcription failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
