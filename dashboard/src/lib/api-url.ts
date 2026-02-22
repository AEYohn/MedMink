/**
 * Returns the backend API base URL for client-side fetches.
 *
 * Always returns empty string so fetches use relative paths (e.g. `/api/...`).
 * The Next.js rewrite in next.config.js proxies these to the backend,
 * keeping all browser requests same-origin (avoids cross-origin blocks
 * on school/enterprise networks).
 *
 * NEXT_PUBLIC_API_URL is used only by next.config.js for the rewrite
 * destination — it should NOT be used directly in client fetch calls.
 */
export function getApiUrl(): string {
  // Server-side (next.config.js): return the real URL for rewrite config
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || '';
  }
  // Client-side: always use relative paths (proxied by Next.js rewrite)
  return '';
}
