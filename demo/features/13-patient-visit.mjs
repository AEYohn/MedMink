/**
 * 13 — Patient Active Visit (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '13_patient_visit';
export const title = 'Patient Active Visit';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, visitSummaries: true });
  await page.goto(`${baseUrl}/patient/visit`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
