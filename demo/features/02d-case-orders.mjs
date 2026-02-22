/**
 * 02d — Case Analysis: Orders Tab (Interactive)
 * Generates discharge plan, referral note, handoff, and previews patient release.
 * Interactive: Edits discharge meds, adds medication row, edits patient instructions.
 */
import { beat, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { loadSeededCase, scrollToTop } from '../lib/case-helpers.mjs';
import { mockDischargePlan, mockReferral, mockHandoff } from '../lib/mocks.mjs';

export const name = '02d_case_orders';
export const title = 'Case Analysis — Orders Tab';

export async function record(page, baseUrl) {
  await loadSeededCase(page, baseUrl, {
    extraMocks: async (p) => {
      await mockDischargePlan(p);
      await mockReferral(p);
      await mockHandoff(p);
    },
  });

  // Click the Orders tab
  const ordersTab = page.locator('[role="tab"]:has-text("Orders")');
  try {
    await ordersTab.waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    console.warn('  Orders tab not visible, skipping...');
    return;
  }
  await ordersTab.click();
  await beat(2500);

  // ── 1. Discharge Plan ──────────────────────────────────────────────────
  const genDischargeBtn = page.locator('button:has-text("Generate Discharge Plan")');
  try {
    await genDischargeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await genDischargeBtn.click();
    await beat(500);
    // Wait for discharge plan content to render (medication table, red flags, etc.)
    await page.waitForFunction(
      () => document.body.innerText.includes('Medication Reconciliation') ||
            document.body.innerText.includes('medication') ||
            document.body.innerText.includes('Ticagrelor'),
      { timeout: 15000 }
    ).catch(() => {});
    await beat(2000);

    // Scroll through medication reconciliation table
    await scrollDown(page, 400);
    await beat(2000);

    // ── 1a. Click action badge on first med to cycle (stop → continue) ──
    try {
      const actionBadges = page.locator('button:has([class*="Badge"], [class*="badge"])').filter({
        hasText: /stop|continue|new|discontinue/i,
      });
      const firstBadge = actionBadges.first();
      if (await firstBadge.count() > 0) {
        await firstBadge.click();
        await beat(1200);
      }
    } catch {
      // Action badge cycling not available
    }

    // ── 1b. Click "Add Med" → fill in a new medication row ──────────────
    try {
      const addMedBtn = page.locator('button:has-text("Add Med")');
      if (await addMedBtn.count() > 0) {
        await addMedBtn.click();
        await beat(800);

        // Fill the new empty row — last row's inputs
        const nameInputs = page.locator('input[placeholder="Medication name"]');
        const lastName = nameInputs.last();
        if (await lastName.count() > 0) {
          await slowTypeLocator(lastName, 'Pantoprazole', 35);
          await beat(400);
        }

        const doseInputs = page.locator('input[placeholder="Dose"]');
        const lastDose = doseInputs.last();
        if (await lastDose.count() > 0) {
          await slowTypeLocator(lastDose, '40mg PO daily', 30);
          await beat(400);
        }

        const freqInputs = page.locator('input[placeholder="Frequency"]');
        const lastFreq = freqInputs.last();
        if (await lastFreq.count() > 0) {
          await slowTypeLocator(lastFreq, 'Once daily', 30);
          await beat(1200);
        }
      }
    } catch {
      // Add Med flow not available
    }

    // ── 1c. Edit patient instructions textarea ──────────────────────────
    await scrollDown(page, 400);
    await beat(1500);

    try {
      const instructionsArea = page.locator('textarea[placeholder*="discharge instructions"]');
      if (await instructionsArea.count() > 0) {
        // Click at the end and append text
        await instructionsArea.click();
        await beat(300);
        await instructionsArea.press('End');
        await instructionsArea.pressSequentially(
          ' Do not stop ticagrelor without calling cardiologist — stent thrombosis risk.',
          { delay: 25 }
        );
        await beat(1500);
      }
    } catch {
      // Patient instructions textarea not available
    }

    // Follow-up schedule and red flags
    await scrollDown(page, 500);
    await beat(2500);

    // Restrictions and readmission risk
    await scrollDown(page, 500);
    await beat(2500);
  } catch {
    console.warn('  Generate Discharge Plan button not found, scrolling through static content...');
    await scrollDown(page, 400);
    await beat(2000);
    await scrollDown(page, 500);
    await beat(2000);
  }

  // ── 2. Referral ────────────────────────────────────────────────────────
  // Scroll to referral section
  await scrollDown(page, 500);
  await beat(1500);

  // Click the first suggested specialty button (e.g. "Maternal-Fetal Medicine")
  const specialtyBtns = page.locator('button.text-xs:not(:disabled)');
  const firstSpecialty = specialtyBtns.first();
  try {
    await firstSpecialty.waitFor({ state: 'visible', timeout: 5000 });
    await firstSpecialty.click();
    await beat(800);

    // Click Generate referral button
    const genReferralBtn = page.locator('button:has-text("Generate"):not(:has-text("Discharge")):not(:has-text("Handoff")):not(:has-text("SOAP")):not(:has-text("DDx"))');
    await genReferralBtn.click();
    await beat(500);

    // Wait for referral note to appear
    await page.waitForFunction(
      () => document.body.innerText.includes('Referral to') ||
            document.body.innerText.includes('Clinical Question') ||
            document.body.innerText.includes('clinical_question'),
      { timeout: 15000 }
    ).catch(() => {});
    await beat(2000);

    // Scroll through referral content
    await scrollDown(page, 500);
    await beat(2500);
  } catch {
    console.warn('  Referral specialty buttons not found, continuing...');
    await scrollDown(page, 500);
    await beat(2000);
  }

  // ── 3. Handoff ─────────────────────────────────────────────────────────
  await scrollDown(page, 500);
  await beat(1500);

  // I-PASS is default — just click Generate Handoff
  const genHandoffBtn = page.locator('button:has-text("Generate Handoff")');
  try {
    await genHandoffBtn.waitFor({ state: 'visible', timeout: 5000 });
    await genHandoffBtn.click();
    await beat(500);

    // Wait for handoff content
    await page.waitForFunction(
      () => document.body.innerText.includes('I-PASS') ||
            document.body.innerText.includes('Illness Severity') ||
            document.body.innerText.includes('patient_summary'),
      { timeout: 15000 }
    ).catch(() => {});
    await beat(2000);

    // Scroll through I-PASS handoff sections
    await scrollDown(page, 500);
    await beat(2500);

    await scrollDown(page, 500);
    await beat(2000);
  } catch {
    console.warn('  Generate Handoff button not found, continuing...');
    await scrollDown(page, 500);
    await beat(2000);
  }

  // ── 4. Preview & Release ───────────────────────────────────────────────
  await scrollDown(page, 500);
  await beat(1500);

  const previewBtn = page.locator('button:has-text("Preview & Release")');
  try {
    await previewBtn.waitFor({ state: 'visible', timeout: 5000 });
    await previewBtn.click();
    await beat(1500);

    // Wait for the modal overlay to appear
    await page.waitForSelector('.fixed.inset-0.z-50', { timeout: 5000 }).catch(() => {});
    await beat(2000);

    // Scroll inside the modal to show content
    const modal = page.locator('.fixed.inset-0.z-50');
    await modal.evaluate(el => el.scrollBy({ top: 300, behavior: 'smooth' }));
    await beat(2000);

    await modal.evaluate(el => el.scrollBy({ top: 300, behavior: 'smooth' }));
    await beat(2000);

    // Click "Release to Patient" button
    const releaseBtn = page.locator('button:has-text("Release to Patient")');
    try {
      await releaseBtn.waitFor({ state: 'visible', timeout: 3000 });
      await releaseBtn.click();
      await beat(2500);
    } catch {
      // Modal might have a different button text or layout — close it
      const closeBtn = modal.locator('button').first();
      await closeBtn.click().catch(() => {});
      await beat(1000);
    }
  } catch {
    console.warn('  Preview & Release button not found, continuing...');
    await beat(1000);
  }

  await scrollToTop(page);
  await beat(1500);
}
