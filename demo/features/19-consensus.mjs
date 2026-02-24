/**
 * 19 — Cross-Modal Consensus (~10s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '19_consensus';
export const title = 'Cross-Modal Consensus';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/consensus`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
}
