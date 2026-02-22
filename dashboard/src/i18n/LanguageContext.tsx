'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { LANGUAGES, type Language } from './languages';
import { translate, type Translations } from './translate';
import enTranslations from './locales/en.json';

const STORAGE_KEY = 'medmink-patient-language';

interface LanguageContextValue {
  locale: string;
  setLocale: (code: string) => void;
  language: Language;
  dir: 'ltr' | 'rtl';
  bcp47: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const defaultLanguage = LANGUAGES[0]; // English

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'en',
  setLocale: () => {},
  language: defaultLanguage,
  dir: 'ltr',
  bcp47: 'en-US',
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState('en');
  const [translations, setTranslations] = useState<Translations>(enTranslations);

  // Load persisted locale on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) {
      setLocaleState(stored);
    }
  }, []);

  // Load locale translations when locale changes
  useEffect(() => {
    if (locale === 'en') {
      setTranslations(enTranslations);
      return;
    }
    // Lazy-load non-English locale files
    import(`./locales/${locale}.json`)
      .then((mod) => {
        // Merge with English fallback so missing keys still resolve
        setTranslations({ ...enTranslations, ...mod.default });
      })
      .catch(() => {
        // Fallback to English if locale file not found
        setTranslations(enTranslations);
      });
  }, [locale]);

  const setLocale = useCallback((code: string) => {
    setLocaleState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const language = LANGUAGES.find((l) => l.code === locale) ?? defaultLanguage;

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(translations, key, params),
    [translations],
  );

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        language,
        dir: language.dir,
        bcp47: language.bcp47,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
