export type Translations = Record<string, string>;

/**
 * Look up a dot-key in a flat translations object and interpolate {var} placeholders.
 * Falls back to the key itself if not found.
 */
export function translate(
  translations: Translations,
  key: string,
  params?: Record<string, string | number>,
): string {
  let value = translations[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
}
