/**
 * 11 — Patient Intake Form (~15s)
 */
import { beat, waitForPageReady, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '11_patient_intake';
export const title = 'Patient Intake Form';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true });
  await page.goto(`${baseUrl}/patient/intake`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  // Fill in patient info if form fields are visible
  const nameInput = page.locator('input[placeholder*="name"], input[name*="name"]').first();
  if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await slowTypeLocator(nameInput, 'Maria Garcia', 40);
    await beat(500);
  }

  await scrollDown(page, 400);
  await beat(2000);
  await scrollDown(page, 400);
  await beat(2000);
}
