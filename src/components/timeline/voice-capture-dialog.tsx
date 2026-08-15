'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mic, Square, Loader2, Check, X, Sparkles, RefreshCw, Type, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCategories, useCreateEvent } from '@/hooks/use-data'
import { useTranslation } from '@/hooks/use-translation'

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
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsedEvent, setParsedEvent] = useState<ParsedEvent | null>(null)
  const [detectedLanguage, setDetectedLanguage] = useState<string>('')
  const [textInput, setTextInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const { data: categories } = useCategories()
  const createMut = useCreateEvent()
  const { t, locale } = useTranslation()
  const isAr = locale === 'ar-EG'

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        // Inline the audio processing to avoid forward reference
        setTranscribing(true)
        setError(null)
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
              if (j.fallback) { setError(j.error); setMode('text') }
              else { setError(j.error) }
            } else {
              setTranscript(j.transcript)
              setDetectedLanguage(j.detectedLanguage)
              setParsedEvent(j.event)
              setEditingTitle(j.event.title)
              toast.success(t('voice.capture.processed'))
            }
          } catch {
            setError(t('companion.networkErrorType'))
            setMode('text')
          }
          setTranscribing(false)
        }
        reader.onerror = () => { setError(t('voice.capture.readFailed')); setTranscribing(false) }
        reader.readAsDataURL(blob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setTranscript('')
      setParsedEvent(null)
    } catch {
      setError(t('voice.capture.micDenied'))
      setMode('text')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  const processText = async () => {
    const text = textInput.trim()
    if (!text) {
      setError(t('voice.capture.typeFirst'))
      return
    }
    setTranscribing(true)
    setError(null)
    try {
      const r = await fetch('/api/voice-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, create: false }),
      })
      const j = await r.json()
      if (j.error) {
        setError(j.error)
      } else {
        setTranscript(text)
        setDetectedLanguage(j.detectedLanguage)
        setParsedEvent(j.event)
        setEditingTitle(j.event.title)
        toast.success(t('voice.capture.processed'))
      }
    } catch {
      setError(t('companion.networkError'))
    }
    setTranscribing(false)
  }

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
          toast.success(t('voice.capture.eventCreated'))
          handleClose()
        },
        onError: () => toast.error(t('timeline.createFailed')),
      },
    )
  }

  const handleClose = () => {
    onOpenChange(false)
    setTranscript('')
    setParsedEvent(null)
    setEditingTitle('')
    setTextInput('')
    setError(null)
    setRecording(false)
    setMode('voice')
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  const langLabel = detectedLanguage === 'ar' ? '🇪🇬 Arabic' : detectedLanguage === 'mixed' ? '🔀 Mixed' : '🇬🇧 English'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="glass-card overflow-hidden border-0 p-0 sm:max-w-md">
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-5 text-white">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <Sparkles className="h-5 w-5" />
              Voice Capture
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Speak or type — AI will create an event for you
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-5">
          {/* Mode toggle */}
          {!parsedEvent && !transcribing && (
            <div className="flex gap-2 rounded-xl bg-muted/50 p-1">
              <button
                onClick={() => setMode('voice')}
                className={cn(
                  'flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all',
                  mode === 'voice' ? 'bg-white text-emerald-600 shadow-sm dark:bg-card' : 'text-muted-foreground'
                )}
              >
                <Mic className="h-4 w-4" /> Voice
              </button>
              <button
                onClick={() => setMode('text')}
                className={cn(
                  'flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all',
                  mode === 'text' ? 'bg-white text-emerald-600 shadow-sm dark:bg-card' : 'text-muted-foreground'
                )}
              >
                <Type className="h-4 w-4" /> Type
              </button>
            </div>
          )}

          {/* Voice mode */}
          {mode === 'voice' && !parsedEvent && (
            <div className="flex flex-col items-center gap-3 py-4">
              {transcribing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative h-20 w-20">
                    <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Processing your speech…</p>
                </div>
              ) : recording ? (
                <button
                  onClick={stopRecording}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-xl transition-transform active:scale-95"
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />
                  <Square className="relative h-7 w-7 fill-white" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  <span className="absolute inset-0 rounded-full bg-emerald-500/20 transition-all group-hover:scale-110" />
                  <Mic className="relative h-8 w-8" />
                </button>
              )}
              <p className="text-sm text-muted-foreground">
                {recording ? t('voice.capture.recordingLive') : transcribing ? t('voice.capture.processing') : t('voice.capture.tapToSpeak')}
              </p>
            </div>
          )}

          {/* Text mode */}
          {mode === 'text' && !parsedEvent && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label className="text-sm">{t('voice.capture.whatDidYouDo')}</Label>
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={t('voice.capture.placeholder')}
                  className="h-12"
                  onKeyDown={(e) => e.key === 'Enter' && processText()}
                />
              </div>
              <Button onClick={processText} disabled={!textInput.trim() || transcribing} className="h-11 w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                {transcribing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {t('voice.capture.parseAi')}
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Transcript */}
          {transcript && (
            <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{t('voice.capture.youSaid')}</span>
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-600">{langLabel}</span>
              </div>
              <p className="text-sm italic">"{transcript}"</p>
            </div>
          )}

          {/* Parsed event */}
          <AnimatePresence>
            {parsedEvent && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  {t('voice.capture.detectedEvent')}
                </div>
                <div className="grid gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">{t('event.title')}</Label>
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">{t('event.start')}</div>
                      <div className="text-sm font-medium">{formatTime(parsedEvent.startTime)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">{t('event.end')}</div>
                      <div className="text-sm font-medium">{formatTime(parsedEvent.endTime)}</div>
                    </div>
                  </div>
                  {parsedEvent.categoryName && (
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-xs text-muted-foreground">{t('settings.templateCategory')}</div>
                      <div className="text-sm font-medium">{parsedEvent.categoryName}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 p-3">
          <div className="flex gap-2">
            {parsedEvent ? (
              <>
                <Button variant="outline" className="h-11 flex-1" onClick={() => { setParsedEvent(null); setTranscript(''); setTextInput(''); }}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('voice.capture.tryAgain')}
                </Button>
                <Button className="h-11 flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={confirmCreate} disabled={createMut.isPending}>
                  {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {t('voice.capture.confirm')}
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="h-11 w-full" onClick={handleClose}>
                {t('event.cancel')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
