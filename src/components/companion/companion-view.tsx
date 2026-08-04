'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useCompanionChat, useConversations } from '@/hooks/use-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Send, Sparkles, Mic, Square, Loader2, MessageSquare, Bot, User, Trash2, Lightbulb,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

const SUGGESTIONS_EN = [
  'Add a gym session for tomorrow at 6am',
  'What did I do yesterday afternoon?',
  'Resolve my biggest gap from the AI guess',
  'Remind me to review my timeline tonight',
]

const SUGGESTIONS_AR = [
  'ضيف جلسة جيم بكرة الساعة 6 الصبح',
  'أنا عملت إيه امبارح بالليل؟',
  'حل أكبر فجوة من تخمين الذكاء الاصطناعي',
  'فكرني أراجع الخط الزمني النهارده بالليل',
]

export function CompanionView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingConv, setLoadingConv] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const { t, locale } = useTranslation()
  const suggestions = locale === 'ar-EG' ? SUGGESTIONS_AR : SUGGESTIONS_EN

  const chat = useCompanionChat()
  const { data: conversations } = useConversations()
  const scrollRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const loadConversation = async (id: string) => {
    setLoadingConv(true)
    try {
      const r = await fetch(`/api/companion?conversationId=${id}`)
      const j = await r.json()
      const conv = j.conversation
      if (conv) {
        setMessages(
          conv.messages.map((m: { role: string; content: string; createdAt: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
          })),
        )
        setConversationId(id)
      }
    } catch {
      toast.error('Failed to load conversation')
    } finally {
      setLoadingConv(false)
    }
  }

  const send = async (text?: string) => {
    const message = (text ?? input).trim()
    if (!message || chat.isPending) return
    const userMsg: ChatMessage = { role: 'user', content: message, createdAt: new Date().toISOString() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    try {
      const result = await chat.mutateAsync({ message, conversationId })
      // Extract visible reply (strip action blocks)
      let reply = result.reply || result.raw || ''
      reply = reply.replace(/```action[\s\S]*?```/g, '').trim()
      const aiMsg: ChatMessage = { role: 'assistant', content: reply, createdAt: new Date().toISOString() }
      setMessages((m) => [...m, aiMsg])
      // If an action was executed, show the result as a confirmation card
      if (result.actionResult) {
        const actionNote: ChatMessage = {
          role: 'assistant',
          content: `_${result.actionResult.executed ? '✓ ' + result.actionResult.detail : '⚠ ' + result.actionResult.detail}_`,
          createdAt: new Date().toISOString(),
        }
        setMessages((m) => [...m, actionNote])
        if (result.actionResult.executed) {
          // Show undo toast for create_event / resolve_gap actions
          if (result.actionResult.eventId && (result.action?.type === 'create_event' || result.action?.type === 'resolve_gap')) {
            toast.success(result.actionResult.detail, {
              duration: 6000,
              action: {
                label: 'Undo',
                onClick: () => {
                  fetch(`/api/timeline/${result.actionResult!.eventId}`, { method: 'DELETE' })
                    .then(() => toast.success('Event removed'))
                    .catch(() => toast.error('Could not undo'))
                },
              },
            })
          } else {
            toast.success(result.actionResult.detail)
          }
        }
      } else if (result.action && result.action.type !== 'answer') {
        // Fallback for actions that didn't execute
        const actionNote: ChatMessage = {
          role: 'assistant',
          content: `_${formatActionNote(result.action)}_`,
          createdAt: new Date().toISOString(),
        }
        setMessages((m) => [...m, actionNote])
      }
    } catch {
      toast.error('The companion could not respond. Please try again.')
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        await transcribe(blob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const transcribe = async (blob: Blob) => {
    setTranscribing(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const r = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64 }),
        })
        const j = await r.json()
        if (j.text) {
          setInput(j.text)
        } else {
          toast.error('Could not transcribe audio')
        }
        setTranscribing(false)
      }
      reader.readAsDataURL(blob)
    } catch {
      toast.error('Transcription failed')
      setTranscribing(false)
    }
  }

  const newChat = () => {
    setMessages([])
    setConversationId(null)
    setInput('')
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-4xl flex-col gap-4 px-4 py-4 md:h-[calc(100vh-9rem)] md:px-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm">
            <Sparkles className="h-4.5 w-4.5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
          </div>
          <div>
            <div className="text-sm font-semibold">{t('companion.title')}</div>
            <div className="text-xs text-muted-foreground">{t('companion.subtitle')}</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={newChat}>
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> {t('companion.newChat')}
        </Button>
      </div>

      {/* Conversation history pills */}
      {conversations && conversations.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {conversations.slice(0, 8).map((c: { id: string; title: string; updatedAt: string }) => (
            <button
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                conversationId === c.id
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              <MessageSquare className="h-3 w-3" />
              <span className="max-w-[10rem] truncate">{c.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef as never}>
          <div className="space-y-4 p-4">
            {loadingConv ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-3/4 rounded-xl" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <WelcomeScreen onPick={(s) => send(s)} />
            ) : (
              messages.map((m, i) => <MessageBubble key={i} message={m} />)
            )}
            {chat.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bot className="h-4 w-4" />
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" />
                </span>
                {t('companion.thinking')}
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Input */}
      <div className="flex items-end gap-2">
        <Button
          variant="outline"
          size="icon"
          className={cn('h-10 w-10 shrink-0', recording && 'border-rose-500/50 bg-rose-500/10 text-rose-600')}
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing}
          aria-label={recording ? 'Stop recording' : 'Voice input'}
        >
          {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={recording ? t('common.voice.listening') : transcribing ? t('common.voice.transcribing') : t('companion.placeholder')}
          disabled={chat.isPending}
          className="h-10"
        />
        <Button onClick={() => send()} disabled={!input.trim() || chat.isPending} className="h-10 shrink-0 bg-violet-600 hover:bg-violet-700">
          {chat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

function WelcomeScreen({ onPick }: { onPick: (s: string) => void }) {
  const { t, locale } = useTranslation()
  const suggestions = locale === 'ar-EG' ? SUGGESTIONS_AR : SUGGESTIONS_EN
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md">
        <Sparkles className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-base font-semibold">{t('companion.welcome')}</h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          I have access to your recent events and unresolved gaps. I never fabricate — if I don't know, I'll tell you and point to the gap.
        </p>
      </div>
      <div className="grid w-full max-w-md gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left text-xs transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
          >
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            <span className="flex-1">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const isSystemNote = message.content.startsWith('_') && message.content.endsWith('_')
  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', isUser ? 'bg-emerald-500/15 text-emerald-600' : 'bg-violet-500/15 text-violet-600')}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={cn('max-w-[80%] space-y-1', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm',
            isUser
              ? 'bg-emerald-600 text-white'
              : isSystemNote
                ? 'bg-muted italic text-muted-foreground'
                : 'bg-muted text-foreground',
            isUser ? 'rounded-tr-sm' : 'rounded-tl-sm',
          )}
        >
          {isSystemNote ? (
            message.content.slice(1, -1)
          ) : isUser ? (
            message.content
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  code: ({ children }) => <code className="rounded bg-background/50 px-1 py-0.5 text-xs">{children}</code>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className={cn('text-[10px] text-muted-foreground', isUser ? 'text-right' : 'text-left')}>
          {format(new Date(message.createdAt), 'h:mm a')}
        </div>
      </div>
    </div>
  )
}

function formatActionNote(action: { type: string; data?: unknown }): string {
  const d = (action.data ?? {}) as { title?: string; text?: string }
  switch (action.type) {
    case 'create_event':
      return `✓ I created an event "${d.title ?? 'Untitled'}" on your timeline.`
    case 'move_event':
      return `✓ I moved an event on your timeline.`
    case 'create_reminder':
      return `✓ I created a reminder for you.`
    case 'resolve_gap':
      return `✓ I resolved a gap in your timeline.`
    default:
      return '✓ I took an action on your timeline.'
  }
}

void Trash2
