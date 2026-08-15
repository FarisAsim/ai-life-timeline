'use client'

import { useAppStore } from '@/stores/app-store'
import { useNotifications, useMarkAllRead, useRunNotificationEngine } from '@/hooks/use-data'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell, Hourglass, CalendarClock, Sparkles, Lightbulb, CheckCheck, RefreshCw, BellOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAppStore as useStore } from '@/stores/app-store'
import { useTranslation } from '@/hooks/use-translation'

function formatRelativeAr(isAr: boolean, date: Date): string {
  if (!isAr) return formatDistanceToNow(date, { addSuffix: true })
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'الآن'
  if (diffMin < 60) return `منذ ${diffMin} دقيقة${diffMin === 1 ? '' : 'ات'}`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `منذ ${diffH} ساعة${diffH === 1 ? '' : diffH < 11 ? 'ات' : ''}`
  const diffD = Math.floor(diffH / 24)
  return `منذ ${diffD} يوم${diffD === 1 ? '' : diffD < 11 ? 'ات' : ''}`
}

// Stored notification texts are generated server-side in English. Translate them to Egyptian Arabic at render time.
function translateNotification(
  n: { type: string; title: string; body: string },
  locale: string,
): { title: string; body: string } {
  const isAr = locale === 'ar-EG'
  if (!isAr) return { title: n.title, body: n.body }
  // gap_prompt: "4.8h unaccounted for" / "There's an unexplained gap from 9:00 AM to 1:49 PM. ..."
  const gapTitle = n.title.match(/^([\d.,]+)h? unaccounted for$/)
  if (n.type === 'gap_prompt' && gapTitle) {
    const hours = gapTitle[1].replace('.', '٫')
    const times = n.body.match(/from (.+?) to (.+?)\./)
    const bodyAr = times
      ? `فيه فجوة غير مفسّرة من ${times[1]} لـ ${times[2]}. ساعدني أخلي خطك الزمني مكتمل.`
      : n.body
    return { title: `${hours} ساعة غير متتبع`, body: bodyAr }
  }
  // pre_event: "Up next: X" / "Your "X" starts in about an hour. Are you still going?"
  if (n.type === 'pre_event') {
    const titleAr = n.title.replace(/^Up next: /, 'بعد كده: ')
    const bodyAr = n.body.replace(/Your "(.+?)" starts in about an hour\. Are you still going\?/, 'حدثك "$1" هيبقى بعد ساعة تقريبًا. لسه هتعمله؟')
    return { title: titleAr, body: bodyAr }
  }
  // insight: goal achieved
  const achieved = n.title.match(/^🎉 Goal achieved!$/)
  if (achieved) {
    const bodyAr = n.body.replace(/You hit "(.+?)" — ([\d.,]+) \/ ([\d.,]+) this (weekly|monthly)\. Keep it up!/, 'حققت هدفك "$1" — $2 / $3 الأسبوع ده. كمّل كده!').replace('this weekly', 'الأسبوع ده').replace('this monthly', 'الشهر ده')
    return { title: '🎉 هدفك اتحقق!', body: bodyAr }
  }
  // insight: almost there
  const almost = n.title.match(/^Almost there: (.+)$/)
  if (almost) {
    const bodyAr = n.body.replace(/You're at (\d+)% of your weekly goal \(([\d.,]+) \/ ([\d.,]+)\)\. One more push!/, 'وصلت $1% من هدفك الأسبوعي ($2 / $3). دفعة أخيرة!')
    return { title: `بقى شوية ونخلص: ${almost[1]}`, body: bodyAr }
  }
  // insight: weekly summary
  if (n.title.startsWith('📊 Your week in review')) {
    const bodyAr = n.body
      .replace(/^This week: ([\d.,]+)h tracked across (\d+) days?\./, 'الأسبوع ده: $1س مسجلة في $2 يوم.')
      .replace(/Top activity: (.+?) \(([\d.,]+)h\)\./, 'أكتر نشاط: $1 ($2س).')
      .replace(/Timeline completeness: (\d+)%\./, 'نسبة اكتمال الخط الزمني: $1%.')
      .replace('Resolve a few more gaps to improve your insights.', 'حل شوية فجوات كمان عشان التحليلات تبقى أدق.')
      .replace('Excellent coverage — your insights are highly representative.', 'تغطية ممتازة — تحليلاتك دقيقة وممثلة كويس.')
    return { title: '📊 ملخص أسبوعك', body: bodyAr }
  }
  // ai_guess: "AI guess for your gap" (seeded sample)
  if (n.title === 'AI guess for your gap') {
    return {
      title: 'تخمين الذكاء الاصطناعي للفجوة بتاعتك',
      body: 'بناءً على نمطك (الجيم + الشغل المركز أيام الأسبوع)، هخمّن إن الفجوة دي كانت "مواصلات" أو "مشي". افتحها في الأوقات الغامضة وكدّها أو صحّحها — كل إجابة بتخليني أذكى.',
    }
  }
  // welcome seeded notification
  if (n.title.includes('Welcome to your Life Timeline')) {
    return {
      title: 'أهلاً بيك في خطك الزمني',
      body: 'حملتلك أسبوع بيانات تجريبية عشان تتصفح التطبيق. افتح تبويب الأوقات الغامضة عشان تشوف الفجوات المكتشفة.',
    }
  }
  return { title: n.title, body: n.body }
}

export function NotificationsPanel() {
  const { locale } = useTranslation()
  const isAr = locale === 'ar-EG'
  const tr = (en: string, ar: string) => isAr ? ar : en
  const { t } = useTranslation()
  const open = useAppStore((s) => s.notifPanelOpen)
  const setOpen = useAppStore((s) => s.setNotifPanelOpen)
  const setView = useStore((s) => s.setView)
  const { data, isLoading } = useNotifications()
  const markAll = useMarkAllRead()
  const runEngine = useRunNotificationEngine()

  const notifications = data?.notifications ?? []
  const unread = data?.unreadCount ?? 0
  const TYPE_META: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
    gap_prompt: { icon: Hourglass, color: 'text-amber-600', bg: 'bg-amber-500/10', label: t('notif.typeGapPrompt') },
    pre_event: { icon: CalendarClock, color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: t('notif.typeUpcoming') },
    state_change: { icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-500/10', label: t('notif.typeStateChange') },
    insight: { icon: Lightbulb, color: 'text-orange-600', bg: 'bg-orange-500/10', label: t('notif.typeInsight') },
    ai_guess: { icon: Sparkles, color: 'text-fuchsia-600', bg: 'bg-fuchsia-500/10', label: t('notif.typeAiGuess') },
  }

  const handleAction = (n: { actionType: string | null; actionPayload: string | null }) => {
    if (n.actionType === 'resolve_gap') {
      setView('unknown')
    } else if (n.actionType === 'view_event') {
      setView('timeline')
    } else if (n.actionType === 'view_insight') {
      setView('insights')
    }
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('notif.title')}
            {unread > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
            )}
          </SheetTitle>
          <SheetDescription>{t('notif.description')}</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 px-1 py-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate(undefined, { onSuccess: () => toast.success(t('notif.allRead')) })}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            {t('notif.markAllRead')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={runEngine.isPending}
            onClick={() =>
              runEngine.mutate(undefined, {
                onSuccess: (d: { count?: number } | undefined) =>
                  d?.count ? toast.success(t('notif.generated', { count: d.count })) : toast.info(t('notif.noNew')),
              })
            }
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', runEngine.isPending && 'animate-spin')} />
            {t('notif.scanNow')}
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-12rem)] pr-1">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BellOff className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">{t('notif.allCaughtUp')}</h3>
              <p className="max-w-xs text-xs text-muted-foreground">
                {t('notif.willAppear')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n: {
                id: string
                type: string
                title: string
                body: string
                actionType: string | null
                actionPayload: string | null
                isRead: boolean
                createdAt: string
              }) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.insight
                const Icon = meta.icon
                const arN = isAr ? translateNotification(n, locale) : n
                return (
                  <button
                    key={n.id}
                    onClick={() => handleAction(n)}
                    className={cn(
                      'block w-full rounded-xl border p-3 text-left transition-colors hover:bg-accent',
                      n.isRead ? 'border-border bg-card' : 'border-emerald-500/30 bg-emerald-500/5',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.bg, meta.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{arN.title}</span>
                          {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{arN.body}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground">{formatRelativeAr(isAr, new Date(n.createdAt))}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
