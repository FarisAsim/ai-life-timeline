import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { updateEvent, deleteEvent } from '@/lib/services/timeline-service'
import { OverlapError } from '@/lib/services/overlap-service'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser()
  const { id } = await params
  const body = await req.json()
  try {
    const event = await updateEvent(user.id, id, body)
    if (!event) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ event })
  } catch (e) {
    if (e instanceof OverlapError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser()
  const { id } = await params
  const ok = await deleteEvent(user.id, id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
