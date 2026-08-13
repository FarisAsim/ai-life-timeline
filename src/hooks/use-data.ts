import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import type { Category, TimelineEvent, Attachment } from '@/lib/types'
import type { CreateEventInput } from '@/lib/services/timeline-service'

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

export function useCreateCategory() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (vars: { name: string; color: string; icon?: string }) => {
      const r = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!r.ok) throw new Error('Failed to create category')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Delete failed' }))
        throw new Error(err.error || 'Delete failed')
      }
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
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

// ---------- Settings ----------
export function useSettings() {
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery({
    queryKey: ['settings', refreshTick],
    queryFn: async () => {
      const r = await fetch('/api/settings')
      return r.json()
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (vars: { name?: string; timezone?: string; quietHoursStart?: string; quietHoursEnd?: string }) => {
      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!r.ok) throw new Error('Failed to update settings')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/account', { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete account')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries()
    },
  })
}

// ---------- Attachments ----------
export function useUploadAttachment() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (vars: { eventId: string; file: File }) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(vars.file)
      })
      const r = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: vars.eventId,
          filename: vars.file.name,
          mimeType: vars.file.type,
          data: dataUrl,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || 'Upload failed')
      }
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/attachments/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
  })
}

export function attachmentUrl(id: string) {
  return `/api/attachments/${id}`
}

// ---------- Event Templates ----------
export function useTemplates() {
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery({
    queryKey: ['templates', refreshTick],
    queryFn: async () => {
      const r = await fetch('/api/templates')
      const j = await r.json()
      return j.templates
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (vars: { title: string; categoryId?: string | null; durationMin?: number; description?: string }) => {
      const r = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!r.ok) throw new Error('Failed to create template')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete template')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

// ---------- Goals ----------
export function useGoals() {
  const refreshTick = useAppStore((s) => s.refreshTick)
  return useQuery({
    queryKey: ['goals', refreshTick],
    queryFn: async () => {
      const r = await fetch('/api/goals')
      const j = await r.json()
      return j.goals
    },
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (vars: { title: string; type: string; categoryId?: string | null; tag?: string | null; targetValue: number; period: string }) => {
      const r = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!r.ok) throw new Error('Failed to create goal')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete goal')
      return r.json()
    },
    onSuccess: () => {
      triggerRefresh()
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}
