import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { getMonthCompletion } from '@/lib/services/calendar-service'

export async function GET(req: NextRequest) {
  const user = await getDemoUser()
  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  const now = new Date()
  const year = yearParam ? parseInt(yearParam) : now.getFullYear()
  const month = monthParam ? parseInt(monthParam) : now.getMonth()
  const data = await getMonthCompletion(user.id, year, month)
  return NextResponse.json(data)
}
