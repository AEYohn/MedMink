/**
 * 02o — Case Timeline (~10s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '02o_case_timeline';
export const title = 'Case Timeline';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const timelineBtn = page.locator('button:has-text("Timeline"), [role="tab"]:has-text("Timeline")').first();
  if (await timelineBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await timelineBtn.click();
    await beat(2000);
  }

  await scrollDown(page, 300);
  await beat(1500);
  await scrollDown(page, 300);
  await beat(1500);
}
