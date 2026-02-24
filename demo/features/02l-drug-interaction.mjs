/**
 * 02l — Drug Interaction Check via TxGemma (~15s)
 */
import { beat, waitForPageReady, slowTypeLocator } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '02l_drug_interaction';
export const title = 'Drug Interaction (TxGemma)';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const inputs = page.locator('input[placeholder*="rug"]');
  if (await inputs.count() >= 2) {
    await slowTypeLocator(inputs.nth(0), 'warfarin', 50);
    await beat(300);
    await slowTypeLocator(inputs.nth(1), 'amiodarone', 50);
    await beat(500);

    const checkBtn = page.locator('button:has-text("Check"), button:has-text("Interact")').first();
    if (await checkBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkBtn.click();
    }
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Interaction') ||
      document.body.innerText.includes('Severity') ||
      document.body.innerText.includes('warfarin'),
      { timeout: 20000 }
    );
  } catch { /* continue */ }
  await beat(2000);
}
