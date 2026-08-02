import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { getAttachmentData, deleteAttachment } from '@/lib/services/timeline-service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser()
  const { id } = await params
  const att = await getAttachmentData(user.id, id)
  if (!att) return NextResponse.json({ error: 'not found' }, { status: 404 })
  // Return as data URL for easy <img> usage
  const buf = Buffer.from(att.data, 'base64')
  return new NextResponse(buf, {
    headers: {
      'Content-Type': att.mimeType,
      'Content-Disposition': `inline; filename="${att.filename}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser()
  const { id } = await params
  const ok = await deleteAttachment(user.id, id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
