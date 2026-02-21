'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Calendar,
  Users,
  Bell,
  Phone,
  BarChart3,
  Settings,
  Home,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  {
    href: '/admin/schedule',
    label: 'Schedule',
    icon: Calendar,
    description: 'Manage appointments',
  },
  {
    href: '/admin/patients',
    label: 'Patients',
    icon: Users,
    description: 'Patient directory',
  },
  {
    href: '/admin/reminders',
    label: 'Reminders',
    icon: Bell,
    description: 'SMS & call reminders',
  },
];

const statsItems = [
  { label: "Today's Appointments", value: '12', change: '+2' },
  { label: 'Pending Confirmations', value: '5', change: '-1' },
  { label: 'No-Shows This Week', value: '2', change: '0' },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700">
        {/* Logo */}
        <div className="p-4 border-b border-surface-200 dark:border-surface-700">
          <Link href="/admin/schedule" className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 dark:text-white">
                MedMink Admin
              </h1>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Practice Management
              </p>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-b border-surface-200 dark:border-surface-700">
          <div className="space-y-2">
            {statsItems.map((stat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-700/50 rounded-lg"
              >
                <span className="text-xs text-surface-500 dark:text-surface-400">
                  {stat.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-surface-900 dark:text-white">
                    {stat.value}
                  </span>
                  {stat.change !== '0' && (
                    <span
                      className={`text-xs ${
                        stat.change.startsWith('+')
                          ? 'text-emerald-500'
                          : stat.change.startsWith('-')
                          ? 'text-red-500'
                          : 'text-surface-400'
                      }`}
                    >
                      {stat.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                      : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-surface-700'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs opacity-70">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Links */}
        <div className="p-4 border-t border-surface-200 dark:border-surface-700 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 text-sm text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            Main Dashboard
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-sm text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center justify-between px-4 h-16">
            <Link href="/admin/schedule" className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-surface-900 dark:text-white">
                Admin
              </span>
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
              <nav className="px-4 py-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-900/20'
                          : 'hover:bg-surface-50 dark:hover:bg-surface-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isActive
                              ? 'bg-indigo-100 dark:bg-indigo-900/40'
                              : 'bg-surface-100 dark:bg-surface-700'
                          }`}
                        >
                          <item.icon
                            className={`w-5 h-5 ${
                              isActive
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-surface-500 dark:text-surface-400'
                            }`}
                          />
                        </div>
                        <div>
                          <p
                            className={`font-medium ${
                              isActive
                                ? 'text-indigo-700 dark:text-indigo-400'
                                : 'text-surface-900 dark:text-white'
                            }`}
                          >
                            {item.label}
                          </p>
                          <p className="text-xs text-surface-500 dark:text-surface-400">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-surface-400" />
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
