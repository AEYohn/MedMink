/**
 * 02m — New Findings & Reassessment (~20s)
 */
import { beat, waitForPageReady, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '02m_reassessment';
export const title = 'New Findings & Reassessment';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  const addFindingsBtn = page.locator('button:has-text("Add Finding"), button:has-text("New Finding")').first();
  if (await addFindingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addFindingsBtn.click();
    await beat(1000);

    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slowTypeLocator(textarea, 'Repeat troponin I now 4.2 ng/mL (up from 0.82). ECG shows new Q waves in V2-V4.', 30);
      await beat(1000);
    }

    const submitBtn = page.locator('button:has-text("Reassess"), button:has-text("Submit"), button:has-text("Add")').first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();
      await beat(5000);
    }
  }

  await scrollDown(page, 400);
  await beat(2000);
}
