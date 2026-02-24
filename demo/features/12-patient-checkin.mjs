/**
 * 12 — Patient Self Check-In (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '12_patient_checkin';
export const title = 'Patient Self Check-In';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true });
  await page.goto(`${baseUrl}/patient/checkin`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
