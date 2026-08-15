import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { chat, listConversations, getConversation } from '@/lib/services/companion-service'

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  const convId = req.nextUrl.searchParams.get('conversationId')
  if (convId) {
    const conv = await getConversation(user.id, convId)
    if (!conv) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ conversation: conv })
  }
  const conversations = await listConversations(user.id)
  return NextResponse.json({ conversations })
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  const body = await req.json()
  const { message, conversationId } = body
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
  const result = await chat(user.id, conversationId ?? null, message, user.timezone ?? 'Africa/Cairo')
  return NextResponse.json(result)
}
