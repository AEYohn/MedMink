/**
 * 02k — Drug Properties via TxGemma (~15s)
 */
import { beat, waitForPageReady, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '02k_drug_properties';
export const title = 'Drug Properties (TxGemma)';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const drugInput = page.locator('input[placeholder*="drug"], input[placeholder*="Drug"], input[placeholder*="medication"]').first();
  if (await drugInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await slowTypeLocator(drugInput, 'amiodarone', 50);
    await beat(500);

    const lookupBtn = page.locator('button:has-text("Look"), button:has-text("Search"), button:has-text("Check")').first();
    if (await lookupBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lookupBtn.click();
    } else {
      await drugInput.press('Enter');
    }
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Mechanism') ||
      document.body.innerText.includes('Properties') ||
      document.body.innerText.includes('amiodarone'),
      { timeout: 20000 }
    );
  } catch { /* continue */ }
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
