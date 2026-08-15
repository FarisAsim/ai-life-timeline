import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { getMonthCompletion } from '@/lib/services/calendar-service'

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  const yearParam = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  const now = new Date()
  const year = yearParam ? parseInt(yearParam) : now.getFullYear()
  const month = monthParam ? parseInt(monthParam) : now.getMonth()
  const data = await getMonthCompletion(user.id, year, month)
  return NextResponse.json(data)
}
