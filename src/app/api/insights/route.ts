import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { getInsights } from '@/lib/services/analytics-service'

export async function GET(req: NextRequest) {
  const user = await getDemoUser()
  const rangeParam = req.nextUrl.searchParams.get('days')
  const days = rangeParam ? parseInt(rangeParam) : 30
  const insights = await getInsights(user.id, days)
  return NextResponse.json(insights)
}
