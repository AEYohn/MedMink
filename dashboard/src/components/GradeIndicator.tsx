'use client';

import { Shield, CheckCircle, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

interface GradeIndicatorProps {
  grade: 'high' | 'moderate' | 'low' | 'very_low' | 'insufficient';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showDescription?: boolean;
}

const gradeConfig = {
  high: {
    label: 'High',
    description: 'Further research very unlikely to change confidence',
    icon: CheckCircle,
    color: 'emerald',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    iconBgClass: 'bg-emerald-500',
  },
  moderate: {
    label: 'Moderate',
    description: 'Further research likely to have important impact',
    icon: Shield,
    color: 'blue',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
    iconBgClass: 'bg-blue-500',
  },
  low: {
    label: 'Low',
    description: 'Further research very likely to have important impact',
    icon: AlertTriangle,
    color: 'amber',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800',
    iconBgClass: 'bg-amber-500',
  },
  very_low: {
    label: 'Very Low',
    description: 'Estimate very uncertain',
    icon: AlertCircle,
    color: 'red',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    borderClass: 'border-red-200 dark:border-red-800',
    iconBgClass: 'bg-red-500',
  },
  insufficient: {
    label: 'Insufficient',
    description: 'Not enough evidence to assess',
    icon: HelpCircle,
    color: 'gray',
    bgClass: 'bg-surface-100 dark:bg-surface-800',
    textClass: 'text-surface-600 dark:text-surface-400',
    borderClass: 'border-surface-200 dark:border-surface-700',
    iconBgClass: 'bg-surface-500',
  },
};

const sizeConfig = {
  sm: {
    container: 'px-2 py-1',
    icon: 'w-3 h-3',
    iconPadding: 'p-1',
    text: 'text-xs',
    descText: 'text-xs',
  },
  md: {
    container: 'px-3 py-1.5',
    icon: 'w-4 h-4',
    iconPadding: 'p-1.5',
    text: 'text-sm',
    descText: 'text-xs',
  },
  lg: {
    container: 'px-4 py-2',
    icon: 'w-5 h-5',
    iconPadding: 'p-2',
    text: 'text-base',
    descText: 'text-sm',
  },
};

export function GradeIndicator({
  grade,
  size = 'md',
  showLabel = true,
  showDescription = false,
}: GradeIndicatorProps) {
  const config = gradeConfig[grade] || gradeConfig.insufficient;
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`inline-flex items-center gap-2 ${sizeStyles.container} ${config.bgClass} border ${config.borderClass} rounded-lg`}
      >
        <div className={`${sizeStyles.iconPadding} ${config.iconBgClass} rounded-md`}>
          <Icon className={`${sizeStyles.icon} text-white`} />
        </div>
        {showLabel && (
          <span className={`font-semibold ${sizeStyles.text} ${config.textClass}`}>
            {config.label}
          </span>
        )}
      </div>
      {showDescription && (
        <p className={`${sizeStyles.descText} text-surface-500 dark:text-surface-400`}>
          {config.description}
        </p>
      )}
    </div>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const normalizedGrade = grade.toLowerCase().replace(' ', '_') as keyof typeof gradeConfig;
  const config = gradeConfig[normalizedGrade] || gradeConfig.insufficient;

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${config.bgClass} ${config.textClass}`}>
      GRADE: {config.label}
    </span>
  );
}
