/**
 * 03a — Multilingual Interview (~20s)
 */
import { beat, waitForPageReady, slowTypeLocator } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { mockInterviewStart, mockInterviewRespond, mockManagementPlan } from '../lib/mocks.mjs';

export const name = '03a_multilingual';
export const title = 'Multilingual Interview';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: false, caseSessions: false });
  await mockInterviewStart(page);
  await mockInterviewRespond(page);
  await mockManagementPlan(page);

  await page.goto(`${baseUrl}/interview`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const langSelect = page.locator('select, [role="combobox"], button:has-text("English")').first();
  if (await langSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await langSelect.click();
    await beat(500);

    const spanishOption = page.locator('option[value="es"], [role="option"]:has-text("Español"), li:has-text("Español")').first();
    if (await spanishOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await spanishOption.click();
    } else {
      await langSelect.selectOption('es').catch(() => {});
    }
    await beat(1000);
  }

  const startBtn = page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Iniciar")').first();
  if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startBtn.click();
    await beat(3000);
  }

  const input = page.locator('input[placeholder*="response"], input[placeholder*="respuesta"], textarea').first();
  if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
    await slowTypeLocator(input, 'Tengo un dolor fuerte en el pecho desde esta mañana', 40);
    await beat(500);
    await input.press('Enter');
    await beat(3000);
  }

  await beat(2000);
}
