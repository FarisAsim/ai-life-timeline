'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/hooks/use-data'
import { useSettings, useUpdateSettings, useDeleteAccount, useSeed } from '@/hooks/use-data'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { CategoryManager } from './category-manager'
import { AccountSwitcher } from '@/components/account/account-switcher'
import { TemplateManager } from './template-manager'
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
  User, Clock, Download, Upload, Trash2, Database, Shield, Sparkles, Loader2, Check, Globe, Bell, FileText, Sun, Moon, Languages, AlertCircle,
} from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { useTheme } from 'next-themes'
import { useLocaleStore } from '@/stores/locale-store'
import { Switch } from '@/components/ui/switch'

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

  return <SettingsBody key={data.user.id} data={data} />
}

function SettingsBody({ data }: { data: { user: { id: string; name: string | null; email: string; timezone: string; quietHoursStart: string | null; quietHoursEnd: string | null }; stats: { eventCount: number; unknownBlockCount: number; conversationCount: number; notificationCount: number; habitCount: number; categoryCount: number } } }) {
  const updateMut = useUpdateSettings()
  const deleteMut = useDeleteAccount()
  const seedMut = useSeed()
  const { t, locale: uiLocale } = useTranslation()
  const isAr = uiLocale === 'ar-EG'

  const [name, setName] = useState(data.user.name ?? '')
  const [timezone, setTimezone] = useState(data.user.timezone ?? 'Africa/Cairo')
  const [quietStart, setQuietStart] = useState(data.user.quietHoursStart ?? '22:00')
  const [quietEnd, setQuietEnd] = useState(data.user.quietHoursEnd ?? '07:00')
  const { theme, setTheme } = useTheme()
  const locale = useLocaleStore((s) => s.locale)
  const toggleLocale = useLocaleStore((s) => s.toggle)

  const tr = (en: string, ar: string) => isAr ? ar : en

  const handleSave = () => {
    updateMut.mutate(
      { name, timezone, quietHoursStart: quietStart, quietHoursEnd: quietEnd },
      { onSuccess: () => toast.success(isAr ? 'تم الحفظ' : 'Settings saved') },
    )
  }

  const handleExportJson = () => {
    window.location.href = '/api/data-export'
    toast.success(isAr ? 'تم بدء التصدير' : 'JSON export started')
  }

  const handleExportCsv = () => {
    window.location.href = '/api/export?format=csv'
    toast.success(isAr ? 'تم بدء التصدير' : 'CSV export started')
  }

  const handleImportJson = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const raw = await file.text()
        const parsed = JSON.parse(raw)
        const res = await apiFetch('/api/data-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: raw,
        })
        const result = await res.json()
        if (!res.ok) {
          toast.error(result.error || (isAr ? 'فشل الاستيراد' : 'Import failed'))
          return
        }
        const c = result.counts
        toast.success(
          isAr
            ? `تم الاستيراد: ${c.events} حدث، ${c.categories} فئة، ${c.conversations} محادثة، ${c.templates} قالب، ${c.goals} هدف، ${c.notifications} إشعار`
            : `Imported: ${c.events} events, ${c.categories} categories, ${c.conversations} conversations`,
        )
      } catch {
        toast.error(isAr ? 'ملف غير صالح — يجب أن يكون JSON من تصدير التطبيق' : 'Invalid file — must be a JSON export from this app')
      }
    }
    input.click()
  }

  const handleDelete = () => {
    deleteMut.mutate(undefined, {
      onSuccess: () => toast.success(isAr ? 'تم حذف كل البيانات' : 'All data deleted'),
    })
  }

  const stats = data.stats

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 md:px-6">
      {/* Profile */}
      <SectionCard icon={User} title={tr('Profile', 'الملف الشخصي')} description={tr('Your identity and timezone', 'هويتك والمنطقة الزمنية')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="settings-name">{tr('Display name', 'الاسم المعروض')}</Label>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('Your name', 'اسمك')} className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-tz">{tr('Timezone', 'المنطقة الزمنية')}</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input id="settings-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-11 pl-9" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {tr('All times in your timeline are displayed in this timezone.', 'كل الأوقات في خطك الزمني بتظهر بالمنطقة الزمنية دي.')}
        </div>
      </SectionCard>

      {/* Appearance & language */}
      <SectionCard icon={Sun} title={tr('Appearance & language', 'المظهر واللغة')} description={tr('Theme and interface language', 'المظهر ولغة الواجهة')}>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </div>
              <div>
                <div className="text-sm font-medium">{tr('Dark mode', 'الوضع الليلي')}</div>
                <p className="text-xs text-muted-foreground">{theme === 'dark' ? tr('On — dark theme active', 'مفعّل — الثيم الليلي شغال') : tr('Off — light theme active', 'مطفي — الثيم النهاري شغال')}</p>
              </div>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={(checked) => { setTheme(checked ? 'dark' : 'light'); toast.success(checked ? (isAr ? 'تم تفعيل الوضع الليلي' : 'Dark mode on') : (isAr ? 'تم تفعيل الوضع النهاري' : 'Light mode on')); }} aria-label={tr('Toggle dark mode', 'تفعيل الوضع الليلي')} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Languages className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{tr('Interface language', 'لغة الواجهة')}</div>
                <p className="text-xs text-muted-foreground">{locale === 'ar-EG' ? tr('العربية (مصري) — Arabic interface', 'العربية (مصري) — واجهة عربية') : tr('English — English interface', 'English — English interface')}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => { toggleLocale(); toast.success(isAr ? 'English now' : 'العربي دلوقتي'); }}>
              <Languages className="mr-1 h-3.5 w-3.5" />
              {locale === 'ar-EG' ? tr('English', 'English') : tr('العربية', 'العربية')}
            </Button>
          </div>
        </div>
      </SectionCard>

      <AIProviderSection />

      {/* Quiet hours */}
      <SectionCard icon={Bell} title={tr('Quiet hours', 'ساعات الهدوء')} description={tr('Notifications won\'t fire during these hours', 'الإشعارات مش هتظهر خلال الوقت ده')}>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="quiet-start">{tr('Start', 'البداية')}</Label>
            <Input id="quiet-start" type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quiet-end">{tr('End', 'النهاية')}</Label>
            <Input id="quiet-end" type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="h-11" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{tr('Gap prompts and pre-event nudges are suppressed between these times.', 'إشعارات الفجوات والتذكيرات بتتعطل بين الأوقات دي.')}</p>
          <Button size="sm" onClick={handleSave} disabled={updateMut.isPending} className="h-11 bg-emerald-600 hover:bg-emerald-700">
            {updateMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {tr('Save', 'حفظ')}
          </Button>
        </div>
      </SectionCard>

      <CategoryManager />
      <TemplateManager />

      {/* Data stats */}
      <SectionCard icon={Database} title={tr('Your data', 'بياناتك')} description={tr('What we\'ve stored about your timeline', 'اللي مخزن عن خطك الزمني')}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <StatBox label={tr('Events', 'أحداث')} value={stats.eventCount} />
          <StatBox label={tr('Gaps', 'فجوات')} value={stats.unknownBlockCount} />
          <StatBox label={tr('Chats', 'محادثات')} value={stats.conversationCount} />
          <StatBox label={tr('Notifs', 'إشعارات')} value={stats.notificationCount} />
          <StatBox label={tr('Habits', 'عادات')} value={stats.habitCount} />
          <StatBox label={tr('Cats', 'فئات')} value={stats.categoryCount} />
        </div>
      </SectionCard>

      {/* Privacy */}
      <SectionCard icon={Shield} title={tr('Privacy & data control', 'الخصوصية والتحكم في البيانات')} description={tr('Accounts, export or delete your data', 'الحسابات، التصدير أو حذف البيانات')}>
        <AccountSwitcher />
        <Separator className="my-2" />
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{tr('Export all data', 'تصدير كل البيانات')}</div>
                <p className="text-xs text-muted-foreground">{tr('Full backup: events, categories, gaps, conversations, habits, templates, goals, notifications.', 'نسخة احتياطية كاملة: الأحداث، الفئات، الفجوات، المحادثات، العادات، القوالب، الأهداف، الإشعارات. ملف JSON ده تقدر ترجّع منه بياناتك على أي جهاز.')}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button variant="outline" size="sm" className="h-9" onClick={handleExportJson}>
                <Download className="mr-1 h-3.5 w-3.5" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="h-9 border-teal-500/30 text-teal-700 hover:bg-teal-500/10 dark:text-teal-300" onClick={handleExportCsv}>
                <FileText className="mr-1 h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="h-9 border-indigo-500/30 text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-300" onClick={handleImportJson}>
                <Upload className="mr-1 h-3.5 w-3.5" /> {tr('Import', 'استيراد')}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-rose-700 dark:text-rose-300">{tr('Delete all data', 'حذف كل البيانات')}</div>
                <p className="text-xs text-muted-foreground">{tr('Permanently delete everything', 'حذف دائم لكل حاجة')}</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0 border-rose-500/40 text-rose-600 hover:bg-rose-500/10">
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> {tr('Delete', 'حذف')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{tr('Delete all timeline data?', 'حذف كل بيانات الخط الزمني؟')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tr(
                      `This will permanently delete all ${stats.eventCount} events, ${stats.unknownBlockCount} unknown blocks. This cannot be undone.`,
                      `هتتمسح كل ${stats.eventCount} حدث و ${stats.unknownBlockCount} فجوة. ده مش هيتراجع.`
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tr('Cancel', 'إلغاء')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700" disabled={deleteMut.isPending}>
                    {deleteMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {tr('Yes, delete everything', 'أيوة، احذف كل حاجة')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SectionCard>

      {/* Demo data */}
      <SectionCard icon={Sparkles} title={tr('Demo data', 'بيانات تجريبية')} description={tr('Re-seed sample timeline data', 'إعادة زرع بيانات نموذجية')}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {tr('Generates a realistic week of events with gaps.', 'بيزرع أسبوع من الأحداث النموذجية مع فجوات.')}
          </p>
          <Button variant="outline" size="sm" className="h-9" onClick={() => seedMut.mutate(undefined, { onSuccess: () => toast.success(isAr ? 'تم الزرع' : 'Re-seeded') })} disabled={seedMut.isPending}>
            {seedMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            {tr('Re-seed', 'إعادة الزرع')}
          </Button>
        </div>
      </SectionCard>

      <Separator className="my-2" />
      <p className="text-center text-xs text-muted-foreground">
        {tr('AI Life Timeline · Your data is stored locally.', 'الخط الزمني الذكي · بياناتك مخزنة محلياً.')}
      </p>
    </div>
  )
}

function AIProviderSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<{
    providerType: 'openai' | 'gemini'
    apiKey: string
    baseUrl: string
    model: string
    sttModel: string
    geminiApiKey: string
    geminiModel: string
    configured: boolean
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/api/settings/ai')
      const j = await r.json()
      setConfig({
        providerType: j.providerType ?? 'openai',
        apiKey: j.apiKey ?? '',
        baseUrl: j.baseUrl ?? 'https://api.openai.com/v1',
        model: j.model ?? 'gpt-4o-mini',
        sttModel: j.sttModel ?? 'gpt-4o-transcribe',
        geminiApiKey: j.geminiApiKey ?? '',
        geminiModel: j.geminiModel ?? 'gemini-3.6-flash',
        configured: j.configured ?? false,
      })
    } catch {
      setConfig({ providerType: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', sttModel: 'gpt-4o-transcribe', geminiApiKey: '', geminiModel: 'gemini-3.6-flash', configured: false })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const r = await apiFetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const j = await r.json()
      if (j.error) {
        toast.error(j.error)
      } else {
        setConfig({ ...config, configured: j.configured ?? (config.apiKey.length > 0) })
        toast.success(t('settings.aiSaved'))
      }
    } catch {
      toast.error(t('settings.aiSaveFailed'))
    }
    setSaving(false)
  }

  return (
    <SectionCard id="settings-ai-section" icon={Sparkles} title={t('settings.aiProviderTitle')} description={t('settings.aiProviderDesc')}>
      {!config || loading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : (
        <>
          {config.configured ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-300">{t('settings.aiEnabled')}</span>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-300">{t('settings.aiOffline')}</span>
            </div>
          )}
          <div className="grid gap-2">
            <Label>{t('settings.aiProviderType')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={config.providerType === 'openai' ? 'default' : 'outline'} size="sm" className="h-11" onClick={() => setConfig({ ...config, providerType: 'openai' })}>
                OpenAI-compatible
              </Button>
              <Button type="button" variant={config.providerType === 'gemini' ? 'default' : 'outline'} size="sm" className="h-11" onClick={() => setConfig({ ...config, providerType: 'gemini' })}>
                Google Gemini
              </Button>
            </div>
          </div>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {config.providerType === 'openai' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="ai-api-key">{t('settings.aiApiKey')}</Label>
                  <Input id="ai-api-key" type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="sk-..." className="h-11" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-base-url">{t('settings.aiBaseUrl')}</Label>
                  <Input id="ai-base-url" value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" className="h-11" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-model">{t('settings.aiChatModel')}</Label>
                  <Input id="ai-model" value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} className="h-11" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-stt-model">{t('settings.aiSttModel')}</Label>
                  <Input id="ai-stt-model" value={config.sttModel} onChange={(e) => setConfig({ ...config, sttModel: e.target.value })} className="h-11" />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="ai-gemini-key">{t('settings.aiGeminiKey')}</Label>
                  <Input id="ai-gemini-key" type="password" value={config.geminiApiKey} onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })} placeholder="AIza..." className="h-11" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-gemini-model">{t('settings.aiGeminiModel')}</Label>
                  <Input id="ai-gemini-model" value={config.geminiModel} onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })} className="h-11" />
                </div>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-11 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              {t('settings.aiSave')}
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  )
}

function SectionCard({ id, icon: Icon, title, description, children }: { id?: string; icon: typeof User; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="glass-card p-5">
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
    <div className="rounded-lg border bg-card p-2 text-center">
      <div className="text-lg font-bold tracking-tight text-emerald-600">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
