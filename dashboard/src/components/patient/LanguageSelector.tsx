'use client';

import { Globe } from 'lucide-react';
import { useTranslation, LANGUAGES } from '@/i18n';

export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="relative flex items-center">
      <Globe className="w-4 h-4 text-slate-400 absolute left-2 pointer-events-none" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="appearance-none pl-7 pr-2 py-1 text-sm text-slate-600 bg-transparent border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer"
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
