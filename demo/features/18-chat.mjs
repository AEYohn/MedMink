/**
 * 18 — Clinical Chat (~10s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '18_chat';
export const title = 'Clinical Chat';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true });
  await page.goto(`${baseUrl}/chat`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
}
