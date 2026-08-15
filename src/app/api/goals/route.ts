import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { listGoals, createGoal } from '@/lib/services/goal-service'

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  const goals = await listGoals(user.id)
  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  const body = await req.json()
  const { title, type, categoryId, tag, targetValue, period } = body
  if (!title || !type || !targetValue || !period) {
    return NextResponse.json({ error: 'title, type, targetValue, period required' }, { status: 400 })
  }
  const goal = await createGoal(user.id, { title, type, categoryId: categoryId ?? null, tag: tag ?? null, targetValue: Number(targetValue), period })
  return NextResponse.json({ goal })
}
