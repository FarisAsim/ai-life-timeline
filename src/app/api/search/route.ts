import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { semanticSearch } from '@/lib/services/search-service'

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  const query = req.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ results: [] })
  const results = await semanticSearch(user.id, query)
  return NextResponse.json({ results })
}
