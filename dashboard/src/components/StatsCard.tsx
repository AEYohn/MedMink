'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'brand' | 'blue' | 'purple' | 'cyan' | 'emerald' | 'amber';
  className?: string;
}

const colorClasses = {
  brand: {
    bg: 'bg-gradient-to-br from-brand-500 to-brand-600',
    light: 'bg-brand-100 dark:bg-brand-900/30',
    text: 'text-brand-600 dark:text-brand-400',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    light: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    light: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
  },
  cyan: {
    bg: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
    light: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-600 dark:text-cyan-400',
  },
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    light: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    light: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
};

export function StatsCard({ title, value, icon, trend, color = 'brand', className }: StatsCardProps) {
  const colors = colorClasses[color];

  return (
    <div
      className={clsx(
        'card p-5 hover:shadow-lg transition-all duration-300 group animate-fade-in',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
            {title}
          </p>
          <p className="text-3xl font-bold text-surface-900 dark:text-white mt-2 tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={clsx(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  trend.isPositive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-surface-400">vs last week</span>
            </div>
          )}
        </div>
        <div className={clsx(
          'p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform',
          colors.bg
        )}>
          <div className="text-white">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
