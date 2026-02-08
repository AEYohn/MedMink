'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { FileText, Lightbulb, Beaker, ChevronRight } from 'lucide-react';

export type EntityType = 'paper' | 'claim' | 'technique';

interface EntityLinkProps {
  type: EntityType;
  id: string;
  title: string;
  children?: ReactNode;
  className?: string;
  showIcon?: boolean;
  showArrow?: boolean;
  variant?: 'default' | 'inline' | 'card';
}

export function EntityLink({
  type,
  id,
  title,
  children,
  className = '',
  showIcon = true,
  showArrow = false,
  variant = 'default',
}: EntityLinkProps) {
  const href = `/${type}/${id}`;

  const getIcon = () => {
    switch (type) {
      case 'paper':
        return <FileText className="w-4 h-4" />;
      case 'claim':
        return <Lightbulb className="w-4 h-4" />;
      case 'technique':
        return <Beaker className="w-4 h-4" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'paper':
        return 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300';
      case 'claim':
        return 'text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300';
      case 'technique':
        return 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300';
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'paper':
        return 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800';
      case 'claim':
        return 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border-purple-200 dark:border-purple-800';
      case 'technique':
        return 'bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800';
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'paper':
        return 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400';
      case 'claim':
        return 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400';
      case 'technique':
        return 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400';
    }
  };

  // If children are provided, wrap them in a link
  if (children) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  // Inline variant - just text with icon
  if (variant === 'inline') {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 ${getColor()} transition-colors font-medium ${className}`}
      >
        {showIcon && getIcon()}
        <span className="hover:underline">{title}</span>
        {showArrow && <ChevronRight className="w-3 h-3" />}
      </Link>
    );
  }

  // Card variant - full card style
  if (variant === 'card') {
    return (
      <Link
        href={href}
        className={`block p-4 rounded-xl ${getBgColor()} border hover:shadow-md transition-all group ${className}`}
      >
        <div className="flex items-center gap-3">
          {showIcon && (
            <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${getIconBg()}`}>
              {getIcon()}
            </span>
          )}
          <span className={`flex-1 text-sm font-medium truncate ${getColor()}`}>{title}</span>
          {showArrow && (
            <ChevronRight className="w-4 h-4 text-surface-400 group-hover:translate-x-1 transition-transform" />
          )}
        </div>
      </Link>
    );
  }

  // Default variant - button-like
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${getBgColor()} ${getColor()} text-sm font-medium transition-all hover:shadow-sm ${className}`}
    >
      {showIcon && getIcon()}
      <span className="truncate max-w-[200px]">{title}</span>
      {showArrow && <ChevronRight className="w-3 h-3" />}
    </Link>
  );
}

// Convenience components for each type
export function PaperLink({ id, title, ...props }: Omit<EntityLinkProps, 'type'>) {
  return <EntityLink type="paper" id={id} title={title} {...props} />;
}

export function ClaimLink({ id, title, ...props }: Omit<EntityLinkProps, 'type'>) {
  return <EntityLink type="claim" id={id} title={title} {...props} />;
}

export function TechniqueLink({ id, title, ...props }: Omit<EntityLinkProps, 'type'>) {
  return <EntityLink type="technique" id={id} title={title} {...props} />;
}
