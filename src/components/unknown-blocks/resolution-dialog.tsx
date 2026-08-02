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

export function ResolutionDialog({
  block,
  open,
  onOpenChange,
}: {
  block: UnknownBlock | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const formKey = `${open}-${block?.id ?? 'none'}`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
              <HelpCircle className="h-4 w-4" />
            </span>
            Fill the gap
          </DialogTitle>
          {block && (
            <DialogDescription>
              What happened between{' '}
              <span className="font-medium text-foreground">{format(new Date(block.startTime), 'EEE MMM d, h:mm a')}</span>{' '}
              and <span className="font-medium text-foreground">{format(new Date(block.endTime), 'h:mm a')}</span> ({(block.durationMinutes / 60).toFixed(1)}h)?
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
      toast.error('AI guess failed')
    } finally {
      setGuessing(false)
    }
  }

  const applyGuess = () => {
    if (guess) {
      setTitle(guess.title)
      if (guess.categoryId) setCategoryId(guess.categoryId)
      toast.success('AI guess applied — review and confirm')
    }
  }

  const resolve = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }
    try {
      await resolveMut.mutateAsync({
        blockId: block.id,
        title: title.trim(),
        categoryId: categoryId === 'none' ? null : categoryId,
        description: description.trim() || undefined,
      })
      toast.success('Gap resolved — timeline updated')
      onDone()
    } catch {
      toast.error('Failed to resolve')
    }
  }

  const confirmUnknown = async () => {
    try {
      await confirmUnknownMut.mutateAsync(block.id)
      toast.success("Marked as unknown — I'll stop asking about this time")
      onDone()
    } catch {
      toast.error('Failed')
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
              AI Guess
            </div>
            <Button size="sm" variant="outline" className="h-7 border-violet-500/30 text-violet-700 dark:text-violet-300" onClick={runGuess} disabled={guessing}>
              {guessing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
              {guess ? 'Regenerate' : 'Ask AI'}
            </Button>
          </div>
          {guess ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{guess.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {Math.round(guess.confidence * 100)}% confident
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{guess.reasoning}</p>
              <Button size="sm" variant="ghost" className="h-7 w-full" onClick={applyGuess}>
                <Check className="mr-1 h-3 w-3" /> Use this guess
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Let the AI analyze your recent patterns and propose what you were likely doing.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="r-title">What did you do?</Label>
          <Input
            id="r-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Met with the design team"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="r-cat">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="r-cat">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="r-desc">Notes (optional)</Label>
          <Textarea id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Any details about this time" />
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={confirmUnknown} disabled={pending} className="text-muted-foreground">
          I genuinely don't recall
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={resolve} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Resolve
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

void cn
