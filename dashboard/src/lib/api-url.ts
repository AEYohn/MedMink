/**
 * Returns the backend API URL from environment, or null if not configured.
 * No localhost fallback — on Vercel (or any deployment without env var),
 * callers should show a "backend not configured" message.
 */
export function getApiUrl(): string | null {
  return process.env.NEXT_PUBLIC_API_URL || null;
}
