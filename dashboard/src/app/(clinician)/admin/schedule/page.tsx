'use client';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Video,
  Building2,
  Phone,
  Mail,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  date: Date;
  time: string;
  duration: number;
  provider: string;
  type: 'in-person' | 'telehealth' | 'phone';
  status: 'confirmed' | 'pending' | 'checked-in' | 'completed' | 'no-show' | 'cancelled';
  reason: string;
  notes?: string;
}

const mockAppointments: Appointment[] = [
  {
    id: '1',
    patientName: 'John Smith',
    patientPhone: '+1 (555) 123-4567',
    patientEmail: 'john.smith@email.com',
    date: new Date(),
    time: '09:00',
    duration: 30,
    provider: 'Dr. Sarah Johnson',
    type: 'in-person',
    status: 'checked-in',
    reason: 'Annual physical',
  },
  {
    id: '2',
    patientName: 'Maria Garcia',
    patientPhone: '+1 (555) 234-5678',
    patientEmail: 'maria.garcia@email.com',
    date: new Date(),
    time: '09:30',
    duration: 30,
    provider: 'Dr. Sarah Johnson',
    type: 'telehealth',
    status: 'confirmed',
    reason: 'Follow-up consultation',
  },
  {
    id: '3',
    patientName: 'Robert Chen',
    patientPhone: '+1 (555) 345-6789',
    patientEmail: 'robert.chen@email.com',
    date: new Date(),
    time: '10:00',
    duration: 45,
    provider: 'Dr. Sarah Johnson',
    type: 'in-person',
    status: 'pending',
    reason: 'New patient intake',
    notes: 'Referral from Dr. Williams',
  },
  {
    id: '4',
    patientName: 'Emily Brown',
    patientPhone: '+1 (555) 456-7890',
    patientEmail: 'emily.brown@email.com',
    date: new Date(),
    time: '11:00',
    duration: 30,
    provider: 'Dr. Sarah Johnson',
    type: 'phone',
    status: 'confirmed',
    reason: 'Lab results review',
  },
  {
    id: '5',
    patientName: 'Michael Johnson',
    patientPhone: '+1 (555) 567-8901',
    patientEmail: 'michael.j@email.com',
    date: new Date(),
    time: '14:00',
    duration: 30,
    provider: 'Dr. Sarah Johnson',
    type: 'in-person',
    status: 'confirmed',
    reason: 'Blood pressure check',
  },
];

