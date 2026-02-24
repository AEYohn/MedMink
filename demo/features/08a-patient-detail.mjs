/**
 * 08a — Patient Detail View (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '08a_patient_detail';
export const title = 'Patient Detail View';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true, visitSummaries: true });
  // Navigate to patients list first, then click the first patient
  await page.goto(`${baseUrl}/patients`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Click the first patient link/card
  const patientLink = page.locator('a[href*="/patients/"], tr:has-text("Patient"), [role="row"]').first();
  if (await patientLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await patientLink.click();
    await waitForPageReady(page);
    await beat(2000);
  }

  await scrollDown(page, 400);
  await beat(2000);
  await scrollDown(page, 400);
  await beat(2000);
}
