'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tag, X, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimelineEvent } from '@/lib/types'

interface TagFilterBarProps {
  events: TimelineEvent[]
  selectedTag: string | null
  onTagSelect: (tag: string | null) => void
}

export function TagFilterBar({ events, selectedTag, onTagSelect }: TagFilterBarProps) {
  const [userExpanded, setUserExpanded] = useState(false)

  // Collect all unique tags from the day's events
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events) {
      for (const t of e.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }, [events])

  // Derive expanded state: auto-expanded when a tag is selected, or manually toggled
  const expanded = userExpanded || !!selectedTag

  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          setUserExpanded(!expanded)
          if (selectedTag) onTagSelect(null)
        }}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
          selectedTag
            ? 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300'
            : 'border-border bg-card text-muted-foreground hover:bg-accent',
        )}
        aria-label="Toggle tag filter"
      >
        {selectedTag ? <Tag className="h-3 w-3" /> : <Filter className="h-3 w-3" />}
        {selectedTag ? `#${selectedTag}` : 'Tags'}
        {selectedTag && <X className="h-2.5 w-2.5" />}
      </button>

      <AnimatePresence>
        {expanded && !selectedTag && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-1 overflow-hidden"
          >
            {tags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => onTagSelect(tag)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:scale-105',
                  selectedTag === tag
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : 'border-teal-500/20 bg-teal-500/5 text-teal-700 hover:bg-teal-500/15 dark:text-teal-300',
                )}
              >
                #{tag}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedTag && (
        <span className="text-[11px] text-muted-foreground">
          Filtered: {events.filter((e) => e.tags.includes(selectedTag)).length} event{events.filter((e) => e.tags.includes(selectedTag)).length === 1 ? '' : 's'}
        </span>
      )}
    </div>
  )
}
