'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Heart,
  Stethoscope,
  Pill,
  Calendar,
  Home,
  Menu,
  X,
  User,
  ChevronRight,
} from 'lucide-react';

interface PatientLayoutProps {
  children: ReactNode;
}

const navItems = [
  {
    href: '/patient/symptoms',
    label: 'Symptom Checker',
    icon: Stethoscope,
    description: 'AI-powered symptom analysis',
  },
  {
    href: '/patient/medications',
    label: 'Medications',
    icon: Pill,
    description: 'Track medications & interactions',
  },
  {
    href: '/patient/appointments',
    label: 'Appointments',
    icon: Calendar,
    description: 'Book & manage visits',
  },
];

export default function PatientLayout({ children }: PatientLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/patient/symptoms" className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-surface-900 dark:text-white">
                  MedLit Health
                </h1>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Your health companion
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                        : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-surface-700'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
              <button className="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg">
                <User className="w-5 h-5" />
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
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
                        ? 'bg-rose-50 dark:bg-rose-900/20'
                        : 'hover:bg-surface-50 dark:hover:bg-surface-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isActive
                            ? 'bg-rose-100 dark:bg-rose-900/40'
                            : 'bg-surface-100 dark:bg-surface-700'
                        }`}
                      >
                        <item.icon
                          className={`w-5 h-5 ${
                            isActive
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-surface-500 dark:text-surface-400'
                          }`}
                        />
                      </div>
                      <div>
                        <p
                          className={`font-medium ${
                            isActive
                              ? 'text-rose-700 dark:text-rose-400'
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-surface-200 dark:border-surface-700 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-surface-500 dark:text-surface-400">
            This is not a substitute for professional medical advice. Always consult with a healthcare provider.
          </p>
        </div>
      </footer>
    </div>
  );
}
