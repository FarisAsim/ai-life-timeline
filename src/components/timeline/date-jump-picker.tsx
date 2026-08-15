'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { useAppStore } from '@/stores/app-store'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, subDays, addDays, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/use-translation'

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function DateJumpPicker() {
  const selectedDate = useAppStore((s) => s.selectedDate)
  const setSelectedDate = useAppStore((s) => s.setSelectedDate)
  const [open, setOpen] = useState(false)
  const { locale, t } = useTranslation()
  const isAr = locale === 'ar-EG'
  const arFormat = (d: Date, full: boolean) => {
    if (!isAr) return full ? format(d, 'EEEE, MMMM d, yyyy') : format(d, 'MMM d, yyyy')
    return `${d.getDate()} ${MONTHS_AR[d.getMonth()]}${full ? `، ${d.getFullYear()}` : ` ${d.getFullYear()}`}`
  }

  const date = new Date(selectedDate + 'T00:00:00')
  const today = isToday(date)

  const goPrev = () => setSelectedDate(format(subDays(date, 1), 'yyyy-MM-dd'))
  const goNext = () => setSelectedDate(format(addDays(date, 1), 'yyyy-MM-dd'))
  const goToday = () => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev} aria-label={t('picker.prevDay')}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={goToday}
            className="flex min-w-[8.5rem] items-center justify-center gap-1.5 px-2 text-center text-sm font-medium hover:bg-accent rounded-md py-1"
          >
            <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={today ? 'text-emerald-600 dark:text-emerald-400' : ''}>
              {today ? t('picker.today') : arFormat(date, false)}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                setSelectedDate(format(d, 'yyyy-MM-dd'))
                setOpen(false)
              }
            }}
            disabled={(d) => d > new Date()}
            className="rounded-lg border-0"
          />
          <div className="flex items-center justify-between border-t p-2">
            <Button variant="ghost" size="sm" onClick={() => { goToday(); setOpen(false) }} className="text-xs">
              {t('picker.jumpToday')}
            </Button>
            <span className="text-[10px] text-muted-foreground">{isAr ? `${DAYS_AR[date.getDay()]}` : format(date, 'EEEE')}</span>
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext} aria-label={t('picker.nextDay')} disabled={today}>
        <ChevronRight className={cn('h-4 w-4', today && 'opacity-30')} />
      </Button>
    </div>
  )
}
