/**
 * 02j — Pathology Foundation — Tissue Classification (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const name = '02j_path_foundation';
export const title = 'Path Foundation — Pathology';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const pathPath = join(__dirname, '..', 'sample_images', 'pathology_breast_carcinoma_HE.jpg');
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(pathPath);
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Tumor') ||
      document.body.innerText.includes('Classification') ||
      document.body.innerText.includes('Tissue'),
      { timeout: 30000 }
    );
  } catch { /* continue */ }
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}
