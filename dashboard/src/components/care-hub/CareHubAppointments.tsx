'use client';

import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  Calendar,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { ReleasedVisitSummary } from '@/types/visit-summary';

interface Appointment {
  id: string;
  date: Date;
  provider: string;
  specialty: string;
  status: 'pending';
  notes: string;
}

/** Parse a timeframe string like "2 weeks", "3 days", "1 month" into a Date offset from visitDate */
function parseTimeframeToDate(visitDate: string, timeframe: string): Date {
  const base = new Date(visitDate);
  const lower = timeframe.toLowerCase().trim();
  const match = lower.match(/(\d+)\s*(day|week|month)/);
  if (match) {
    const n = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'day') base.setDate(base.getDate() + n);
    else if (unit === 'week') base.setDate(base.getDate() + n * 7);
    else if (unit === 'month') base.setMonth(base.getMonth() + n);
  } else {
    // Fallback: 2 weeks from visit
    base.setDate(base.getDate() + 14);
  }
  return base;
}

interface CareHubAppointmentsProps {
  summary: ReleasedVisitSummary;
}

export function CareHubAppointments({ summary }: CareHubAppointmentsProps) {
  const { t, bcp47 } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  // Initialize dates on first render (client-only)
  useState(() => {
    const now = new Date();
    setCurrentMonth(now);
    setToday(now);
  });

  const appointments: Appointment[] = useMemo(() => {
    if (!summary.followUps || summary.followUps.length === 0) return [];
    return summary.followUps.map((fu, i) => ({
      id: `followup-${i}`,
      date: parseTimeframeToDate(summary.visitDate, fu.timeframe),
      provider: fu.provider,
      specialty: fu.reason,
      status: 'pending' as const,
      notes: `Follow-up in ${fu.timeframe}`,
    }));
  }, [summary]);

  const daysInMonth = currentMonth
    ? new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
    : 0;

  const firstDayOfMonth = currentMonth
    ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
    : 0;

  const monthKeys = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ] as const;

  const navigateMonth = (direction: number) => {
    if (!currentMonth) return;
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const getAppointmentsForDay = (day: number) => {
    if (!currentMonth) return [];
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return (
        aptDate.getDate() === day &&
        aptDate.getMonth() === currentMonth.getMonth() &&
        aptDate.getFullYear() === currentMonth.getFullYear()
      );
    });
  };

  const upcomingAppointments = today
    ? appointments
        .filter(apt => apt.date >= today)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
    : [];

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {currentMonth ? `${t(`appointments.${monthKeys[currentMonth.getMonth()]}`)} ${currentMonth.getFullYear()}` : '\u00A0'}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['appointments.sun', 'appointments.mon', 'appointments.tue', 'appointments.wed', 'appointments.thu', 'appointments.fri', 'appointments.sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {t(day)}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-16" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dayAppointments = getAppointmentsForDay(day);
              const isToday =
                today !== null &&
                today.getDate() === day &&
                currentMonth !== null &&
                today.getMonth() === currentMonth.getMonth() &&
                today.getFullYear() === currentMonth.getFullYear();

              return (
                <div
                  key={day}
                  className={`h-16 p-1 border rounded-xl transition-colors ${
                    isToday
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <span className={`text-sm ${isToday ? 'font-bold text-primary' : 'text-foreground'}`}>
                    {day}
                  </span>
                  {dayAppointments.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayAppointments.slice(0, 2).map(apt => (
                        <div
                          key={apt.id}
                          className="text-xs px-1 py-0.5 rounded truncate bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          title={apt.provider}
                        >
                          {apt.specialty}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">{t('appointments.upcoming')}</h2>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">{t('appointments.noUpcoming')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingAppointments.map(apt => (
                <div key={apt.id} className="p-4 hover:bg-muted/30">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-medium text-muted-foreground uppercase">{t('appointments.followUp')}</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      {t('appointments.pending')}
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {apt.provider}
                  </h3>
                  <p className="text-sm text-muted-foreground">{apt.specialty}</p>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {apt.date.toLocaleDateString(bcp47, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {apt.notes}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
