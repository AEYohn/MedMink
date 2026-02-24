/**
 * 02i — Derm Foundation — Skin Lesion Classification (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const name = '02i_derm_foundation';
export const title = 'Derm Foundation — Skin Lesion';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const dermPath = join(__dirname, '..', 'sample_images', 'dermoscopy_melanoma_ISIC_0024310.jpg');
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(dermPath);
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('melanoma') ||
      document.body.innerText.includes('Malignancy') ||
      document.body.innerText.includes('Risk'),
      { timeout: 30000 }
    );
  } catch { /* continue */ }
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
