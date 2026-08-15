'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCategories, useCreateEvent, useInsights, useTemplates } from '@/hooks/use-data'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/use-translation'
import { addMinutes } from 'date-fns'
import { Zap, Plus, Briefcase, Dumbbell, Utensils, BookOpen, Moon, Coffee, Users, Heart, Car, History, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Template {
  title: string
  categoryName: string
  durationMin: number
  icon: typeof Zap
  color: string
}

const TEMPLATES: Template[] = [
  { title: 'Gym Session', categoryName: 'Exercise', durationMin: 60, icon: Dumbbell, color: 'text-orange-600' },
  { title: 'Quick Meeting', categoryName: 'Work', durationMin: 30, icon: Briefcase, color: 'text-emerald-600' },
  { title: 'Lunch', categoryName: 'Meals', durationMin: 45, icon: Utensils, color: 'text-yellow-600' },
  { title: 'Coffee Break', categoryName: 'Personal', durationMin: 15, icon: Coffee, color: 'text-amber-600' },
  { title: 'Study Session', categoryName: 'Study', durationMin: 60, icon: BookOpen, color: 'text-violet-600' },
  { title: 'Nap', categoryName: 'Sleep', durationMin: 30, icon: Moon, color: 'text-indigo-600' },
  { title: 'Social Visit', categoryName: 'Social', durationMin: 90, icon: Users, color: 'text-rose-600' },
  { title: 'Commute', categoryName: 'Commute', durationMin: 45, icon: Car, color: 'text-cyan-600' },
  { title: 'Personal Time', categoryName: 'Personal', durationMin: 30, icon: Heart, color: 'text-teal-600' },
]

export function QuickAddButton({ date }: { date: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { data: categories } = useCategories()
  const { data: insights } = useInsights(30)
  const { data: customTemplates } = useTemplates()
  const createMut = useCreateEvent()

  // Derive frequent-event templates from the user's actual history
  const frequentTemplates = useMemo(() => {
    if (!insights || !categories) return []
    // Group events by title to find frequency; we need raw events but insights only has aggregates.
    // Instead, use the category breakdown + habit model to suggest templates.
    // For a simpler approach: use topHabits to suggest time-based templates.
    const habits = insights.topHabits ?? []
    const catMap = new Map(categories.map((c) => [c.id, c]))
    return habits
      .filter((h) => h.categoryId)
      .slice(0, 3)
      .map((h) => {
        const cat = catMap.get(h.categoryId!)
        return {
          title: h.eventName || cat?.name || 'Activity',
          categoryName: cat?.name ?? 'Personal',
          durationMin: 60, // default
          icon: History,
          color: 'text-violet-600',
        }
      })
  }, [insights, categories])

  const addFromTemplate = (tpl: Template) => {
    const dayDate = new Date(date + 'T00:00:00')
    const now = new Date()
    const isToday = dayDate.toDateString() === now.toDateString()
    const start = isToday ? new Date(now) : new Date(dayDate.setHours(12, 0, 0, 0))
    const end = addMinutes(start, tpl.durationMin)
    const cat = categories?.find((c) => c.name === tpl.categoryName)
    createMut.mutate(
      {
        title: tpl.title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        categoryId: cat?.id ?? null,
        source: 'user_manual',
        confidenceScore: 1.0,
      },
      {
        onSuccess: () => {
          toast.success(t('quickAdd.added', { title: tpl.title, min: String(tpl.durationMin) }))
          setOpen(false)
        },
        onError: () => toast.error(t('quickAdd.addFailed')),
      },
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          {t('quickAdd.button')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        {/* Frequent events from user history */}
        {frequentTemplates.length > 0 && (
          <>
            <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
              <History className="h-3 w-3" />
              {t('quickAdd.yourFrequent')}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {frequentTemplates.map((tpl, i) => {
                const Icon = tpl.icon
                return (
                  <button
                    key={`freq-${i}`}
                    onClick={() => addFromTemplate(tpl)}
                    disabled={createMut.isPending}
                    className="group flex items-center gap-2.5 rounded-md bg-violet-500/5 px-2 py-1.5 text-left text-xs transition-colors hover:bg-violet-500/10 disabled:opacity-50"
                  >
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', tpl.color)} />
                    <span className="flex-1 font-medium">{tpl.title}</span>
                    <span className="text-[9px] text-violet-500">AI</span>
                  </button>
                )
              })}
            </div>
            <div className="my-1.5 border-t" />
          </>
        )}

        {/* Custom saved templates */}
        {customTemplates && customTemplates.length > 0 && (
          <>
            <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              <Star className="h-3 w-3" />
              {t('quickAdd.savedTemplates')}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {customTemplates.map((tpl: { id: string; title: string; categoryId: string | null; category: { name: string; color: string } | null; durationMin: number }) => (
                <button
                  key={tpl.id}
                  onClick={() => addFromTemplate({ title: tpl.title, categoryName: tpl.category?.name ?? 'Personal', durationMin: tpl.durationMin, icon: Star, color: 'text-amber-600' })}
                  disabled={createMut.isPending}
                  className="group flex items-center gap-2.5 rounded-md bg-amber-500/5 px-2 py-1.5 text-left text-xs transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <Star className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="flex-1 font-medium">{tpl.title}</span>
                  <span className="text-[10px] text-muted-foreground">{tpl.durationMin}m</span>
                </button>
              ))}
            </div>
            <div className="my-1.5 border-t" />
          </>
        )}

        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('quickAdd.templates')}
        </div>
        <div className="grid grid-cols-1 gap-0.5">
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon
            return (
              <button
                key={tpl.title}
                onClick={() => addFromTemplate(tpl)}
                disabled={createMut.isPending}
                className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', tpl.color)} />
                <span className="flex-1 font-medium">{tpl.title}</span>
                <span className="text-[10px] text-muted-foreground">{tpl.durationMin}m</span>
                <Plus className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )
          })}
        </div>
        <div className="mt-1.5 border-t pt-1.5">
          <p className="px-2 text-[10px] text-muted-foreground">
            {t('quickAdd.hint')}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
