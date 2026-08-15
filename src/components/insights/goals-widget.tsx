'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useGoals, useCreateGoal, useDeleteGoal, useCategories } from '@/hooks/use-data'
import { toast } from 'sonner'
import { Target, Plus, Trash2, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CategoryDot } from '@/components/category-icon'
import { useTranslation } from '@/hooks/use-translation'

export function GoalsWidget() {
  const { t, locale } = useTranslation()
  const isAr = locale === 'ar-EG'
  const { data: goals, isLoading } = useGoals()
  const { data: categories } = useCategories()
  const createMut = useCreateGoal()
  const deleteMut = useDeleteGoal()
  const [open, setOpen] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'category_hours' | 'event_count' | 'completion_pct' | 'tag_hours'>('category_hours')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [tag, setTag] = useState('')
  const [targetValue, setTargetValue] = useState('10')
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error(t('goals.titleRequired'))
      return
    }
    createMut.mutate(
      {
        title: title.trim(),
        type,
        categoryId: type === 'category_hours' ? (categoryId === 'none' ? null : categoryId) : null,
        tag: type === 'tag_hours' ? tag.trim() || null : null,
        targetValue: Number(targetValue) || 1,
        period,
      },
      {
        onSuccess: () => {
          toast.success(t('goals.created'))
          setTitle('')
          setTag('')
          setOpen(false)
        },
        onError: () => toast.error(t('goals.createFailed')),
      },
    )
  }

  const typeLabels: Record<string, string> = isAr ? {
    category_hours: 'ساعات من',
    event_count: 'أحداث',
    completion_pct: '% إكمال',
    tag_hours: 'ساعات على وسم',
  } : {
    category_hours: 'hours of',
    event_count: 'events',
    completion_pct: '% completion',
    tag_hours: 'hours on tag',
  }

  if (isLoading) {
    return <Card className="p-5"><div className="animate-pulse text-xs text-muted-foreground">{t('goals.loading')}</div></Card>
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">{t('goals.title')}</h3>
          <span className="text-[11px] text-muted-foreground">— {t('goals.sub')}</span>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7">
              <Plus className={isAr ? 'ml-1 h-3 w-3' : 'mr-1 h-3 w-3'} /> {t('goals.new')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('goals.createGoal')}
            </div>
            <div className="space-y-2">
              <div className="grid gap-1">
                <Label htmlFor="goal-title" className="text-[11px]">{t('settings.title')}</Label>
                <Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('goals.titlePlaceholder')} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-[11px]">{t('goals.type')}</Label>
                  <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category_hours">{t('goals.catHours')}</SelectItem>
                      <SelectItem value="event_count">{t('goals.eventCount')}</SelectItem>
                      <SelectItem value="completion_pct">{t('goals.completionPct')}</SelectItem>
                      <SelectItem value="tag_hours">{t('goals.tagHours')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[11px]">{t('goals.period')}</Label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">{t('goals.weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('goals.monthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {type === 'category_hours' && (
                <div className="grid gap-1">
                  <Label className="text-[11px]">{t('settings.templateCategory')}</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('goals.anyCategory')}</SelectItem>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === 'tag_hours' && (
                <div className="grid gap-1">
                  <Label htmlFor="goal-tag" className="text-[11px]">{t('goals.tagLabel')}</Label>
                  <Input
                    id="goal-tag"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder={t('goals.tagPlaceholder')}
                    className="h-8 text-sm"
                  />
                </div>
              )}
              {type !== 'completion_pct' && (
                <div className="grid gap-1">
                  <Label htmlFor="goal-target" className="text-[11px]">Target ({typeLabels[type]})</Label>
                  <Input id="goal-target" type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="h-8 text-sm" min="1" />
                </div>
              )}
              <Button size="sm" onClick={handleCreate} disabled={createMut.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t('goals.createGoal')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!goals || goals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <Target className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('goals.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal, i) => {
            const pct = Math.round(goal.progress * 100)
            const achieved = pct >= 100
            const barColor = achieved ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-400'
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className="group rounded-lg border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {achieved ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-xs font-semibold">{goal.title}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {goal.category && <CategoryDot color={goal.category.color} />}
                      {goal.tag && <span className="text-teal-600">#{goal.tag}</span>}
                      <span>{goal.period}</span>
                      <span>·</span>
                      <span>{goal.currentValue.toFixed(1)} / {goal.targetValue} {typeLabels[goal.type]}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMut.mutate(goal.id, { onSuccess: () => toast.success(t('goals.deleted')) })}
                    className="text-rose-400 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                    aria-label={t('goals.delete')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn('h-full rounded-full', barColor)}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className={cn('text-[10px] font-bold', achieved ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-500')}>
                    {pct}%
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