const statusConfig = {
  confirmed: {
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  pending: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertCircle,
  },
  'checked-in': {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: CheckCircle2,
  },
  completed: {
    color: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400',
    icon: CheckCircle2,
  },
  'no-show': {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  cancelled: {
    color: 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-500',
    icon: XCircle,
  },
};

const typeConfig = {
  'in-person': { icon: Building2, color: 'text-emerald-500' },
  telehealth: { icon: Video, color: 'text-violet-500' },
  phone: { icon: Phone, color: 'text-blue-500' },
};

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00',
];

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [appointments] = useState<Appointment[]>(mockAppointments);
  const [view, setView] = useState<'day' | 'week'>('day');

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const todayAppointments = appointments.filter(
    (apt) =>
      apt.date.toDateString() === selectedDate.toDateString() &&
      apt.status !== 'cancelled' &&
      apt.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAppointmentForSlot = (time: string) => {
    return todayAppointments.find((apt) => apt.time === time);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            Schedule
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm">
            <RefreshCw className="w-4 h-4" />
            Sync
          </button>
          <button className="btn btn-primary">
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigateDate(1)}
              className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400" />
            </button>

            {/* View Toggle */}
            <div className="hidden sm:flex items-center gap-1 ml-4 p-1 bg-surface-100 dark:bg-surface-700 rounded-lg">
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  view === 'day'
                    ? 'bg-white dark:bg-surface-600 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  view === 'week'
                    ? 'bg-white dark:bg-surface-600 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients..."
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button className="btn btn-ghost btn-sm">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-surface-200 dark:divide-surface-700">
          {/* Time Slots */}
          <div className="lg:col-span-2">
            <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
              <h2 className="font-semibold text-surface-900 dark:text-white">
                Today's Schedule
              </h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {todayAppointments.length} appointments
              </p>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {timeSlots.map((time) => {
                const appointment = getAppointmentForSlot(time);
                const TypeIcon = appointment ? typeConfig[appointment.type].icon : null;

                return (
                  <div
                    key={time}
                    className={`flex border-b border-surface-100 dark:border-surface-800 ${
                      appointment
                        ? 'bg-white dark:bg-surface-800'
                        : 'bg-surface-50/50 dark:bg-surface-900/30'
                    }`}
                  >
                    {/* Time */}
                    <div className="w-20 sm:w-24 flex-shrink-0 px-3 py-3 text-sm text-surface-500 dark:text-surface-400 font-medium">
                      {formatTime(time)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 p-3">
                      {appointment ? (
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg bg-surface-100 dark:bg-surface-700 ${
                              typeConfig[appointment.type].color
                            }`}
                          >
                            {TypeIcon && <TypeIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-medium text-surface-900 dark:text-white">
                                  {appointment.patientName}
                                </h3>
                                <p className="text-sm text-surface-500 dark:text-surface-400">
                                  {appointment.reason} • {appointment.duration} min
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                                    statusConfig[appointment.status].color
                                  }`}
                                >
                                  {appointment.status.replace('-', ' ')}
                                </span>
                                <button className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700 rounded">
                                  <MoreVertical className="w-4 h-4 text-surface-400" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {appointment.patientPhone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {appointment.patientEmail}
                              </span>
                            </div>
                            {appointment.notes && (
                              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                Note: {appointment.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-8 flex items-center">
                          <button className="text-xs text-surface-400 hover:text-indigo-500 transition-colors">
                            + Add appointment
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
              <h2 className="font-semibold text-surface-900 dark:text-white">
                Quick Stats
              </h2>
            </div>

            <div className="p-4 space-y-4">
              {/* Status Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase mb-3">
                  By Status
                </h3>
                <div className="space-y-2">
                  {[
                    { status: 'confirmed', label: 'Confirmed', count: 3 },
                    { status: 'pending', label: 'Pending', count: 1 },
                    { status: 'checked-in', label: 'Checked In', count: 1 },
                  ].map(({ status, label, count }) => {
                    const config = statusConfig[status as keyof typeof statusConfig];
                    const StatusIcon = config.icon;
                    return (
                      <div
                        key={status}
                        className="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-sm text-surface-700 dark:text-surface-300">
                            {label}
                          </span>
                        </div>
                        <span className="font-semibold text-surface-900 dark:text-white">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By Type */}
              <div>
                <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase mb-3">
                  By Type
                </h3>
                <div className="space-y-2">
                  {[
                    { type: 'in-person', label: 'In-Person', count: 3 },
                    { type: 'telehealth', label: 'Telehealth', count: 1 },
                    { type: 'phone', label: 'Phone', count: 1 },
                  ].map(({ type, label, count }) => {
                    const config = typeConfig[type as keyof typeof typeConfig];
                    const TypeIcon = config.icon;
                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <TypeIcon className={`w-4 h-4 ${config.color}`} />
                          <span className="text-sm text-surface-700 dark:text-surface-300">
                            {label}
                          </span>
                        </div>
                        <span className="font-semibold text-surface-900 dark:text-white">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-surface-200 dark:border-surface-700 space-y-2">
                <button className="btn btn-ghost btn-sm w-full justify-start">
                  <Phone className="w-4 h-4" />
                  Send Reminders
                </button>
                <button className="btn btn-ghost btn-sm w-full justify-start">
                  <Mail className="w-4 h-4" />
                  Email Confirmations
                </button>
                <button className="btn btn-ghost btn-sm w-full justify-start">
                  <Calendar className="w-4 h-4" />
                  Print Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
