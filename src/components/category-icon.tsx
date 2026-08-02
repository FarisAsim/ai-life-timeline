import {
  Briefcase, BookOpen, Dumbbell, Moon, Sparkles, Users, Smartphone,
  Utensils, Car, Heart, Tag, type LucideIcon,
} from 'lucide-react'
import { CATEGORY_COLOR_MAP } from '@/lib/types'

const ICONS: Record<string, LucideIcon> = {
  Briefcase, BookOpen, Dumbbell, Moon, Sparkles, Users, Smartphone,
  Utensils, Car, Heart,
}

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = name ? ICONS[name] ?? Tag : Tag
  return <Icon className={className ?? 'h-4 w-4'} />
}

export function CategoryBadge({ name, color, icon }: { name: string; color: string; icon?: string | null }) {
  const c = CATEGORY_COLOR_MAP[color] ?? CATEGORY_COLOR_MAP.slate
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>
      <CategoryIcon name={icon ?? null} className="h-3 w-3" />
      {name}
    </span>
  )
}

export function CategoryDot({ color }: { color: string }) {
  const c = CATEGORY_COLOR_MAP[color] ?? CATEGORY_COLOR_MAP.slate
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.dot}`} />
}
