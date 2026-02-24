/**
 * 02n — Follow-Up Clinical Chat (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '02n_followup_chat';
export const title = 'Follow-Up Clinical Chat';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const chatToggle = page.locator('button:has-text("Follow-Up"), button:has-text("Chat"), button:has-text("Ask")').first();
  if (await chatToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatToggle.click();
    await beat(1000);
  }

  const chatInput = page.locator('input[placeholder*="question"], input[placeholder*="ask"], textarea[placeholder*="question"]').first();
  if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await chatInput.scrollIntoViewIfNeeded();
    await beat(500);
    await chatInput.click({ force: true });
    await beat(300);
    await chatInput.fill('Should we consider fibrinolytics if cath lab delay exceeds 120 minutes?');
    await beat(500);
    await chatInput.press('Enter');
    await beat(5000);
  }

  await scrollDown(page, 300);
  await beat(2000);
}
