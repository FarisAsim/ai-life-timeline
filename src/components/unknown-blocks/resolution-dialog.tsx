'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAiGuess, useCategories, useConfirmUnknown, useResolveBlock } from '@/hooks/use-data'
import type { UnknownBlock } from '@/lib/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Loader2, Sparkles, Wand2, Check, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function ResolutionDialog({
  block,
  open,
  onOpenChange,
}: {
  block: UnknownBlock | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { locale } = useTranslation()
  const isAr = locale === 'ar-EG'
  const { t } = useTranslation()
  const arBlockDesc = (b: NonNullable<typeof block>) => {
    const d0 = new Date(b.startTime)
    if (isAr) {
      return (
        <>
          حصل إيه بين{' '}
          <span className="font-medium text-foreground">{`${DAYS_AR[d0.getDay()]}، ${b.startTime.slice(8, 10)} ${MONTHS_AR[d0.getMonth()]} ${format(d0, 'h:mm a')}`}</span>{' '}
          و <span className="font-medium text-foreground">{format(new Date(b.endTime), 'h:mm a')}</span> ({b.durationMinutes / 60}س)؟
        </>
      )
    }
    return (
      <>
        What happened between{' '}
        <span className="font-medium text-foreground">{format(d0, 'EEE MMM d, h:mm a')}</span>{' '}
        and <span className="font-medium text-foreground">{format(new Date(b.endTime), 'h:mm a')}</span> ({(b.durationMinutes / 60).toFixed(1)}h)?
      </>
    )
  }
  const formKey = `${open}-${block?.id ?? 'none'}`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
              <HelpCircle className="h-4 w-4" />
            </span>
            {t('resolution.title')}
          </DialogTitle>
          {block && (
            <DialogDescription>
              {arBlockDesc(block)}
            </DialogDescription>
          )}
        </DialogHeader>
        {open && block && (
          <ResolutionBody key={formKey} block={block} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ResolutionBody({ block, onDone }: { block: UnknownBlock; onDone: () => void }) {
  const { data: categories } = useCategories()
  const { t } = useTranslation()
  const aiGuess = useAiGuess()
  const resolveMut = useResolveBlock()
  const confirmUnknownMut = useConfirmUnknown()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [description, setDescription] = useState('')
  const [guess, setGuess] = useState<{ title: string; categoryId: string | null; confidence: number; reasoning: string } | null>(null)
  const [guessing, setGuessing] = useState(false)

  const hours = (block.durationMinutes / 60).toFixed(1)

  const runGuess = async () => {
    setGuessing(true)
    try {
      const result = await aiGuess.mutateAsync(block.id)
      setGuess(result.guess)
      if (result.guess) {
        setTitle(result.guess.title)
        if (result.guess.categoryId) setCategoryId(result.guess.categoryId)
      }
    } catch {
      toast.error(t('resolution.guessFailed'))
    } finally {
      setGuessing(false)
    }
  }

  const applyGuess = () => {
    if (guess) {
      setTitle(guess.title)
      if (guess.categoryId) setCategoryId(guess.categoryId)
      toast.success(t('resolution.guessApplied'))
    }
  }

  const resolve = async () => {
    if (!title.trim()) {
      toast.error(t('resolution.titleRequired'))
      return
    }
    try {
      await resolveMut.mutateAsync({
        blockId: block.id,
        title: title.trim(),
        categoryId: categoryId === 'none' ? null : categoryId,
        description: description.trim() || undefined,
      })
      toast.success(t('resolution.resolved'))
      onDone()
    } catch {
      toast.error(t('resolution.failed'))
    }
  }

  const confirmUnknown = async () => {
    try {
      await confirmUnknownMut.mutateAsync(block.id)
      toast.success(t('resolution.markedUnknown'))
      onDone()
    } catch {
      toast.error(t('resolution.failed'))
    }
  }

  const pending = resolveMut.isPending || confirmUnknownMut.isPending

  return (
    <>
      <div className="space-y-4 py-2">
        {/* AI Guess panel */}
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t('resolution.aiGuess')}
            </div>
            <Button size="sm" variant="outline" className="h-7 border-violet-500/30 text-violet-700 dark:text-violet-300" onClick={runGuess} disabled={guessing}>
              {guessing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
              {guess ? t('resolution.regenerate') : t('resolution.askAi')}
            </Button>
          </div>
          {guess ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{guess.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {t('resolution.confident', { pct: Math.round(guess.confidence * 100) })}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{guess.reasoning}</p>
              <Button size="sm" variant="ghost" className="h-7 w-full" onClick={applyGuess}>
                <Check className="mr-1 h-3 w-3" /> {t('resolution.useGuess')}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('resolution.guessHint')}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="r-title">{t('resolution.whatDidYouDo')}</Label>
          <Input
            id="r-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('resolution.whatDidYouDo.ph')}
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="r-cat">{t('resolution.category')}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="r-cat">
              <SelectValue placeholder={t('resolution.selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('resolution.noCategory')}</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="r-desc">{t('resolution.notes')}</Label>
          <Textarea id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('resolution.notes.ph')} />
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={confirmUnknown} disabled={pending} className="text-muted-foreground">
          {t('resolution.dontRecall')}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone} disabled={pending}>
            {t('resolution.cancel')}
          </Button>
          <Button onClick={resolve} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('unknown.resolve')}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

void cn
