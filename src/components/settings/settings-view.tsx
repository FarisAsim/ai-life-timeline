'use client'

import { useState } from 'react'
import { useSettings, useUpdateSettings, useDeleteAccount, useSeed } from '@/hooks/use-data'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  User, Clock, Download, Trash2, Database, Shield, Sparkles, Loader2, Check, Globe, Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function SettingsView() {
  const { data, isLoading } = useSettings()

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 md:px-6">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  // Keyed remount: the form body initializes its useState from server data
  // once per data load, avoiding setState-in-render anti-patterns.
  return <SettingsBody key={data.user.id} data={data} />
}

function SettingsBody({ data }: { data: { user: { id: string; name: string | null; email: string; timezone: string; quietHoursStart: string | null; quietHoursEnd: string | null }; stats: { eventCount: number; unknownBlockCount: number; conversationCount: number; notificationCount: number; habitCount: number; categoryCount: number } } }) {
  const updateMut = useUpdateSettings()
  const deleteMut = useDeleteAccount()
  const seedMut = useSeed()

  const [name, setName] = useState(data.user.name ?? '')
  const [timezone, setTimezone] = useState(data.user.timezone ?? 'Africa/Cairo')
  const [quietStart, setQuietStart] = useState(data.user.quietHoursStart ?? '22:00')
  const [quietEnd, setQuietEnd] = useState(data.user.quietHoursEnd ?? '07:00')

  const handleSave = () => {
    updateMut.mutate(
      { name, timezone, quietHoursStart: quietStart, quietHoursEnd: quietEnd },
      { onSuccess: () => toast.success('Settings saved') },
    )
  }

  const handleExport = () => {
    window.location.href = '/api/export'
    toast.success('Export started — check your downloads')
  }

  const handleDelete = () => {
    deleteMut.mutate(undefined, {
      onSuccess: () => toast.success('All data deleted. A fresh empty account was created.'),
    })
  }

  const stats = data.stats

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 md:px-6">
      {/* Profile section */}
      <SectionCard icon={User} title="Profile" description="Your identity and timezone">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="settings-name">Display name</Label>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-tz">Timezone</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input id="settings-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          All times in your timeline are displayed in this timezone.
        </div>
      </SectionCard>

      {/* Quiet hours */}
      <SectionCard icon={Bell} title="Quiet hours" description="Notifications won't fire during these hours">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="quiet-start">Start</Label>
            <Input id="quiet-start" type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quiet-end">End</Label>
            <Input id="quiet-end" type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Gap prompts and pre-event nudges are suppressed between these times.</p>
          <Button size="sm" onClick={handleSave} disabled={updateMut.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {updateMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            Save changes
          </Button>
        </div>
      </SectionCard>

      {/* Data stats */}
      <SectionCard icon={Database} title="Your data" description="What we've stored about your timeline">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <StatBox label="Events" value={stats.eventCount} />
          <StatBox label="Gaps" value={stats.unknownBlockCount} />
          <StatBox label="Chats" value={stats.conversationCount} />
          <StatBox label="Notifs" value={stats.notificationCount} />
          <StatBox label="Habits" value={stats.habitCount} />
          <StatBox label="Cats" value={stats.categoryCount} />
        </div>
      </SectionCard>

      {/* Privacy & data control */}
      <SectionCard icon={Shield} title="Privacy & data control" description="Export or delete your data — your right, per our privacy promise">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Export all data</div>
                <p className="text-xs text-muted-foreground">Download a JSON file with every event, gap, conversation, and habit.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-rose-700 dark:text-rose-300">Delete all data</div>
                <p className="text-xs text-muted-foreground">Permanently delete every event, gap, and conversation. A fresh empty account is created.</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 border-rose-500/40 text-rose-600 hover:bg-rose-500/10">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all timeline data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {stats.eventCount} events, {stats.unknownBlockCount} unknown blocks, {stats.conversationCount} conversations, and {stats.habitCount} learned habits. This cannot be undone. A fresh empty account will be created so you can start over.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-rose-600 hover:bg-rose-700"
                    disabled={deleteMut.isPending}
                  >
                    {deleteMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SectionCard>

      {/* Demo data */}
      <SectionCard icon={Sparkles} title="Demo data" description="Re-seed a week of sample timeline data">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Generates a realistic week of events (prayers, work, gym, meals) with gaps for you to resolve. Safe to re-run.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMut.mutate(undefined, { onSuccess: () => toast.success('Demo data re-seeded') })}
            disabled={seedMut.isPending}
          >
            {seedMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Re-seed
          </Button>
        </div>
      </SectionCard>

      <Separator className="my-2" />
      <p className="text-center text-[11px] text-muted-foreground">
        AI Life Timeline · Your data is stored locally in this sandbox. Export it anytime.
      </p>
    </div>
  )
}

function SectionCard({ icon: Icon, title, description, children }: { icon: typeof User; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="text-xl font-bold tracking-tight text-emerald-600">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}
