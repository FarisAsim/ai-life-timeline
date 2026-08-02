import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { addAttachment } from '@/lib/services/timeline-service'

// Upload an attachment (base64-encoded) for an event
export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  const { eventId, filename, mimeType, data } = body as { eventId?: string; filename?: string; mimeType?: string; data?: string }
  if (!eventId || !filename || !mimeType || !data) {
    return NextResponse.json({ error: 'eventId, filename, mimeType, data required' }, { status: 400 })
  }
  // Strip data URL prefix if present
  const cleanData = data.replace(/^data:[^;]+;base64,/, '')
  const size = Math.floor((cleanData.length * 3) / 4)
  // Limit to 5MB
  if (size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 })
  }
  const att = await addAttachment(user.id, eventId, { filename, mimeType, size, data: cleanData })
  if (!att) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  return NextResponse.json({ attachment: att })
}
