import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { detectGapsForDay } from '@/lib/services/gap-detection-service'

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  const body = await req.json()
  const date = body?.date
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const created = await detectGapsForDay(user.id, date)
  return NextResponse.json({ created, count: created.length })
}
