// Shared domain types for AI Life Timeline

export type EventSource = 'user_manual' | 'ai_guess' | 'ai_confirmed' | 'integration'

export type UnknownBlockStatus =
  | 'open'
  | 'resolved'
  | 'ai_guessed_pending_confirmation'
  | 'unknown_confirmed'

export type UnknownBlockSeverity = 'low' | 'medium' | 'high'

export type ViewName =
  | 'timeline'
  | 'calendar'
  | 'unknown'
  | 'companion'
  | 'insights'
  | 'search'
  | 'notifications'

export interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  isDefault: boolean
}

export interface TimelineEvent {
  id: string
  userId: string
  title: string
  description: string | null
  startTime: string // ISO
  endTime: string // ISO
  durationMinutes: number
  location: string | null
  notes: string | null
  categoryId: string | null
  category: Category | null
  confidenceScore: number
  source: EventSource
  createdAt: string
  updatedAt: string
}

export interface UnknownBlock {
  id: string
  userId: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: UnknownBlockStatus
  severity: UnknownBlockSeverity
  resolutionSource: string | null
  resolvedEventId: string | null
  resolvedEvent: TimelineEvent | null
  createdAt: string
  updatedAt: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata: string | null
  createdAt: string
}

export interface AIConversation {
  id: string
  title: string
  messages: AIMessage[]
  createdAt: string
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  actionType: string | null
  actionPayload: string | null
  isRead: boolean
  createdAt: string
}

export interface DayCompletion {
  date: string // YYYY-MM-DD
  coveredMinutes: number
  totalMinutes: number // awake minutes (e.g. 16h = 960)
  score: number // 0..1
  status: 'green' | 'yellow' | 'red'
  eventCount: number
  openBlockCount: number
}

export interface MonthCompletion {
  days: DayCompletion[]
  monthScore: number
}

export interface InsightData {
  totalTrackedMinutes: number
  categoryBreakdown: { category: Category | null; minutes: number; percentage: number }[]
  productiveHours: { hour: number; minutes: number; score: number }[]
  dailyTotals: { date: string; minutes: number }[]
  completenessPercentage: number
  topHabits: { patternKey: string; categoryId: string | null; frequency: number; confidence: number }[]
  weeklySummary: string
}

export interface CompanionActionResult {
  type: 'create_event' | 'move_event' | 'create_reminder' | 'answer' | 'resolve_gap'
  data?: unknown
}

// Default categories seeded for every user
export const DEFAULT_CATEGORIES = [
  { name: 'Work', color: 'emerald', icon: 'Briefcase' },
  { name: 'Study', color: 'violet', icon: 'BookOpen' },
  { name: 'Exercise', color: 'orange', icon: 'Dumbbell' },
  { name: 'Sleep', color: 'indigo', icon: 'Moon' },
  { name: 'Prayer', color: 'amber', icon: 'Sparkles' },
  { name: 'Social', color: 'rose', icon: 'Users' },
  { name: 'Screen Time', color: 'slate', icon: 'Smartphone' },
  { name: 'Meals', color: 'yellow', icon: 'Utensils' },
  { name: 'Commute', color: 'cyan', icon: 'Car' },
  { name: 'Personal', color: 'teal', icon: 'Heart' },
] as const

// Maps a category color token to tailwind classes (used in UI)
export const CATEGORY_COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500/30', dot: 'bg-violet-500' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/30', dot: 'bg-indigo-500' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/30', dot: 'bg-rose-500' },
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/30', dot: 'bg-slate-500' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500/30', dot: 'bg-cyan-500' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-500/30', dot: 'bg-teal-500' },
}

export const SOURCE_LABELS: Record<EventSource, string> = {
  user_manual: 'Manual',
  ai_guess: 'AI Guess',
  ai_confirmed: 'AI Confirmed',
  integration: 'Integration',
}
