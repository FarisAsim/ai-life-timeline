'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useUploadAttachment } from '@/hooks/use-data'
import { Mic, Square, Loader2, Play, Pause, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface VoiceNoteRecorderProps {
  eventId: string
  onDone?: () => void
}

export function VoiceNoteRecorder({ eventId, onDone }: VoiceNoteRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const uploadMut = useUploadAttachment()

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
        reader.onloadend = () => {
          const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' })
          uploadMut.mutate(
            { eventId, file },
            {
              onSuccess: () => {
                toast.success('Voice note attached')
                setTranscribing(false)
                onDone?.()
              },
              onError: (err) => {
                toast.error(err.message)
                setTranscribing(false)
              },
            },
          )
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
      setDuration(0)
      durationTimerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch {
      toast.error('Microphone access denied')
    }
  }, [eventId, uploadMut, onDone])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
  }, [])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  if (transcribing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
        <span className="text-violet-700 dark:text-violet-300">Saving voice note…</span>
      </div>
    )
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
        </span>
        <span className="font-mono text-xs font-semibold text-rose-700 dark:text-rose-300">{formatDuration(duration)}</span>
        <span className="text-xs text-rose-600 dark:text-rose-400">Recording…</span>
        <Button size="sm" variant="outline" className="ml-auto h-7 border-rose-500/40 text-rose-600" onClick={stopRecording}>
          <Square className="mr-1 h-3 w-3" /> Stop
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 w-full border-violet-500/30 text-violet-700 dark:text-violet-300"
      onClick={startRecording}
    >
      <Mic className="mr-1.5 h-3 w-3" /> Record voice note
    </Button>
  )
}

// Audio player for existing voice note attachments
export function VoiceNotePlayer({ attachmentId, filename, transcript: initialTranscript, onDelete }: { attachmentId: string; filename: string; transcript?: string | null; onDelete?: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(initialTranscript ?? null)
  const [transcribing, setTranscribing] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => toast.error('Could not play audio'))
    }
    setPlaying(!playing)
  }

  const transcribe = async () => {
    setTranscribing(true)
    try {
      const r = await fetch(`/api/attachments/${attachmentId}/transcribe`, { method: 'POST' })
      const j = await r.json()
      if (j.transcript) {
        setTranscript(j.transcript)
        setShowTranscript(true)
        toast.success('Transcript ready')
      } else {
        toast.error(j.error || 'Transcription failed')
      }
    } catch {
      toast.error('Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div className="rounded-md border bg-card p-2">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 hover:bg-violet-500/25"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{filename}</div>
          <div className="text-[10px] text-muted-foreground">Voice note</div>
        </div>
        {transcript && (
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-600 hover:bg-violet-500/10"
            title="Toggle transcript"
          >
            {showTranscript ? 'Hide' : 'Transcript'}
          </button>
        )}
        {!transcript && (
          <button
            onClick={transcribe}
            disabled={transcribing}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-600 hover:bg-violet-500/10 disabled:opacity-50"
            title="Transcribe with AI"
          >
            {transcribing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
            {transcribing ? '…' : 'Transcribe'}
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="text-rose-500 hover:text-rose-700" aria-label="Delete voice note">
            <X className="h-3 w-3" />
          </button>
        )}
        <audio
          ref={audioRef}
          src={`/api/attachments/${attachmentId}`}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      </div>
      {showTranscript && transcript && (
        <div className="mt-2 rounded border-l-2 border-violet-500/30 bg-violet-500/5 px-2 py-1.5 text-xs italic text-foreground/80">
          &ldquo;{transcript}&rdquo;
        </div>
      )}
    </div>
  )
}
