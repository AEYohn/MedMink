/**
 * 05 — Clinical Charting / SOAP Note (~25-35s)
 * Shows: load example, enhance with MedGemma, SOAP note + compliance score
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { mockChartEnhance, mockComplianceScan } from '../lib/mocks.mjs';

export const name = '05_charting';
export const title = 'Clinical Charting — SOAP Note';

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: false, caseSessions: false, visitSummaries: false });

  // Install API mocks before navigating
  await mockChartEnhance(page);
  await mockComplianceScan(page);

  // Navigate to chart page
  await page.goto(`${baseUrl}/chart`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Click "Try an Example" card
  const exampleCard = page.getByText('Try an Example').first();
  if (await exampleCard.isVisible()) {
    await exampleCard.click();
    await beat(2000);
  }

  // Show the loaded example text
  await beat(1500);

  // Click "Enhance with MedGemma"
  const enhanceBtn = page.locator('button:has-text("Enhance with MedGemma")');
  if (await enhanceBtn.isVisible()) {
    await enhanceBtn.click();
    await beat(1000);

    // Wait for SOAP sections to appear (mocked so should be fast)
    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText;
          return text.includes('Subjective') || text.includes('Objective') || text.includes('Structured');
        },
        { timeout: 15000 }
      );
    } catch {
      console.warn('  Timeout waiting for SOAP enhancement, continuing...');
    }
    await beat(2000);
  }

  // -----------------------------------------------------------------------
  // Scroll through all SOAP sections: Subjective → Objective → Assessment → Plan
  // -----------------------------------------------------------------------
  await scrollDown(page, 350);
  await beat(1500);  // Subjective

  await scrollDown(page, 350);
  await beat(1500);  // Objective

  await scrollDown(page, 350);
  await beat(1500);  // Assessment

  await scrollDown(page, 350);
  await beat(1500);  // Plan

  // Scroll back to top to see compliance score badge
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(2000);

  // -----------------------------------------------------------------------
  // Explore the compliance panel (right column)
  // -----------------------------------------------------------------------

  // Look for the compliance panel / flag list
  const compliancePanel = page.locator('[class*="compliance"], [data-testid="compliance-panel"]').first();
  try {
    if (await compliancePanel.isVisible({ timeout: 3000 })) {
      await compliancePanel.scrollIntoViewIfNeeded();
      await beat(2000);
    }
  } catch {
    // Compliance panel may use different selectors — try scrolling to find it
    await scrollDown(page, 300);
    await beat(1500);
  }

  // Pause on flag list
  await beat(2000);

  // Try to click "Fix" on an auto-fixable flag
  const fixBtn = page.locator('button:has-text("Fix")').first();
  try {
    if (await fixBtn.isVisible({ timeout: 3000 })) {
      await fixBtn.click();
      await beat(2500);
    }
  } catch {
    console.warn('  No visible Fix button, continuing...');
  }

  // Final hold on the compliance score area
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(2500);
}
