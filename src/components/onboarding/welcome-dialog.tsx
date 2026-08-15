'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSeed } from '@/hooks/use-data'
import { toast } from 'sonner'
import { Sparkles, Hourglass, Clock, Brain, Bell, Search, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

type Step = { icon: typeof Hourglass; color: string }
const STEPS: Step[] = [
  { icon: Hourglass, color: 'text-emerald-600 bg-emerald-500/10' },
  { icon: Clock, color: 'text-amber-600 bg-amber-500/10' },
  { icon: Brain, color: 'text-violet-600 bg-violet-500/10' },
  { icon: Bell, color: 'text-rose-600 bg-rose-500/10' },
  { icon: Search, color: 'text-teal-600 bg-teal-500/10' },
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
  const { t } = useTranslation()
  const stepTitle = t(`welcome.step${step + 1}Title` as never)
  const stepDesc = t(`welcome.step${step + 1}Desc` as never)
  const current = STEPS[step]
  const Icon = current.icon

  const close = () => {
    setOpen(false)
    localStorage.setItem('life-timeline-welcomed', '1')
  }

  const handleSeedAndClose = () => {
    seed.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('welcome.demoLoaded'))
        close()
      },
      onError: () => toast.error(t('welcome.seedFailed')),
    })
  }

  const isLast = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={cn('mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl', current.color)}>
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-lg">{stepTitle}</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {stepDesc}
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
              aria-label={t('welcome.stepN', { n: i + 1 })}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
            {t('welcome.skipTour')}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                {t('welcome.back')}
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={handleSeedAndClose} disabled={seed.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {seed.isPending ? t('common.loading') : t('welcome.loadDemo')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="bg-emerald-600 hover:bg-emerald-700">
                {t('welcome.next')}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {isLast && (
          <p className="text-center text-[10px] text-muted-foreground">
            <Check className="mr-1 inline h-3 w-3 text-emerald-500" />
            {t('welcome.reseedHint')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
