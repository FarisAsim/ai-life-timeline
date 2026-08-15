import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { db } from '@/lib/db'
import { transcribeAudio, isRemoteAIConfigured } from '@/lib/ai-provider'

// Transcribe a voice note attachment using remote STT (graceful offline fallback)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser()
  const { id } = await params

  const att = await db.attachment.findFirst({ where: { id, userId: user.id } })
  if (!att) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (att.type !== 'voice_note') return NextResponse.json({ error: 'not a voice note' }, { status: 400 })

  // Already transcribed?
  if (att.transcript) return NextResponse.json({ transcript: att.transcript })

  if (!isRemoteAIConfigured() || !att.data) {
    return NextResponse.json({
      transcript: '',
      aiUnavailable: true,
      hint: 'Add an AI API key in Settings to enable voice transcription',
    })
  }

  try {
    const { text } = await transcribeAudio(att.data)
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
