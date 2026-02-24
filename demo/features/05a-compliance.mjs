/**
 * 05a — Compliance Scanning (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { mockComplianceScan } from '../lib/mocks.mjs';

export const name = '05a_compliance';
export const title = 'Compliance Scanning';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await mockComplianceScan(page);

  await page.goto(`${baseUrl}/chart`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const complianceBtn = page.locator('button:has-text("Compliance"), button:has-text("Scan")').first();
  if (await complianceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await complianceBtn.click();
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Grade') ||
      document.body.innerText.includes('Compliance') ||
      document.body.innerText.includes('Score'),
      { timeout: 15000 }
    );
  } catch { /* continue */ }
  await beat(2000);
  await scrollDown(page, 300);
  await beat(1500);
}
