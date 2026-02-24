/**
 * 16 — Post-Visit Summary (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '16_postvisit';
export const title = 'Post-Visit Summary';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, visitSummaries: true });
  // Use a placeholder visit ID — seed data should have at least one
  await page.goto(`${baseUrl}/patient/postvisit/visit-1`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
