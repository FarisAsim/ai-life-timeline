'use client'

import { useState } from 'react'
import { useInsights } from '@/hooks/use-data'
import { Card } from '@/components/ui/card'
import { GoalsWidget } from './goals-widget'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { CategoryBadge, CategoryDot } from '@/components/category-icon'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { TrendingUp, Clock, Target, Sparkles, PieChart as PieIcon, BarChart3, CalendarRange } from 'lucide-react'
import type { InsightData } from '@/lib/types'
import { CATEGORY_COLOR_MAP } from '@/lib/types'

const CATEGORY_HEX: Record<string, string> = {
  emerald: '#10b981',
  violet: '#8b5cf6',
  orange: '#f97316',
  indigo: '#6366f1',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  yellow: '#eab308',
  cyan: '#06b6d4',
  teal: '#14b8a6',
}

export function InsightsView() {
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const { data, isLoading } = useInsights(range)

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 md:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 md:px-6">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Your timeline insights</h2>
          <p className="text-xs text-muted-foreground">Patterns derived from {Math.round(data.totalTrackedMinutes / 60)}h of tracked time</p>
        </div>
        <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as 7 | 30 | 90)}>
          <TabsList>
            <TabsTrigger value="7">7d</TabsTrigger>
            <TabsTrigger value="30">30d</TabsTrigger>
            <TabsTrigger value="90">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Top metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Completeness"
          value={`${data.completenessPercentage}%`}
          subtitle="of waking hours"
          icon={Target}
          tone="emerald"
        />
        <MetricCard
          label="Tracked time"
          value={`${Math.round(data.totalTrackedMinutes / 60)}h`}
          subtitle={`over ${range} days`}
          icon={Clock}
          tone="violet"
        />
        <MetricCard
          label="Top category"
          value={data.categoryBreakdown[0]?.category?.name ?? '—'}
          subtitle={data.categoryBreakdown[0] ? `${Math.round(data.categoryBreakdown[0].percentage * 100)}% of time` : 'no data'}
          icon={PieIcon}
          tone="orange"
        />
        <MetricCard
          label="Active days"
          value={String(data.dailyTotals.length)}
          subtitle={`of ${range} days`}
          icon={CalendarRange}
          tone="teal"
        />
      </div>

      {/* Weekly summary card */}
      <Card className="border-0 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent">
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">AI summary</div>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">{data.weeklySummary}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category breakdown */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Time by category</h3>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown.filter((c) => c.minutes > 0)}
                    dataKey="minutes"
                    nameKey={(c: { category: { name: string } | null }) => c.category?.name ?? 'Uncategorized'}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.categoryBreakdown.filter((c) => c.minutes > 0).map((c, i) => (
                      <Cell key={i} fill={c.category ? CATEGORY_HEX[c.category.color] ?? '#64748b' : '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [`${(v / 60).toFixed(1)}h`, 'Time']}
                    contentStyle={{ borderRadius: '0.5rem', fontSize: '12px', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {data.categoryBreakdown.slice(0, 7).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {c.category ? <CategoryDot color={c.category.color} /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />}
                  <span className="flex-1 truncate">{c.category?.name ?? 'Uncategorized'}</span>
                  <span className="font-medium">{(c.minutes / 60).toFixed(1)}h</span>
                  <span className="w-9 text-right text-muted-foreground">{Math.round(c.percentage * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Productive hours */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            <h3 className="text-sm font-semibold">Productivity by hour</h3>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.productiveHours.filter((h) => h.minutes > 0)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: number) => `${h}:00`}
                  tick={{ fontSize: 10 }}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 60)}h`} />
                <Tooltip
                  formatter={(v: number, n: string) => [`${(Number(v) / 60).toFixed(1)}h`, n === 'score' ? 'Productive' : 'Total']}
                  labelFormatter={(h: number) => `${h}:00`}
                  contentStyle={{ borderRadius: '0.5rem', fontSize: '12px' }}
                />
                <Bar dataKey="minutes" name="Total" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="score" name="Productive" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Orange = productive categories (Work, Study, Exercise, Prayer, Personal). Bars show your most active hours.
          </p>
        </Card>
      </div>

      {/* Daily totals trend */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold">Daily tracked time</h3>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailyTotals.map((d) => ({ ...d, hours: d.minutes / 60 }))}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(new Date(d + 'T00:00:00'), 'MMM d')}
                tick={{ fontSize: 10 }}
                interval={Math.max(0, Math.floor(data.dailyTotals.length / 8))}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}h`} />
              <Tooltip
                formatter={(v: number) => [`${Number(v).toFixed(1)}h`, 'Tracked']}
                labelFormatter={(d: string) => format(new Date(d + 'T00:00:00'), 'EEE, MMM d')}
                contentStyle={{ borderRadius: '0.5rem', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="hours" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3, fill: '#14b8a6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Goals */}
      <GoalsWidget />

      {/* Learned habits */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold">Learned habits</h3>
          <span className="text-[11px] text-muted-foreground">— your habit model, trained from confirmed events</span>
        </div>
        {data.topHabits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              No habits learned yet. Resolve a few Unknown Blocks and the AI will start recognizing your patterns.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.topHabits.map((h, i) => {
              const confPct = Math.round(h.confidence * 100)
              const confColor = confPct >= 70 ? 'bg-emerald-500' : confPct >= 40 ? 'bg-amber-500' : 'bg-slate-400'
              const label = h.patternKey.replace(/_/g, ' ')
              const isTime = ['morning', 'afternoon', 'evening', 'night'].includes(h.patternKey)
              const icon = isTime ? '🕐' : ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].includes(h.patternKey) ? '📅' : '✨'
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-lg">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold capitalize">{label}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{h.frequency}× seen</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${confColor} transition-all`} style={{ width: `${confPct}%` }} />
                      </div>
                      <span className={`text-[10px] font-semibold ${confPct >= 70 ? 'text-emerald-600' : confPct >= 40 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {confPct}%
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            <p className="pt-1 text-center text-[10px] text-muted-foreground">
              Higher confidence = the AI is more likely to suggest this pattern when filling future gaps.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

function MetricCard({
  label, value, subtitle, icon: Icon, tone,
}: {
  label: string
  value: string
  subtitle: string
  icon: typeof Clock
  tone: 'emerald' | 'violet' | 'orange' | 'teal'
}) {
  const tones = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    violet: 'bg-violet-500/10 text-violet-600',
    orange: 'bg-orange-500/10 text-orange-600',
    teal: 'bg-teal-500/10 text-teal-600',
  }
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground">{subtitle}</div>
    </Card>
  )
}
