/**
 * 08b — New Patient Registration (~15s)
 */
import { beat, waitForPageReady, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '08b_new_patient';
export const title = 'New Patient Registration';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true });
  await page.goto(`${baseUrl}/patients/new`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  // Fill in basic patient info
  const firstInput = page.locator('input').first();
  if (await firstInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await slowTypeLocator(firstInput, 'James', 50);
    await beat(500);
  }

  await scrollDown(page, 400);
  await beat(2000);
  await scrollDown(page, 400);
  await beat(2000);
}
