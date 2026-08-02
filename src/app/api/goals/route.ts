import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { listGoals, createGoal } from '@/lib/services/goal-service'

export async function GET() {
  const user = await getDemoUser()
  const goals = await listGoals(user.id)
  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  const { title, type, categoryId, targetValue, period } = body
  if (!title || !type || !targetValue || !period) {
    return NextResponse.json({ error: 'title, type, targetValue, period required' }, { status: 400 })
  }
  const goal = await createGoal(user.id, { title, type, categoryId: categoryId ?? null, targetValue: Number(targetValue), period })
  return NextResponse.json({ goal })
}
