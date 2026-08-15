'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTemplates, useCreateTemplate, useDeleteTemplate, useCategories } from '@/hooks/use-data'
import { CategoryDot } from '@/components/category-icon'
import { toast } from 'sonner'
import { useState } from 'react'
import { Star, Plus, Trash2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

export function TemplateManager() {
  const { data: templates, isLoading } = useTemplates()
  const { data: categories } = useCategories()
  const createMut = useCreateTemplate()
  const deleteMut = useDeleteTemplate()
  const { t } = useTranslation()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [durationMin, setDurationMin] = useState('60')

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error(t('settings.templateTitleRequired'))
      return
    }
    createMut.mutate(
      {
        title: title.trim(),
        categoryId: categoryId === 'none' ? null : categoryId,
        durationMin: Number(durationMin) || 60,
      },
      {
        onSuccess: () => {
          toast.success(t('settings.templateCreated', { title: title.trim() }))
          setTitle('')
          setCategoryId('none')
          setDurationMin('60')
        },
        onError: () => toast.error(t('settings.templateCreateFailed')),
      },
    )
  }

  const handleDelete = (id: string, title: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast.success(t('settings.templateDeleted', { title: title })),
      onError: () => toast.error(t('settings.templateDeleteFailed')),
    })
  }

  const catMap = new Map((categories ?? []).map((c) => [c.id, c]))

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
          <Star className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t('settings.templates')}</h3>
          <p className="text-xs text-muted-foreground">{t('settings.templates.subtitle')}</p>
        </div>
      </div>

      {/* Existing templates */}
      {isLoading ? (
        <div className="py-4 text-center text-xs text-muted-foreground">{t('common.loading')}</div>
      ) : !templates || templates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
            <Star className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.noTemplates')}
          </p>
        </div>
      ) : (
        <div className="mb-4 space-y-1.5">
          {templates.map((tpl: { id: string; title: string; categoryId: string | null; category: { name: string; color: string } | null; durationMin: number }) => {
            const cat = tpl.categoryId ? catMap.get(tpl.categoryId) : null
            return (
              <div key={tpl.id} className="group flex items-center gap-2 rounded-lg border bg-card p-2">
                <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{tpl.title}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {cat && <CategoryDot color={cat.color} />}
                    <span>{cat?.name ?? t('settings.uncategorized')}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {t('settings.durationMin', { min: tpl.durationMin })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(tpl.id, tpl.title)}
                  disabled={deleteMut.isPending}
                  className="text-rose-400 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                  aria-label={t('settings.deleteTemplateAria', { title: tpl.title })}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Create new template */}
      <div className="rounded-lg border border-dashed p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('settings.createTemplate')}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="tpl-title" className="text-[11px]">{t('settings.templateTitle')}</Label>
            <Input
              id="tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('settings.templateTitle.ph')}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tpl-cat" className="text-[11px]">{t('settings.templateCategory')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="tpl-cat" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('settings.noCategory')}</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tpl-dur" className="text-[11px]">{t('settings.templateDuration')}</Label>
            <Input
              id="tpl-dur"
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="h-8 text-sm"
              min="1"
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={createMut.isPending || !title.trim()}
          className="mt-2 w-full bg-amber-600 hover:bg-amber-700"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('settings.addTemplate')}
        </Button>
      </div>
    </Card>
  )
}

void cn
