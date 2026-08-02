'use client'

import { useState, useEffect } from 'react'
import { useSearch } from '@/hooks/use-data'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-icon'
import { useAppStore } from '@/stores/app-store'
import { format } from 'date-fns'
import { Search, Sparkles, Clock, MapPin, ArrowRight, X } from 'lucide-react'
import { formatTimeRange } from '@/components/timeline/event-form-dialog'

const EXAMPLE_QUERIES = [
  'When did I last exercise?',
  'Show me my study sessions',
  'What did I do last weekend?',
  'Time spent with friends',
  'My morning routine',
]

export function SearchView() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const setSelectedDate = useAppStore((s) => s.setSelectedDate)
  const setView = useAppStore((s) => s.setView)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400)
    return () => clearTimeout(t)
  }, [query])

  const { data: results, isLoading } = useSearch(debounced)

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 md:px-6">
      {/* Search hero */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent">
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <Search className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Semantic search</h2>
              <p className="text-[11px] text-muted-foreground">Search by meaning, not just keywords</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. When did I meet Ahmed? or Show my gym sessions"
              className="h-11 pl-9 pr-9 text-sm"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Example queries */}
      {!query && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Try asking
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="group flex items-center gap-2 rounded-lg border bg-card p-3 text-left text-xs transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="flex-1">{q}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {query && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isLoading ? 'Searching…' : `${results?.length ?? 0} match${(results?.length ?? 0) === 1 ? '' : 'es'}`}
            </span>
            {results && results.length > 0 && (
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-500" /> Ranked by AI relevance
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : !results || results.length === 0 ? (
            <Card className="border-dashed py-12">
              <div className="flex flex-col items-center gap-2 text-center">
                <Search className="h-8 w-8 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">No matches found</h3>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Try rephrasing your query, or check if the event exists in your timeline within the last 90 days.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            results.map((r) => (
              <SearchResultCard
                key={r.event.id}
                title={r.event.title}
                startISO={r.event.startTime}
                endISO={r.event.endTime}
                category={r.event.category}
                location={r.event.location}
                description={r.event.description}
                score={r.score}
                reason={r.reason}
                onOpen={() => {
                  setSelectedDate(r.event.startTime.slice(0, 10))
                  setView('timeline')
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SearchResultCard({
  title, startISO, endISO, category, location, description, score, reason, onOpen,
}: {
  title: string
  startISO: string
  endISO: string
  category: { name: string; color: string; icon: string | null } | null
  location: string | null
  description: string | null
  score: number
  reason: string
  onOpen: () => void
}) {
  return (
    <Card className="group cursor-pointer p-0 transition-shadow hover:shadow-md" onClick={onOpen}>
      <div className="flex items-stretch gap-3 p-3 pl-4">
        <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/50">
          <span className="text-[9px] font-semibold uppercase text-muted-foreground">{format(new Date(startISO), 'MMM')}</span>
          <span className="text-base font-bold leading-none">{format(new Date(startISO), 'd')}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
              <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
              {Math.round(score * 100)}%
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeRange(startISO, endISO)}
            </span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
          </div>
          {description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{description}</p>}
          <div className="mt-1.5 flex items-center gap-2">
            {category && <CategoryBadge name={category.name} color={category.color} icon={category.icon} />}
            <span className="flex items-center gap-1 text-[11px] italic text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-2.5 w-2.5" /> {reason}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
