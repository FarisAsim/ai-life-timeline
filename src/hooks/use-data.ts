import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import type { Category, CreateEventInput, TimelineEvent } from '@/lib/types'

// ---------- Categories ----------
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const r = await fetch('/api/categories')
      const j = await r.json()
      return j.categories
    },
  })
}

// ---------- Timeline events for selected day ----------
export function useTimelineDay() {
  const date = useAppStore((s) => s.selectedDate)
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery<TimelineEvent[]>({
    queryKey: ['timeline', date, refreshTick],
    queryFn: async () => {
      const r = await fetch(`/api/timeline?date=${date}`)
      const j = await r.json()
      return j.events
    },
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const r = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error('Failed to create event')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['timeline'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
      qc.invalidateQueries({ queryKey: ['unknown-blocks'] })
      qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateEventInput> & { id: string }) => {
      const r = await fetch(`/api/timeline/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) throw new Error('Failed to update event')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['timeline'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
      qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/timeline/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete event')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['timeline'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
      qc.invalidateQueries({ queryKey: ['unknown-blocks'] })
      qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}

// ---------- Unknown blocks ----------
export function useUnknownBlocks(all = false) {
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery({
    queryKey: ['unknown-blocks', all, refreshTick],
    queryFn: async () => {
      const r = await fetch(`/api/unknown-blocks${all ? '?all=true' : ''}`)
      const j = await r.json()
      return j.blocks
    },
  })
}

export function useAiGuess() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (blockId: string) => {
      const r = await fetch('/api/unknown-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_guess', blockId }),
      })
      if (!r.ok) throw new Error('AI guess failed')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['unknown-blocks'] })
    },
  })
}

export function useResolveBlock() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (vars: { blockId: string; title: string; categoryId: string | null; description?: string }) => {
      const r = await fetch('/api/unknown-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_text', ...vars }),
      })
      if (!r.ok) throw new Error('Resolve failed')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['unknown-blocks'] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
      qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}

export function useConfirmUnknown() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (blockId: string) => {
      const r = await fetch('/api/unknown-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_unknown', blockId }),
      })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['unknown-blocks'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

// ---------- Calendar ----------
export function useMonthCompletion(year: number, month: number) {
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery({
    queryKey: ['calendar', year, month, refreshTick],
    queryFn: async () => {
      const r = await fetch(`/api/calendar?year=${year}&month=${month}`)
      return r.json()
    },
  })
}

// ---------- Companion ----------
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const r = await fetch('/api/companion')
      const j = await r.json()
      return j.conversations
    },
  })
}

export function useCompanionChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { message: string; conversationId?: string | null }) => {
      const r = await fetch('/api/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!r.ok) throw new Error('Chat failed')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
      qc.invalidateQueries({ queryKey: ['unknown-blocks'] })
    },
  })
}

// ---------- Insights ----------
export function useInsights(days = 30) {
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery({
    queryKey: ['insights', days, refreshTick],
    queryFn: async () => {
      const r = await fetch(`/api/insights?days=${days}`)
      return r.json()
    },
  })
}

// ---------- Search ----------
export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query.trim()) return []
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const j = await r.json()
      return j.results
    },
    enabled: query.trim().length > 0,
  })
}

// ---------- Notifications ----------
export function useNotifications() {
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery({
    queryKey: ['notifications', refreshTick],
    queryFn: async () => {
      const r = await fetch('/api/notifications')
      const j = await r.json()
      return j
    },
  })
}

export function useRunNotificationEngine() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_engine' }),
      })
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// ---------- Gap detection ----------
export function useDetectGaps() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (date: string) => {
      const r = await fetch('/api/gap-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['unknown-blocks'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

// ---------- Seed ----------
export function useSeed() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/seed', { method: 'POST' })
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries()
    },
  })
}
