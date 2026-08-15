'use client'

import { Card } from '@/components/ui/card'
import { Tag, Hash } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

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
  const { t } = useTranslation()
  if (tags.length === 0) {
    return (
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold">{t('insights.tagBreakdown')}</h3>
          <span className="text-[11px] text-muted-foreground">— {t('insights.tagTimeSpent')}</span>
        </div>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10">
            <Hash className="h-5 w-5 text-teal-500" />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('insights.noTags')}
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
        <h3 className="text-sm font-semibold">{t('insights.tagBreakdown')}</h3>
        <span className="text-[11px] text-muted-foreground">— {t('insights.tagTimeSpentTop', { n: tags.length })}</span>
      </div>
      <div className="space-y-2">
        {tags.map((tagItem, i) => {
          const hours = (tagItem.minutes / 60).toFixed(1)
          const widthPct = (tagItem.minutes / maxMinutes) * 100
          const color = TAG_COLORS[i % TAG_COLORS.length]
          return (
            <motion.div
              key={tagItem.tag}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="group"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-teal-600">#{tagItem.tag}</span>
                  <span className="text-[10px] text-muted-foreground">{t('insights.tagEvents', { n: tagItem.eventCount })}</span>
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
