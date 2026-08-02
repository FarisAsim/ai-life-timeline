'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mic, Square, Loader2, Check, X, Sparkles, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCategories, useCreateEvent } from '@/hooks/use-data'

interface VoiceCaptureDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

interface ParsedEvent {
  title: string
  startTime: string
  endTime: string
  categoryName: string | null
  description: string | null
}

export function VoiceCaptureDialog({ open, onOpenChange }: VoiceCaptureDialogProps) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsedEvent, setParsedEvent] = useState<ParsedEvent | null>(null)
  const [detectedLanguage, setDetectedLanguage] = useState<string>('')
  const [editingTitle, setEditingTitle] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const { data: categories } = useCategories()
  const createMut = useCreateEvent()

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        setTranscribing(true)
        const reader = new FileReader()
        reader.onloadend = async () => {
          const dataUrl = reader.result as string
          try {
            const r = await fetch('/api/voice-capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: dataUrl, create: false }),
            })
            const j = await r.json()
            if (j.error) {
              toast.error(j.error)
            } else {
              setTranscript(j.transcript)
              setDetectedLanguage(j.detectedLanguage)
              setParsedEvent(j.event)
              setEditingTitle(j.event.title)
              toast.success('Speech processed — review the event below')
            }
          } catch {
            toast.error('Failed to process audio')
          }
          setTranscribing(false)
        }
        reader.onerror = () => {
          toast.error('Failed to read audio')
          setTranscribing(false)
        }
        reader.readAsDataURL(blob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setTranscript('')
      setParsedEvent(null)
    } catch {
      toast.error('Microphone access denied')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  const confirmCreate = async () => {
    if (!parsedEvent) return
    const cat = parsedEvent.categoryName
      ? categories?.find((c) => c.name.toLowerCase() === parsedEvent.categoryName!.toLowerCase())
      : null
    createMut.mutate(
      {
        title: editingTitle.trim() || parsedEvent.title,
        startTime: parsedEvent.startTime,
        endTime: parsedEvent.endTime,
        categoryId: cat?.id ?? null,
        description: parsedEvent.description ?? undefined,
        source: 'user_manual',
        confidenceScore: 0.9,
      },
      {
        onSuccess: () => {
          toast.success('Event created from voice!')
          onOpenChange(false)
          // Reset
          setTranscript('')
          setParsedEvent(null)
          setEditingTitle('')
        },
        onError: () => toast.error('Failed to create event'),
      },
    )
  }

  const handleCancel = () => {
    onOpenChange(false)
    setTranscript('')
    setParsedEvent(null)
    setEditingTitle('')
    setRecording(false)
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const langLabel = detectedLanguage === 'ar' ? 'Arabic' : detectedLanguage === 'mixed' ? 'Mixed (Ar/En)' : 'English'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-violet-600" />
            Voice capture
          </DialogTitle>
          <DialogDescription>
            Speak naturally — the AI will create an event from your words. Works in English or Egyptian Arabic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recording button */}
          <div className="flex flex-col items-center gap-3">
            {transcribing ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-xs text-muted-foreground">Processing your speech…</p>
              </div>
            ) : recording ? (
              <button
                onClick={stopRecording}
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-transform hover:scale-105"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-500 opacity-40" />
                <Square className="h-7 w-7" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={!!parsedEvent}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-40"
              >
                <Mic className="h-8 w-8" />
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              {recording ? 'Tap to stop' : transcribing ? 'Transcribing…' : 'Tap to speak'}
            </p>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>You said</span>
                <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-600">{langLabel}</span>
              </div>
              <p className="text-sm italic">&ldquo;{transcript}&rdquo;</p>
            </div>
          )}

          {/* Parsed event */}
          <AnimatePresence>
            {parsedEvent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Detected event
                </div>
                <div className="grid gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="vc-title" className="text-[11px]">Title</Label>
                    <Input
                      id="vc-title"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Start</Label>
                      <p className="text-xs font-medium">{formatTime(parsedEvent.startTime)}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">End</Label>
                      <p className="text-xs font-medium">{formatTime(parsedEvent.endTime)}</p>
                    </div>
                  </div>
                  {parsedEvent.categoryName && (
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Category</Label>
                      <p className="text-xs font-medium">{parsedEvent.categoryName}</p>
                    </div>
                  )}
                  {parsedEvent.description && (
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Description</Label>
                      <p className="text-xs">{parsedEvent.description}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {parsedEvent ? (
            <>
              <Button variant="outline" size="sm" onClick={startRecording} className="flex-1">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
              <Button size="sm" onClick={confirmCreate} disabled={createMut.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {createMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                Add event
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleCancel} className="w-full">
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
