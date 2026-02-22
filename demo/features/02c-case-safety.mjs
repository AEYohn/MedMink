/**
 * 02c — Case Analysis: Safety Tab (Interactive)
 * Shows: Safety alerts panel with severity badges, Run Check, acknowledge/note flow.
 * Interactive: Runs medication safety check, acknowledges alerts with notes, expands acknowledged section.
 */
import { beat, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { loadSeededCase, scrollToTop } from '../lib/case-helpers.mjs';
import { mockMedicationSafety } from '../lib/mocks.mjs';

export const name = '02c_case_safety';
export const title = 'Case Analysis — Safety Tab';

export async function record(page, baseUrl) {
  await loadSeededCase(page, baseUrl, {
    extraMocks: async (p) => {
      await mockMedicationSafety(p);
    },
  });

  // Click the Safety tab
  const safetyTab = page.locator('[role="tab"]:has-text("Safety")');
  try {
    await safetyTab.waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    console.warn('  Safety tab not visible, skipping...');
    return;
  }
  await safetyTab.click();
  await beat(2500);

  // ── 1. Click "Run Check" to trigger medication safety analysis ───────
  try {
    const runCheckBtn = page.locator('button:has-text("Run Check")');
    await runCheckBtn.waitFor({ state: 'visible', timeout: 5000 });
    await runCheckBtn.click();
    await beat(500);

    // Wait for safety results to render (mock returns after 1.2s delay)
    await page.waitForFunction(
      () => document.body.innerText.includes('Ticagrelor') ||
            document.body.innerText.includes('Drug Interaction') ||
            document.body.innerText.includes('unacked'),
      { timeout: 10000 }
    ).catch(() => {});
    await beat(2500);
  } catch {
    console.warn('  Run Check button not found, continuing...');
  }

  // Scroll to see all alerts
  await scrollDown(page, 400);
  await beat(2000);

  // ── 2. Acknowledge first alert (MgSO4 + Nifedipine) ─────────────────
  try {
    const ackBtns = page.locator('button:has-text("Acknowledge")');
    const firstAck = ackBtns.first();
    if (await firstAck.count() > 0) {
      await firstAck.click();
      await beat(1500);
    }
  } catch {
    // Acknowledge button not found — continue
  }

  // ── 3. Add a note on second alert, then acknowledge ──────────────────
  try {
    // Click "Note" button on the next unacknowledged alert
    const noteBtns = page.locator('button:has-text("Note")');
    const firstNote = noteBtns.first();
    if (await firstNote.count() > 0) {
      await firstNote.click();
      await beat(800);

      // Type into the note textarea
      const noteArea = page.locator('textarea[placeholder*="Aware, benefit"]').first();
      if (await noteArea.count() > 0) {
        await slowTypeLocator(noteArea, 'Aware - morphine given once for severe pain, monitoring ticagrelor effect', 25);
        await beat(1000);
      }

      // Now acknowledge this alert (with the note)
      const ackBtn = page.locator('button:has-text("Acknowledge")').first();
      if (await ackBtn.count() > 0) {
        await ackBtn.click();
        await beat(1500);
      }
    }
  } catch {
    // Note flow not available — continue
  }

  // ── 4. Scroll to see remaining alerts ────────────────────────────────
  await scrollDown(page, 400);
  await beat(2000);

  // Acknowledge one more alert if available
  try {
    const ackBtn = page.locator('button:has-text("Acknowledge")').first();
    if (await ackBtn.count() > 0) {
      await ackBtn.click();
      await beat(1200);
    }
  } catch {
    // No more acknowledge buttons — continue
  }

  // ── 5. Expand the "acknowledged alerts" collapsed section ────────────
  await scrollDown(page, 300);
  await beat(1000);

  try {
    const ackedSection = page.locator('button:has-text("acknowledged alert")').first();
    if (await ackedSection.count() > 0) {
      await ackedSection.click();
      await beat(2000);
      await scrollDown(page, 300);
      await beat(2000);
    }
  } catch {
    // No acknowledged section — continue
  }

  // ── 6. Return to top ────────────────────────────────────────────────
  await scrollToTop(page);
  await beat(1500);
}
