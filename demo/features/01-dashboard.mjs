/**
 * 01 — Dashboard overview (~12s)
 * Shows: stat cards, quick actions, recent cases, patient lookup
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '01_dashboard';
export const title = 'Dashboard Overview';

export async function record(page, baseUrl) {
  // Seed patients and case sessions so dashboard shows data
  await seedLocalStorage(page, { patients: true, caseSessions: true, visitSummaries: true });

  // Navigate to dashboard
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  // Hover over stat cards to show interactivity
  const activeCasesText = page.getByText('Active Cases').first();
  if (await activeCasesText.isVisible({ timeout: 5000 }).catch(() => false)) {
    await activeCasesText.hover();
    await beat(1000);
  }

  const patientsText = page.getByText('Patients').first();
  if (await patientsText.isVisible({ timeout: 2000 }).catch(() => false)) {
    await patientsText.hover();
    await beat(800);
  }

  // Demonstrate patient lookup — use partial placeholder match
  const searchInput = page.locator('input[placeholder*="Name or MRN"]');
  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchInput.click();
    await beat(300);
    await searchInput.pressSequentially('Santos', { delay: 60 });
    await beat(1500);
    await searchInput.clear();
    await beat(500);
  }

  // Scroll down to see quick actions and recent cases
  await scrollDown(page, 400);
  await beat(1500);

  // Hover over "New Case Analysis" quick action
  const newCase = page.getByText('New Case Analysis').first();
  if (await newCase.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newCase.hover();
    await beat(1000);
  }

  // Scroll back up
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(1500);
}
