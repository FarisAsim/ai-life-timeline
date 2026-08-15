'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CATEGORY_COLOR_MAP } from '@/lib/types'
import { useCategories, useCreateCategory, useDeleteCategory } from '@/hooks/use-data'
import { CategoryBadge, CategoryDot } from '@/components/category-icon'
import { toast } from 'sonner'
import { Plus, Trash2, Tag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

const COLOR_OPTIONS = Object.keys(CATEGORY_COLOR_MAP)

export function CategoryManager() {
  const { data: categories } = useCategories()
  const createMut = useCreateCategory()
  const deleteMut = useDeleteCategory()
  const { t } = useTranslation()

  const [name, setName] = useState('')
  const [color, setColor] = useState('emerald')

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error(t('settings.nameRequired'))
      return
    }
    createMut.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          toast.success(t('settings.categoryCreated', { name: name.trim() }))
          setName('')
        },
        onError: () => toast.error(t('settings.categoryCreateFailed')),
      },
    )
  }

  const handleDelete = (id: string, name: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error(t('settings.defaultCannotDelete'))
      return
    }
    deleteMut.mutate(id, {
      onSuccess: () => toast.success(t('settings.categoryDeleted', { name })),
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <Tag className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t('settings.categories')}</h3>
          <p className="text-xs text-muted-foreground">{t('settings.categories.subtitle')}</p>
        </div>
      </div>

      {/* Existing categories */}
      <div className="mb-4 grid gap-1.5 sm:grid-cols-2">
        {categories?.map((c) => (
          <div
            key={c.id}
            className="group flex items-center gap-2 rounded-lg border bg-card p-2"
          >
            <CategoryDot color={c.color} />
            <span className="flex-1 truncate text-xs font-medium">{c.name}</span>
            {c.isDefault && (
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">{t('settings.defaultBadge')}</span>
            )}
            {!c.isDefault && (
              <button
                onClick={() => handleDelete(c.id, c.name, c.isDefault)}
                disabled={deleteMut.isPending}
                className="text-rose-400 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                aria-label={t('settings.deleteCategoryAria', { name: c.name })}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create new category */}
      <div className="rounded-lg border border-dashed p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('settings.createCategory')}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="cat-name" className="text-[11px]">{t('settings.categoryName')}</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.categoryName.ph')}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[11px]">{t('settings.categoryColor')}</Label>
            <div className="flex flex-wrap gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-md transition-all',
                    CATEGORY_COLOR_MAP[c]?.dot,
                    color === c ? 'ring-2 ring-offset-1 ring-foreground' : 'opacity-60 hover:opacity-100',
                  )}
                  aria-label={t('settings.colorAria', { color: c })}
                />
              ))}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createMut.isPending || !name.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {t('settings.add')}
          </Button>
        </div>
        {/* Preview */}
        {name.trim() && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            {t('settings.preview')}: <CategoryBadge name={name.trim()} color={color} />
          </div>
        )}
      </div>
    </Card>
  )
}
