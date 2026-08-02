'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSeed } from '@/hooks/use-data'
import { toast } from 'sonner'
import { Sparkles, Hourglass, Clock, Brain, Bell, Search, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Hourglass,
    title: 'Never lose a moment',
    description: 'AI Life Timeline records your day hour-by-hour. When it detects unexplained time, it asks what happened — so your timeline approaches 100% completeness.',
    color: 'text-emerald-600 bg-emerald-500/10',
  },
  {
    icon: Clock,
    title: 'Three ways to fill gaps',
    description: 'Resolve Unknown Blocks by typing what you did, asking the AI to guess based on your patterns, or marking it as a genuine "don\'t recall." Every answer trains the AI.',
    color: 'text-amber-600 bg-amber-500/10',
  },
  {
    icon: Brain,
    title: 'The AI gets smarter',
    description: 'The companion learns your habits — gym at 6am, prayers, deep work mornings. Over time, its guesses get better and filling gaps takes one tap.',
    color: 'text-violet-600 bg-violet-500/10',
  },
  {
    icon: Bell,
    title: 'Conversational nudges',
    description: 'Notifications feel like a friend, not an alarm. "Looks like you finished work — should I start Study Mode?" Every nudge maps to a concrete action.',
    color: 'text-rose-600 bg-rose-500/10',
  },
  {
    icon: Search,
    title: 'Semantic search',
    description: 'Ask "When did I last exercise?" or "Show my study sessions" — the AI understands meaning, not just keywords, and ranks results by relevance.',
    color: 'text-teal-600 bg-teal-500/10',
  },
]

export function WelcomeDialog({ hasData }: { hasData: boolean }) {
  // Initialize open state once: show if no data and not previously welcomed.
  // We read localStorage during initial state to avoid setState-in-effect.
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    if (hasData) return false
    return !localStorage.getItem('life-timeline-welcomed')
  })
  const [step, setStep] = useState(0)
  const seed = useSeed()

  const close = () => {
    setOpen(false)
    localStorage.setItem('life-timeline-welcomed', '1')
  }

  const handleSeedAndClose = () => {
    seed.mutate(undefined, {
      onSuccess: () => {
        toast.success('Demo data loaded — explore your timeline!')
        close()
      },
      onError: () => toast.error('Failed to seed data'),
    })
  }

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const Icon = current.icon

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={cn('mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl', current.color)}>
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-lg">{current.title}</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-emerald-500' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
            Skip tour
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={handleSeedAndClose} disabled={seed.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {seed.isPending ? 'Loading…' : 'Load demo data'}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="bg-emerald-600 hover:bg-emerald-700">
                Next
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {isLast && (
          <p className="text-center text-[10px] text-muted-foreground">
            <Check className="mr-1 inline h-3 w-3 text-emerald-500" />
            You can re-seed anytime from Settings
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
