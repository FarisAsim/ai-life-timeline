'use client'

import { Card } from '@/components/ui/card'
import { Tag, Hash } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TagBreakdownProps {
  tags: { tag: string; minutes: number; percentage: number; eventCount: number }[]
}

const TAG_COLORS = [
  'bg-teal-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-indigo-500',
]

export function TagBreakdown({ tags }: TagBreakdownProps) {
  if (tags.length === 0) {
    return (
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold">Tag breakdown</h3>
          <span className="text-[11px] text-muted-foreground">— time spent per tag</span>
        </div>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10">
            <Hash className="h-5 w-5 text-teal-500" />
          </div>
          <p className="text-xs text-muted-foreground">
            No tagged events yet. Add tags like <span className="font-mono text-teal-600">#project-x</span> to your events to see time breakdowns by tag.
          </p>
        </div>
      </Card>
    )
  }

  const maxMinutes = tags[0]?.minutes ?? 1

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Tag className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold">Tag breakdown</h3>
        <span className="text-[11px] text-muted-foreground">— time spent per tag (top {tags.length})</span>
      </div>
      <div className="space-y-2">
        {tags.map((t, i) => {
          const hours = (t.minutes / 60).toFixed(1)
          const widthPct = (t.minutes / maxMinutes) * 100
          const color = TAG_COLORS[i % TAG_COLORS.length]
          return (
            <motion.div
              key={t.tag}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="group"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-teal-600">#{t.tag}</span>
                  <span className="text-[10px] text-muted-foreground">{t.eventCount} event{t.eventCount === 1 ? '' : 's'}</span>
                </span>
                <span className="font-semibold">{hours}h</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn('h-full rounded-full', color)}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}
