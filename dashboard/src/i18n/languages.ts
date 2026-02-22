export interface Language {
  code: string;
  label: string;
  bcp47: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', bcp47: 'en-US', dir: 'ltr' },
  { code: 'es', label: 'Español', bcp47: 'es-US', dir: 'ltr' },
  { code: 'zh', label: '中文', bcp47: 'zh-CN', dir: 'ltr' },
  { code: 'ms', label: 'Bahasa Melayu', bcp47: 'ms-MY', dir: 'ltr' },
  { code: 'ta', label: 'தமிழ்', bcp47: 'ta-IN', dir: 'ltr' },
  { code: 'vi', label: 'Tiếng Việt', bcp47: 'vi-VN', dir: 'ltr' },
  { code: 'ar', label: 'العربية', bcp47: 'ar-SA', dir: 'rtl' },
  { code: 'fr', label: 'Français', bcp47: 'fr-FR', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', bcp47: 'de-DE', dir: 'ltr' },
  { code: 'pt', label: 'Português', bcp47: 'pt-BR', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', bcp47: 'hi-IN', dir: 'ltr' },
  { code: 'bn', label: 'বাংলা', bcp47: 'bn-BD', dir: 'ltr' },
  { code: 'ko', label: '한국어', bcp47: 'ko-KR', dir: 'ltr' },
  { code: 'ja', label: '日本語', bcp47: 'ja-JP', dir: 'ltr' },
  { code: 'ru', label: 'Русский', bcp47: 'ru-RU', dir: 'ltr' },
  { code: 'th', label: 'ไทย', bcp47: 'th-TH', dir: 'ltr' },
  { code: 'tl', label: 'Filipino', bcp47: 'fil-PH', dir: 'ltr' },
  { code: 'he', label: 'עברית', bcp47: 'he-IL', dir: 'rtl' },
  { code: 'ur', label: 'اردو', bcp47: 'ur-PK', dir: 'rtl' },
  { code: 'fa', label: 'فارسی', bcp47: 'fa-IR', dir: 'rtl' },
  { code: 'id', label: 'Indonesia', bcp47: 'id-ID', dir: 'ltr' },
  { code: 'sw', label: 'Kiswahili', bcp47: 'sw-KE', dir: 'ltr' },
  { code: 'am', label: 'አማርኛ', bcp47: 'am-ET', dir: 'ltr' },
];

export const RTL_LANGUAGES = new Set(['ar', 'he', 'ur', 'fa']);
