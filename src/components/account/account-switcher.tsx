'use client'

import { useState } from 'react'
import { useAuthAccounts } from '@/hooks/use-auth-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserPlus, LogOut, Users, Pencil, Check, Trash2, Loader2 } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'

/**
 * Account switcher — creates and switches between device-level accounts.
 * Appears in the settings page so each person using this device gets their
 * own isolated timeline.
 */
export function AccountSwitcher() {
  const { t } = useTranslation()
  const {
    accounts, activeAccount, activeId, isLoading,
    name, setName, createAccount, isCreating,
    switchAccount, removeAccount, renameAccount,
    isRemoving, isRenaming,
  } = useAuthAccounts()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />
  if (accounts.length === 0) return null

  const isAr = (typeof window !== 'undefined' && localStorage.getItem('life-timeline-locale')) === 'ar-EG'
  const tr = (en: string, ar: string) => isAr ? ar : en

  const handleRename = (id: string) => {
    if (editName.trim().length < 2) return
    renameAccount({ id, name: editName.trim() }, {
      onSuccess: () => {
        toast.success(tr('Name updated', 'تم تحديث الاسم'))
        setEditingId(null)
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{tr('Accounts on this device', 'الحسابات على الجهاز ده')}</span>
      </div>

      {/* Active account + create new */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {tr('Active:', 'النشط:')} <strong>{activeAccount?.name ?? '—'}</strong>
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr('New account name', 'اسم الحساب الجديد')}
          className="h-9 max-w-[180px] text-sm"
          onKeyDown={(e) => e.key === 'Enter' && createAccount()}
        />
        <Button size="sm" className="h-9" onClick={createAccount} disabled={isCreating || name.trim().length < 2}>
          {isCreating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1 h-3.5 w-3.5" />}
          {tr('Add account', 'إضافة حساب')}
        </Button>
      </div>

      {/* Account list */}
      <div className="space-y-1.5">
        {accounts.map((account) => {
          const active = account.id === activeId
          const editing = editingId === account.id
          return (
            <div key={account.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${active ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}>
              {editing ? (
                <div className="flex items-center gap-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 w-40 text-sm" autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(account.id)} />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleRename(account.id)} disabled={isRenaming}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <span className="truncate">
                  {account.name} {active && <span className="text-xs text-emerald-600 dark:text-emerald-400">({tr('active', 'نشط')})</span>}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {!editing && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingId(account.id); setEditName(account.name) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {active ? (
                  <span className="flex h-8 items-center text-xs text-muted-foreground px-2">{tr('Current', 'الحالي')}</span>
                ) : (
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => switchAccount(account.id)}>
                    <LogOut className="mr-1 h-3.5 w-3.5" /> {tr('Switch', 'تبديل')}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{tr('Delete this account?', 'حذف الحساب ده؟')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {tr(
                          'This removes the account from this device only. Its data stays in the database (export it first if you want to keep it).',
                          'ده بيحذف الحساب من الجهاز ده بس. بياناته بتفضل في قاعدة البيانات (صدّرها الأول لو عايز تحتفظ بيها).',
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tr('Cancel', 'إلغاء')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeAccount(account.id, { onSuccess: () => toast.success(tr('Account removed', 'تم إزالة الحساب')) })}
                        className="bg-rose-600 hover:bg-rose-700"
                        disabled={isRemoving}
                      >
                        {tr('Remove', 'إزالة')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
