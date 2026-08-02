'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCategories, useCreateEvent } from '@/hooks/use-data'
import { toast } from 'sonner'
import { format, addMinutes } from 'date-fns'
import { Zap, Plus, Briefcase, Dumbbell, Utensils, BookOpen, Moon, Coffee, Users, Heart, Car } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const { data: categories } = useCategories()
  const createMut = useCreateEvent()

  const addFromTemplate = (tpl: Template) => {
    // Default to "now" if today, or noon if a past/future day
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
          toast.success(`${tpl.title} added (${tpl.durationMin}m)`)
          setOpen(false)
        },
        onError: () => toast.error('Failed to add event'),
      },
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          Quick add
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quick add template
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
            Events are added starting now (or noon for other days). Edit after creation for custom times.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
