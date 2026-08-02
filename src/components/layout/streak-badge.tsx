'use client'

import { useInsights } from '@/hooks/use-data'
import { Flame, Award, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function StreakBadge() {
  const { data: insights } = useInsights(30)

  if (!insights) return null

  const activeDays = insights.dailyTotals.length
  const totalHours = Math.round(insights.totalTrackedMinutes / 60)
  const completeness = insights.completenessPercentage

  // Determine streak level
  const level = completeness >= 85 ? 'gold' : completeness >= 60 ? 'silver' : completeness >= 30 ? 'bronze' : null

  if (!level) return null

  const config = {
    gold: { icon: Award, color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Gold logger', sub: `${completeness}% complete` },
    silver: { icon: TrendingUp, color: 'text-slate-600', bg: 'bg-slate-500/10', label: 'Consistent', sub: `${completeness}% complete` },
    bronze: { icon: Flame, color: 'text-orange-600', bg: 'bg-orange-500/10', label: 'Getting started', sub: `${completeness}% complete` },
  }[level]

  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-2 rounded-lg border ${config.bg} p-2`}
    >
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${config.bg} ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] font-semibold ${config.color}`}>{config.label}</div>
        <div className="text-[10px] text-muted-foreground">
          {activeDays}d · {totalHours}h tracked
        </div>
      </div>
    </motion.div>
  )
}
