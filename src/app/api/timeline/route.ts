import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { listEventsForDay, createEvent } from '@/lib/services/timeline-service'
import { OverlapError } from '@/lib/services/overlap-service'

export async function GET(req: NextRequest) {
  const user = await getDemoUser()
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date query param required' }, { status: 400 })
  const events = await listEventsForDay(user.id, date)
  return NextResponse.json({ events })
}

export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  if (!body.title || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: 'title, startTime, endTime required' }, { status: 400 })
  }
  try {
    const event = await createEvent(user.id, {
      title: body.title,
      description: body.description,
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      notes: body.notes,
      tags: body.tags,
      categoryId: body.categoryId ?? null,
      confidenceScore: body.confidenceScore,
      source: body.source,
    })
    return NextResponse.json({ event })
  } catch (e) {
    if (e instanceof OverlapError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }
}
