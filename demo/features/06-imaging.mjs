/**
 * 06 — Medical Imaging (~15-25s)
 * Shows: upload CXR image, show classification results
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CXR_PATH = join(__dirname, '..', 'fixtures', 'sample_cxr.jpg');

export const name = '06_imaging';
export const title = 'Medical Imaging — CXR';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: false, visitSummaries: false });

  // Navigate to imaging page
  await page.goto(`${baseUrl}/imaging`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Upload the CXR image via file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(CXR_PATH);
  await beat(2000);

  // Wait for analysis to complete
  try {
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('Findings') || text.includes('findings') ||
               text.includes('Impression') || text.includes('impression') ||
               text.includes('Analysis') || text.includes('failed');
      },
      { timeout: 60000 }
    );
  } catch {
    console.warn('  Timeout waiting for imaging results, continuing...');
  }
  await beat(2000);

  // Scroll to see results
  await scrollDown(page, 400);
  await beat(2000);

  await scrollDown(page, 300);
  await beat(1500);

  // Scroll back up to see the full view
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(1500);
}
