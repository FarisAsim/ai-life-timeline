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

  // Prefer streaming when the client asks for it (newer app builds); fall back
  // to the classic JSON response for older clients / API consumers.
  if (body.stream === true) {
    return streamResponse(user.id, conversationId ?? null, message, user.timezone ?? 'Africa/Cairo')
  }
  const result = await chat(user.id, conversationId ?? null, message, user.timezone ?? 'Africa/Cairo')
  return NextResponse.json(result)
}

/** Server-sent events reply: text chunks + action result as they arrive. */
async function streamResponse(
  userId: string,
  conversationId: string | null,
  message: string,
  timezone: string,
): Promise<Response> {
  const encoder = new TextEncoder()
  const sse = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`

  const stream = new ReadableStream({
    async start(controller) {
      let finalReply = ''
      let finalAction: { type: string; data?: unknown } | null = null
      let finalActionResult: { executed: boolean; detail: string; eventId?: string } | null = null
      try {
        // chat() streams Gemini internally; each generated chunk is pushed to the
        // client immediately so the reply appears while the model is thinking.
        const full = await chat(userId, conversationId, message, timezone, (partial) => {
          finalReply = partial
          controller.enqueue(encoder.encode(sse({ type: 'reply', text: partial })))
        })
        finalAction = full.action
        finalActionResult = full.actionResult
        controller.enqueue(encoder.encode(sse({ type: 'reply', text: finalReply })))
        controller.enqueue(encoder.encode(sse({ type: 'action', action: finalAction, actionResult: finalActionResult })))
        controller.enqueue(encoder.encode(sse({ type: 'done' })))
        controller.close()
      } catch (err) {
        controller.enqueue(encoder.encode(sse({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' })))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
