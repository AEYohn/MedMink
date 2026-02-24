/**
 * 15 — Patient Messages (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '15_patient_messages';
export const title = 'Patient Messages';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true });
  await page.goto(`${baseUrl}/patient/messages`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
