/**
 * 20 — Admin Schedule (~10s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '20_admin';
export const title = 'Admin Schedule';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true });
  await page.goto(`${baseUrl}/admin/schedule`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
}
