'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Plus,
  ChevronLeft,
  ChevronRight,
  Video,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface Appointment {
  id: string;
  date: Date;
  time: string;
  provider: string;
  specialty: string;
  type: 'in-person' | 'telehealth';
  location: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  notes?: string;
}

function createMockAppointments(): Appointment[] {
  const now = Date.now();
  return [
    {
      id: '1',
      date: new Date(now + 2 * 24 * 60 * 60 * 1000),
      time: '10:00 AM',
      provider: 'Dr. Sarah Johnson',
      specialty: 'Primary Care',
      type: 'in-person',
      location: '123 Medical Center Dr',
      status: 'confirmed',
      notes: 'Annual physical exam',
    },
    {
      id: '2',
      date: new Date(now + 7 * 24 * 60 * 60 * 1000),
      time: '2:30 PM',
      provider: 'Dr. Michael Chen',
      specialty: 'Cardiology',
      type: 'telehealth',
      location: 'Video Call',
      status: 'pending',
      notes: 'Follow-up on test results',
    },
  ];
}

const statusConfig = {
  confirmed: {
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: CheckCircle2,
    label: 'Confirmed',
  },
  pending: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertCircle,
    label: 'Pending',
  },
  cancelled: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
    label: 'Cancelled',
  },
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    const now = new Date();
    setAppointments(createMockAppointments());
    setCurrentMonth(now);
    setToday(now);
  }, []);

  const daysInMonth = currentMonth ? new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate() : 0;

  const firstDayOfMonth = currentMonth ? new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay() : 0;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const navigateMonth = (direction: number) => {
    if (!currentMonth) return;
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const getAppointmentsForDay = (day: number) => {
    if (!currentMonth) return [];
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.date);
      return (
        aptDate.getDate() === day &&
        aptDate.getMonth() === currentMonth.getMonth() &&
        aptDate.getFullYear() === currentMonth.getFullYear()
      );
    });
  };

  const upcomingAppointments = today ? appointments
    .filter((apt) => apt.date >= today && apt.status !== 'cancelled')
    .sort((a, b) => a.date.getTime() - b.date.getTime()) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-surface-900 dark:text-white">
                Appointments
              </h1>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                View and manage your healthcare appointments
              </p>
            </div>
          </div>
          <button className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Book Appointment
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
              {currentMonth ? `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}` : '\u00A0'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-surface-500 dark:text-surface-400 py-2"
              >
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-16" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dayAppointments = getAppointmentsForDay(day);
              const isToday = today !== null &&
                today.getDate() === day &&
                currentMonth !== null &&
                today.getMonth() === currentMonth.getMonth() &&
                today.getFullYear() === currentMonth.getFullYear();

              return (
                <div
                  key={day}
                  className={`h-16 p-1 border rounded-lg transition-colors ${
                    isToday
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                  }`}
                >
                  <span
                    className={`text-sm ${
                      isToday
                        ? 'font-bold text-blue-600 dark:text-blue-400'
                        : 'text-surface-700 dark:text-surface-300'
                    }`}
                  >
                    {day}
                  </span>
                  {dayAppointments.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayAppointments.slice(0, 2).map((apt) => (
                        <div
                          key={apt.id}
                          className={`text-xs px-1 py-0.5 rounded truncate ${
                            apt.type === 'telehealth'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}
                        >
                          {apt.time}
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-xs text-surface-400">
                          +{dayAppointments.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="card">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700">
            <h2 className="font-semibold text-surface-900 dark:text-white">
              Upcoming
            </h2>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-sm text-surface-500 dark:text-surface-400">
                No upcoming appointments
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-200 dark:divide-surface-700">
              {upcomingAppointments.map((apt) => {
                const StatusIcon = statusConfig[apt.status].icon;

                return (
                  <div key={apt.id} className="p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {apt.type === 'telehealth' ? (
                          <Video className="w-4 h-4 text-violet-500" />
                        ) : (
                          <Building2 className="w-4 h-4 text-emerald-500" />
                        )}
                        <span className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase">
                          {apt.type}
                        </span>
                      </div>
                      <span
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          statusConfig[apt.status].color
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[apt.status].label}
                      </span>
                    </div>

                    <h3 className="font-medium text-surface-900 dark:text-white">
                      {apt.provider}
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {apt.specialty}
                    </p>

                    <div className="mt-3 space-y-1 text-sm text-surface-600 dark:text-surface-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {apt.date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {apt.time}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {apt.location}
                      </div>
                    </div>

                    {apt.notes && (
                      <p className="mt-2 text-xs text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 px-2 py-1 rounded">
                        {apt.notes}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      {apt.type === 'telehealth' && apt.status === 'confirmed' && (
                        <button className="btn btn-primary btn-sm flex-1">
                          <Video className="w-4 h-4" />
                          Join Call
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm">
                        Reschedule
                      </button>
                      <button className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <button className="card p-4 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-surface-900 dark:text-white">
                Find a Provider
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Search specialists near you
              </p>
            </div>
          </div>
        </button>

        <button className="card p-4 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Video className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-medium text-surface-900 dark:text-white">
                Telehealth Visit
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                See a doctor online
              </p>
            </div>
          </div>
        </button>

        <button className="card p-4 hover:shadow-md transition-shadow text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-medium text-surface-900 dark:text-white">
                Contact Support
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Help with scheduling
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
