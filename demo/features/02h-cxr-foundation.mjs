/**
 * 02h — CXR Foundation — Chest X-Ray Classification (~15s)
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const name = '02h_cxr_foundation';
export const title = 'CXR Foundation — Chest X-Ray';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const imgTab = page.locator('button:has-text("Imaging"), [role="tab"]:has-text("Imaging")').first();
  if (await imgTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await imgTab.click();
    await beat(1000);
  }

  const cxrPath = join(__dirname, '..', 'sample_images', 'chest_xray_pneumonia_lobar.jpg');
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(cxrPath);
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Classification') ||
      document.body.innerText.includes('Probability') ||
      document.body.innerText.includes('findings'),
      { timeout: 30000 }
    );
  } catch { /* continue */ }
  await beat(2000);
  await scrollDown(page, 400);
  await beat(2000);
}
