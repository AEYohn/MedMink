/**
 * 14 — Patient Health Records (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '14_patient_health';
export const title = 'Patient Health Records';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, visitSummaries: true });
  await page.goto(`${baseUrl}/patient/health`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
