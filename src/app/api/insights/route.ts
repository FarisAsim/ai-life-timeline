import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { getInsights } from '@/lib/services/analytics-service'

export async function GET(req: NextRequest) {
  const user = await getDemoUser()
  const rangeParam = req.nextUrl.searchParams.get('days')
  const days = rangeParam ? parseInt(rangeParam) : 30
  const lang = req.nextUrl.searchParams.get('lang')
  const insights = await getInsights(user.id, days, lang)
  return NextResponse.json(insights)
}
