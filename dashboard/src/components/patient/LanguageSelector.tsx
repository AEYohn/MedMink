'use client';

import { Globe } from 'lucide-react';
import { useTranslation, LANGUAGES } from '@/i18n';

export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="relative flex items-center">
      <Globe className="w-4 h-4 text-muted-foreground absolute left-2 pointer-events-none" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="appearance-none pl-7 pr-2 py-1 text-sm text-foreground bg-transparent border border-border rounded-lg hover:border-input focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
        aria-label="Language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
