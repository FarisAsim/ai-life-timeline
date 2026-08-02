'use client'

import { Card } from '@/components/ui/card'
import { Flame, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StreakWidgetProps {
  streakDays: number
}

export function StreakWidget({ streakDays }: StreakWidgetProps) {
  const isHot = streakDays >= 7
  const isWarm = streakDays >= 3 && streakDays < 7

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        'overflow-hidden p-0',
        isHot && 'border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent',
        isWarm && 'border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent',
      )}>
        <div className="flex items-center gap-3 p-4">
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            isHot ? 'bg-orange-500/15 text-orange-600' : isWarm ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground',
          )}>
            {isHot ? <Flame className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{streakDays}</span>
              <span className="text-xs text-muted-foreground">day streak</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {streakDays === 0 && "Log an event today to start your streak!"}
              {streakDays === 1 && "Great start — keep it going tomorrow!"}
              {streakDays >= 2 && streakDays < 7 && `${streakDays} days of consistent logging. Keep it up!`}
              {streakDays >= 7 && `${streakDays} days! You're on fire! 🔥`}
            </p>
          </div>
          {isHot && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-2xl"
            >
              🔥
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
