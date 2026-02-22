/**
 * 07 — Lab Report Extraction (~15-20s)
 * Shows: upload lab photo, show extracted values table
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAB_PATH = join(__dirname, '..', 'fixtures', 'sample_lab.jpg');

export const name = '07_labs';
export const title = 'Lab Report Extraction';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: false, visitSummaries: false });

  // Navigate to labs page
  await page.goto(`${baseUrl}/labs`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Upload the lab image via file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(LAB_PATH);
  await beat(2000);

  // Wait for extraction to complete
  try {
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('Extracted') || text.includes('labs') ||
               text.includes('Test') || text.includes('Result') ||
               text.includes('failed') || text.includes('error');
      },
      { timeout: 60000 }
    );
  } catch {
    console.warn('  Timeout waiting for lab extraction, continuing...');
  }
  await beat(2000);

  // Scroll to see extracted values
  await scrollDown(page, 400);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(1500);

  // Scroll back up
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(1500);
}
