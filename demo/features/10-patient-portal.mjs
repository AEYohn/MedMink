/**
 * 10 — Patient Portal: Visit Summary (~10-15s)
 * Shows: visit summary with diagnosis, meds, instructions, red flags
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '10_patient_portal';
export const title = 'Patient Portal — Care Hub';

export async function record(page, baseUrl) {
  // Seed visit summaries
  await seedLocalStorage(page, { patients: true, caseSessions: true, visitSummaries: true });

  // Navigate to patient Care Hub
  await page.goto(`${baseUrl}/patient`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  // The first summary should be expanded by default
  // Scroll through the visit summary content
  await scrollDown(page, 300);
  await beat(1500);

  // Scroll to see medications table
  await scrollDown(page, 300);
  await beat(1500);

  // Scroll to see discharge instructions
  await scrollDown(page, 300);
  await beat(1500);

  // Scroll to see follow-ups and red flags
  await scrollDown(page, 300);
  await beat(2000);

  // Scroll to see restrictions and disclaimer
  await scrollDown(page, 300);
  await beat(1500);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(1500);
}
