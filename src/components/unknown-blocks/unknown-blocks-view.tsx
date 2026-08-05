'use client'

import { useState } from 'react'
import { useUnknownBlocks } from '@/hooks/use-data'
import { ResolutionDialog } from './resolution-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { Hourglass, Sparkles, AlertTriangle, CheckCircle2, HelpCircle, Clock } from 'lucide-react'
import type { UnknownBlock } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

export function UnknownBlocksView() {
  const [tab, setTab] = useState<'open' | 'all'>('open')
  const { data: openBlocks, isLoading: openLoading } = useUnknownBlocks(false)
  const { data: allBlocks, isLoading: allLoading } = useUnknownBlocks(true)
  const [resolving, setResolving] = useState<UnknownBlock | null>(null)
  const { locale } = useTranslation()
  const isAr = locale === 'ar-EG'
  const tr = (en: string, ar: string) => isAr ? ar : en

  const blocks = tab === 'open' ? openBlocks : allBlocks
  const loading = tab === 'open' ? openLoading : allLoading

  const openCount = openBlocks?.length ?? 0
  const highCount = (openBlocks ?? []).filter((b) => b.severity === 'high').length
  const totalGapHours = (openBlocks ?? []).reduce((s, b) => s + b.durationMinutes, 0) / 60

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 md:px-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={tr('Open gaps', 'فجوات مفتوحة')} value={openCount} icon={Hourglass} tone="amber" />
        <StatCard label={tr('High severity', 'خطيرة')} value={highCount} icon={AlertTriangle} tone="rose" />
        <StatCard label={tr('Untracked', 'غير متتبع')} value={`${totalGapHours.toFixed(1)}${isAr ? 'س' : 'h'}`} icon={Clock} tone="orange" />
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
            <Hourglass className="h-4.5 w-4.5 text-amber-600" />
          </div>
          <div className="text-sm">
            <div className="font-semibold">{tr('The engine that protects "never lose a moment"', 'المحرك اللي بيحمي "ماتفوّتش لحظة"')}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tr('Every gap over 15 minutes becomes an Unknown Block. Resolve each one through text, AI Guess, or mark as unknown. Your answers train the AI.', 'كل فجوة فوق 15 دقيقة بتبقى Unknown Block. حل كل واحدة بالنص أو تخمين الذكاء الاصطناعي أو علمها كأنك مش فاكر. إجاباتك بتمرن الذكاء الاصطناعي.')}
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'all')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="open">{tr('Open', 'مفتوحة')} ({openCount})</TabsTrigger>
          <TabsTrigger value="all">{tr('History', 'السجل')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !blocks || blocks.length === 0 ? (
        <Card className="border-dashed py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{tab === 'open' ? tr('No open gaps', 'مفيش فجوات مفتوحة') : tr('No history yet', 'مفيش سجل لسه')}</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {tab === 'open'
                  ? tr('Your timeline is fully accounted for.', 'خطك الزمني متسجل بالكامل.')
                  : tr('Resolved blocks will appear here.', 'الفجوات المحلولة هتظهر هنا.')}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} onResolve={() => setResolving(b)} />
          ))}
        </div>
      )}

      <ResolutionDialog block={resolving} open={!!resolving} onOpenChange={(v) => !v && setResolving(null)} />
    </div>
  )
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: typeof Hourglass; tone: 'amber' | 'rose' | 'orange' }) {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-600',
    rose: 'bg-rose-500/10 text-rose-600',
    orange: 'bg-orange-500/10 text-orange-600',
  }
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold leading-none">{value}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  )
}

function BlockRow({ block, onResolve }: { block: UnknownBlock; onResolve: () => void }) {
  const hours = (block.durationMinutes / 60).toFixed(1)
  const sevConfig = {
    low: { color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Low' },
    medium: { color: 'text-orange-600', bg: 'bg-orange-500/10', label: 'Medium' },
    high: { color: 'text-rose-600', bg: 'bg-rose-500/10', label: 'High' },
  }[block.severity]

  const statusConfig = {
    open: { label: 'Open', tone: 'amber' as const, icon: Hourglass },
    resolved: { label: 'Resolved', tone: 'emerald' as const, icon: CheckCircle2 },
    ai_guessed_pending_confirmation: { label: 'AI Guess pending', tone: 'violet' as const, icon: Sparkles },
    unknown_confirmed: { label: "Don't recall", tone: 'slate' as const, icon: HelpCircle },
  }[block.status]
  const StatusIcon = statusConfig.icon
  const isResolved = block.status !== 'open' && block.status !== 'ai_guessed_pending_confirmation'

  return (
    <Card className="group p-0">
      <div className="flex items-center gap-3 p-3 pl-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', sevConfig.bg)}>
          <Hourglass className={cn('h-4.5 w-4.5', sevConfig.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {format(new Date(block.startTime), 'EEE, MMM d')}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(block.startTime), 'h:mm a')} – {format(new Date(block.endTime), 'h:mm a')}
            </span>
            <Badge variant="outline" className={cn('gap-1 text-[10px]', sevConfig.bg, sevConfig.color, 'border-current/20')}>
              {sevConfig.label} · {hours}h
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <StatusIcon className="h-2.5 w-2.5" />
              {statusConfig.label}
            </Badge>
          </div>
          {block.resolvedEvent && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              → Resolved as <span className="font-medium text-foreground">{block.resolvedEvent.title}</span>
            </p>
          )}
          {block.status === 'unknown_confirmed' && (
            <p className="mt-1 text-xs italic text-muted-foreground">You confirmed you don't recall this time.</p>
          )}
        </div>
        {!isResolved && (
          <Button size="sm" variant="outline" className="border-amber-500/40 hover:bg-amber-500/10" onClick={onResolve}>
            <Sparkles className="mr-1 h-3 w-3" /> Resolve
          </Button>
        )}
      </div>
    </Card>
  )
}
