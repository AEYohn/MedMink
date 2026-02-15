'use client';

import { useState } from 'react';
import {
  Bell,
  Phone,
  MessageSquare,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Settings,
  Calendar,
  Users,
  RefreshCw,
  Play,
  Pause,
} from 'lucide-react';

interface ReminderCampaign {
  id: string;
  name: string;
  type: 'appointment' | 'recall' | 'custom';
  channel: 'sms' | 'call' | 'email';
  status: 'active' | 'paused' | 'completed';
  sent: number;
  delivered: number;
  responded: number;
  lastRun: Date;
  nextRun: Date | null;
}

interface RecentReminder {
  id: string;
  patientName: string;
  phone: string;
  channel: 'sms' | 'call' | 'email';
  status: 'sent' | 'delivered' | 'failed' | 'responded';
  sentAt: Date;
  message: string;
}

const mockCampaigns: ReminderCampaign[] = [
  {
    id: '1',
    name: 'Appointment Reminders',
    type: 'appointment',
    channel: 'sms',
    status: 'active',
    sent: 156,
    delivered: 152,
    responded: 89,
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000),
  },
  {
    id: '2',
    name: 'Annual Checkup Recall',
    type: 'recall',
    channel: 'call',
    status: 'active',
    sent: 45,
    delivered: 38,
    responded: 22,
    lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    name: 'Lab Results Ready',
    type: 'custom',
    channel: 'email',
    status: 'paused',
    sent: 23,
    delivered: 23,
    responded: 15,
    lastRun: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    nextRun: null,
  },
];

const mockRecentReminders: RecentReminder[] = [
  {
    id: '1',
    patientName: 'John Smith',
    phone: '+1 (555) 123-4567',
    channel: 'sms',
    status: 'delivered',
    sentAt: new Date(Date.now() - 30 * 60 * 1000),
    message: 'Reminder: Your appointment with Dr. Johnson is tomorrow at 10:00 AM.',
  },
  {
    id: '2',
    patientName: 'Maria Garcia',
    phone: '+1 (555) 234-5678',
    channel: 'sms',
    status: 'responded',
    sentAt: new Date(Date.now() - 45 * 60 * 1000),
    message: 'Reminder: Your appointment with Dr. Johnson is tomorrow at 2:30 PM.',
  },
  {
    id: '3',
    patientName: 'Robert Chen',
    phone: '+1 (555) 345-6789',
    channel: 'call',
    status: 'failed',
    sentAt: new Date(Date.now() - 60 * 60 * 1000),
    message: 'Appointment reminder call',
  },
  {
    id: '4',
    patientName: 'Emily Brown',
    phone: '+1 (555) 456-7890',
    channel: 'email',
    status: 'sent',
    sentAt: new Date(Date.now() - 90 * 60 * 1000),
    message: 'Your lab results are ready for review.',
  },
];

const channelConfig = {
  sms: { icon: MessageSquare, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  call: { icon: Phone, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30' },
  email: { icon: Mail, color: 'text-violet-500 bg-violet-100 dark:bg-violet-900/30' },
};

const statusConfig = {
  sent: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Send,
  },
  delivered: {
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  responded: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: CheckCircle2,
  },
  failed: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
};

export default function RemindersPage() {
  const [campaigns] = useState<ReminderCampaign[]>(mockCampaigns);
  const [recentReminders] = useState<RecentReminder[]>(mockRecentReminders);

  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.delivered, 0);
  const totalResponded = campaigns.reduce((sum, c) => sum + c.responded, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            Reminders
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            Manage appointment reminders and patient outreach
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm">
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button className="btn btn-primary">
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Sent (30 days)</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{totalSent}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Delivered</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">
                {totalDelivered}
                <span className="text-sm font-normal text-surface-400 ml-1">
                  ({((totalDelivered / totalSent) * 100).toFixed(0)}%)
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400">Response Rate</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">
                {((totalResponded / totalDelivered) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns */}
      <div className="card">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900 dark:text-white">
            Campaigns
          </h2>
          <button className="btn btn-ghost btn-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <div className="divide-y divide-surface-200 dark:divide-surface-700">
          {campaigns.map((campaign) => {
            const ChannelIcon = channelConfig[campaign.channel].icon;
            return (
              <div
                key={campaign.id}
                className="p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${channelConfig[campaign.channel].color}`}>
                      <ChannelIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-surface-900 dark:text-white">
                          {campaign.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            campaign.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : campaign.status === 'paused'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                          }`}
                        >
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-surface-500 dark:text-surface-400 capitalize">
                        {campaign.type} • {campaign.channel.toUpperCase()}
                      </p>

                      <div className="flex items-center gap-4 mt-2 text-sm text-surface-600 dark:text-surface-400">
                        <span>
                          {campaign.sent} sent • {campaign.delivered} delivered • {campaign.responded} responded
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last: {campaign.lastRun.toLocaleString()}
                        </span>
                        {campaign.nextRun && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Next: {campaign.nextRun.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status === 'active' ? (
                      <button className="btn btn-ghost btn-sm">
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm">
                        <Play className="w-4 h-4" />
                        Resume
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Reminders */}
      <div className="card">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="font-semibold text-surface-900 dark:text-white">
            Recent Reminders
          </h2>
        </div>
        <div className="divide-y divide-surface-200 dark:divide-surface-700">
          {recentReminders.map((reminder) => {
            const ChannelIcon = channelConfig[reminder.channel].icon;
            const StatusIcon = statusConfig[reminder.status].icon;

            return (
              <div
                key={reminder.id}
                className="p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${channelConfig[reminder.channel].color}`}>
                      <ChannelIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-surface-900 dark:text-white">
                          {reminder.patientName}
                        </h3>
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                            statusConfig[reminder.status].color
                          }`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {reminder.status.charAt(0).toUpperCase() + reminder.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {reminder.phone}
                      </p>
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                        {reminder.message}
                      </p>
                      <p className="text-xs text-surface-400 mt-1">
                        {reminder.sentAt.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {reminder.status === 'failed' && (
                    <button className="btn btn-ghost btn-sm text-blue-500">
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Send */}
      <div className="card p-4">
        <h2 className="font-semibold text-surface-900 dark:text-white mb-4">
          Quick Send
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <button className="p-4 bg-surface-50 dark:bg-surface-800/50 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl text-left transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium text-surface-900 dark:text-white">
                  SMS Reminder
                </h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Send to tomorrow's patients
                </p>
              </div>
            </div>
          </button>
          <button className="p-4 bg-surface-50 dark:bg-surface-800/50 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl text-left transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Phone className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-medium text-surface-900 dark:text-white">
                  Voice Call
                </h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Automated reminder calls
                </p>
              </div>
            </div>
          </button>
          <button className="p-4 bg-surface-50 dark:bg-surface-800/50 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl text-left transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <Mail className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h3 className="font-medium text-surface-900 dark:text-white">
                  Email Blast
                </h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Custom email campaign
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
