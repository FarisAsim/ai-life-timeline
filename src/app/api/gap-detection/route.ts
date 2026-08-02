import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { detectGapsForDay } from '@/lib/services/gap-detection-service'

export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  const date = body?.date
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const created = await detectGapsForDay(user.id, date)
  return NextResponse.json({ created, count: created.length })
}
