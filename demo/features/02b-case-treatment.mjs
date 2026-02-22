/**
 * 02b — Case Analysis: Treatment Tab (Interactive)
 * Shows: Treatment cards with verdict buttons, status cycling, dose editing, notes, add treatment form.
 * Interactive: Accepts/rejects/modifies treatments, cycles status, adds notes, adds custom treatment, adds findings.
 */
import { beat, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { loadSeededCase, scrollToTop } from '../lib/case-helpers.mjs';

export const name = '02b_case_treatment';
export const title = 'Case Analysis — Treatment Tab';

export async function record(page, baseUrl) {
  await loadSeededCase(page, baseUrl);

  // Click the Treatment tab
  const treatmentTab = page.locator('[role="tab"]:has-text("Treatment")');
  try {
    await treatmentTab.waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    console.warn('  Treatment tab not visible, skipping...');
    return;
  }
  await treatmentTab.click();
  await beat(2500);

  // ── 1. Read the top recommendation banner ────────────────────────────
  await beat(1500);
  await scrollDown(page, 300);
  await beat(2000);

  // ── 2. Accept top treatment (MgSO4) ──────────────────────────────────
  try {
    const acceptBtns = page.locator('button:has-text("Accept")');
    const firstAccept = acceptBtns.first();
    if (await firstAccept.count() > 0) {
      await firstAccept.click();
      await beat(1500);

      // ── 3. Cycle status: Pending → Ordered ─────────────────────────────
      // The status badge is a clickable button with "Pending" text
      const pendingBadge = page.locator('button:has-text("Pending")').first();
      if (await pendingBadge.count() > 0) {
        await pendingBadge.click();
        await beat(1200);
      }
    }
  } catch {
    // Accept buttons may not be present — continue
  }

  // ── 4. Scroll to 2nd treatment, Reject it ───────────────────────────
  await scrollDown(page, 400);
  await beat(1500);

  try {
    const rejectBtns = page.locator('button:has-text("Reject")');
    const secondReject = rejectBtns.nth(1);
    if (await secondReject.count() > 0) {
      await secondReject.click();
      await beat(1500);
    }
  } catch {
    // Reject button not found — continue
  }

  // ── 5. Scroll to 3rd treatment, click Modify + enter modified dose ──
  await scrollDown(page, 400);
  await beat(1500);

  try {
    const modifyBtns = page.locator('button:has-text("Modify")');
    const thirdModify = modifyBtns.nth(2);
    if (await thirdModify.count() > 0) {
      await thirdModify.click();
      await beat(1000);

      // Fill in the modified dose input
      const doseInput = page.locator('input[placeholder*="500mg PO BID"]').first();
      if (await doseInput.count() > 0) {
        await slowTypeLocator(doseInput, 'Increase to 50mg daily at 72h if tolerated', 30);
        await beat(1200);
      }
    }
  } catch {
    // Modify flow not available — continue
  }

  // ── 6. Toggle Notes on the same treatment ────────────────────────────
  try {
    const notesBtn = page.locator('button:has-text("Add Notes")').first();
    if (await notesBtn.count() > 0) {
      await notesBtn.click();
      await beat(800);

      const notesArea = page.locator('textarea[placeholder*="clinical rationale"]').first();
      if (await notesArea.count() > 0) {
        await slowTypeLocator(notesArea, 'Titrate metoprolol after confirming EF on echo', 25);
        await beat(1500);
      }
    }
  } catch {
    // Notes toggle not available — continue
  }

  // ── 7. Scroll down and add a custom treatment ────────────────────────
  await scrollDown(page, 500);
  await beat(1500);

  try {
    // Click "Add Treatment" to open the form
    const addTreatmentBtn = page.locator('button:has-text("Add Treatment")').last();
    if (await addTreatmentBtn.count() > 0) {
      await addTreatmentBtn.click();
      await beat(1000);

      // Fill treatment name
      const nameInput = page.locator('input[placeholder*="Treatment name"]');
      if (await nameInput.count() > 0) {
        await slowTypeLocator(nameInput, 'Nitroglycerin SL', 35);
        await beat(500);
      }

      // Fill dose
      const doseInput = page.locator('input[placeholder*="Dose"]').first();
      if (await doseInput.count() > 0) {
        await slowTypeLocator(doseInput, '0.4mg SL PRN chest pain, max 3 doses q5min', 30);
        await beat(500);
      }

      // Fill rationale
      const rationaleInput = page.locator('input[placeholder*="Rationale"]');
      if (await rationaleInput.count() > 0) {
        await slowTypeLocator(rationaleInput, 'PRN angina relief post-discharge per AHA guidelines', 30);
        await beat(500);
      }

      // Submit the form — click the "Add Treatment" button inside the form
      const submitBtn = page.locator('button:has-text("Add Treatment")').first();
      await submitBtn.click();
      await beat(2000);
    }
  } catch {
    // Add treatment form not available — continue
  }

  // ── 8. Add a new finding via AddFindingsForm ─────────────────────────
  await scrollDown(page, 500);
  await beat(1500);

  try {
    // Fill clinical time
    const timeInput = page.locator('input[placeholder*="Day 2"]');
    if (await timeInput.count() > 0) {
      await slowTypeLocator(timeInput, '6h post-PCI', 30);
      await beat(500);
    }

    // Fill finding text
    const findingInput = page.locator('input[placeholder*="Troponin"]');
    if (await findingInput.count() > 0) {
      await slowTypeLocator(findingInput, 'Peak troponin I 8.4, echo EF 42% with anterior hypokinesis', 25);
      await beat(500);
    }

    // Click "Add" submit button
    const addBtn = page.locator('button[type="submit"]:has-text("Add")');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await beat(2000);
    }
  } catch {
    // AddFindingsForm not available — continue
  }

  // ── 9. Return to top ────────────────────────────────────────────────
  await scrollToTop(page);
  await beat(1500);
}
