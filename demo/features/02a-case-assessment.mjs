/**
 * 02a — Case Analysis: Assessment Tab (Comprehensive)
 *
 * Demos EVERY interactive feature in the Assessment tab:
 *
 * AcuteManagementEditor:
 *   1. Risk Stratification banner (orange)
 *   2. Completion counter badge (auto-updates)
 *   3. Checkbox toggle → green fill + strikethrough + timestamp
 *   4. Inline edit → hover pencil → input → save
 *   5. InlineAIAssist sparkles → "Why?" → AI answer → close
 *   6. Per-section Add → inline input → "Clinician" badge item
 *   7. Do Not Do (red warnings)
 *   8. Monitoring Plan checkbox
 *   9. Metabolic Corrections (purple bg)
 *  10. Disposition badge / Consults / Key Counseling / Activity Restrictions
 *  11. Global "Add Action" → input → clinician-added item
 *
 * RiskScoresTab:
 *  12. Risk Summary banner (blue)
 *  13. HEART Score card expand → variable table, score bar, source badges
 *
 * DifferentialDiagnosisTab:
 *  14. Clinical Reasoning + Key Tests + DDx #1 expand (STEMI)
 *  15. DDx #2 expand (additional DDx — "Must Rule Out" badge)
 *
 * Clinical Pearls:
 *  16. Collapsed section → expand → numbered amber pearls
 */
import { beat, scrollDown, slowTypeLocator } from '../lib/timing.mjs';
import { loadSeededCase, scrollToTop } from '../lib/case-helpers.mjs';
import { mockAIAssist } from '../lib/mocks.mjs';

export const name = '02a_case_assessment';
export const title = 'Case Analysis — Assessment Tab';

export async function record(page, baseUrl) {
  // ── Setup: run analysis with AI Assist mock ─────────────────────────
  await loadSeededCase(page, baseUrl, {
    extraMocks: async (p) => { await mockAIAssist(p); },
  });

  // Assessment tab is the default — already visible
  // Scope interactions to the AcuteManagement card (orange border)
  const acuteCard = page.locator('[class*="border-orange-500"]').first();

  // ══════════════════════════════════════════════════════════════════════
  // PHASE 1: Left Column — AcuteManagementEditor
  // ══════════════════════════════════════════════════════════════════════

  // ── 1. Risk Stratification banner (orange bg, already visible) ──────
  const riskBanner = acuteCard.locator('text=Risk Stratification');
  try {
    await riskBanner.scrollIntoViewIfNeeded();
    await beat(1500);
  } catch (e) {
    console.warn('  Risk banner scroll failed:', e.message);
  }

  // ── 2–3. Completion badge updates as we check 3 checkboxes ──────────
  const checkboxes = acuteCard.locator('ol li button:first-child');

  try {
    await checkboxes.first().scrollIntoViewIfNeeded();
    await beat(800);

    for (let i = 0; i < 3; i++) {
      const cb = checkboxes.nth(i);
      if ((await cb.count()) > 0) {
        await cb.click();
        await beat(1200);
      }
    }
  } catch (e) {
    console.warn('  Checkbox click failed:', e.message);
  }

  // ── 4. Inline edit — hover to reveal pencil, click, type, Enter ─────
  try {
    const actionItems = acuteCard.locator('ol li');
    const targetItem = actionItems.nth(3);
    await targetItem.scrollIntoViewIfNeeded();
    await targetItem.hover();
    await beat(600);

    // Pencil button appears on hover (opacity-0 → visible)
    const pencilBtn = targetItem.locator('button').last();
    await pencilBtn.click({ force: true });
    await beat(500);

    const editInput = targetItem.locator('input');
    if ((await editInput.count()) > 0) {
      await editInput.fill('');
      await slowTypeLocator(editInput, 'Aspirin 325mg PO chewed immediately', 25);
      await beat(400);
      await editInput.press('Enter');
      await beat(1200);
    }
  } catch (e) {
    console.warn('  Inline edit failed:', e.message);
  }

  // ── 5. InlineAIAssist — click sparkles → "Why?" → read answer → close
  try {
    // Sparkles button: title="AI Assist" inside the acute card
    const sparklesBtn = acuteCard.locator('button[title="AI Assist"]').first();
    await sparklesBtn.scrollIntoViewIfNeeded();
    await beat(500);
    await sparklesBtn.click();
    await beat(800);

    // Click "Why?" question button
    const whyBtn = page.locator('button:has-text("Why?")').first();
    if ((await whyBtn.count()) > 0) {
      await whyBtn.click();
      await beat(2000); // Wait for mock response (800ms delay + render)

      // Let the user see the answer
      await beat(2500);

      // Close the popover by clicking the X button
      const closeBtn = page.locator('.absolute.z-50 button').first();
      if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
        await beat(500);
      }
    }
  } catch (e) {
    console.warn('  AI Assist failed:', e.message);
  }

  // ── 6. Per-section Add — click "Add" link → type → Enter ───────────
  try {
    // Per-section add buttons have text "Add" with a Plus icon, class text-[11px]
    const perSectionAddBtns = acuteCard.locator('button:has-text("Add")').filter({ hasText: /^.*Add$/ });
    const firstAddBtn = perSectionAddBtns.first();
    await firstAddBtn.scrollIntoViewIfNeeded();
    await beat(400);
    await firstAddBtn.click();
    await beat(600);

    // Find the inline input that appeared
    const sectionInput = acuteCard.locator('input[placeholder*="Add to"]');
    if ((await sectionInput.count()) > 0) {
      await slowTypeLocator(sectionInput, 'Obtain 12-lead ECG q15min until cath lab', 25);
      await beat(400);
      await sectionInput.press('Enter');
      await beat(1500);
    }
  } catch (e) {
    console.warn('  Per-section Add failed:', e.message);
  }

  // ── 7. Do Not Do section — scroll red warnings into view ────────────
  try {
    const doNotDo = acuteCard.locator('text=Do Not Do');
    await doNotDo.scrollIntoViewIfNeeded();
    await beat(2000);
  } catch (e) {
    console.warn('  Do Not Do scroll failed:', e.message);
  }

  // ── 8. Monitoring Plan — check 1 checkbox ──────────────────────────
  try {
    const monitoringHeader = acuteCard.locator('text=Monitoring Plan');
    await monitoringHeader.scrollIntoViewIfNeeded();
    await beat(600);

    // Monitoring section is the second <ol> in the card (after immediate actions)
    const monitoringList = acuteCard.locator('ol').nth(1);
    const monCb = monitoringList.locator('li button:first-child').first();
    if ((await monCb.count()) > 0) {
      await monCb.click();
      await beat(1200);
    }
  } catch (e) {
    console.warn('  Monitoring checkbox failed:', e.message);
  }

  // ── 9. Scroll through Metabolic Corrections (purple) ────────────────
  try {
    const metabolic = acuteCard.locator('text=Metabolic Corrections');
    if ((await metabolic.count()) > 0) {
      await metabolic.scrollIntoViewIfNeeded();
      await beat(1500);
    }
  } catch (e) {
    console.warn('  Metabolic scroll failed:', e.message);
  }

  // ── 10. Disposition, Consults, Counseling, Activity Restrictions ────
  await scrollDown(page, 400);
  await beat(1500);

  try {
    const disposition = acuteCard.locator('text=Disposition:');
    if ((await disposition.count()) > 0) {
      await disposition.scrollIntoViewIfNeeded();
      await beat(1000);
    }
  } catch (e) {
    console.warn('  Disposition scroll failed:', e.message);
  }

  try {
    const restrictions = acuteCard.locator('text=Activity Restrictions');
    if ((await restrictions.count()) > 0) {
      await restrictions.scrollIntoViewIfNeeded();
      await beat(1500);
    }
  } catch (e) {
    console.warn('  Restrictions scroll failed:', e.message);
  }

  // ── 11. Global "Add Action" → type → Enter ─────────────────────────
  try {
    const addActionBtn = acuteCard.locator('button:has-text("Add Action")');
    await addActionBtn.scrollIntoViewIfNeeded();
    await beat(500);
    await addActionBtn.click();
    await beat(800);

    const addInput = page.locator('input[placeholder="Type new action item..."]');
    if ((await addInput.count()) > 0) {
      await slowTypeLocator(addInput, 'Notify cardiac rehab for pre-discharge consult', 25);
      await beat(500);
      await addInput.press('Enter');
      await beat(1500);
    }
  } catch (e) {
    console.warn('  Add action failed:', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE 2: Right Column — RiskScores, DDx, Clinical Pearls
  // ══════════════════════════════════════════════════════════════════════

  // ── 12. Risk Summary banner (blue) ──────────────────────────────────
  try {
    const riskSummary = page.locator('text=Risk Summary').first();
    await riskSummary.scrollIntoViewIfNeeded();
    await beat(1500);
  } catch (e) {
    console.warn('  Risk Summary scroll failed:', e.message);
  }

  // ── 13. HEART Score card — click to expand ──────────────────────────
  try {
    const scoreCard = page.locator('text=HEART Score').first();
    await scoreCard.scrollIntoViewIfNeeded();
    await beat(500);
    await scoreCard.click();
    await beat(1500);

    // Scroll to see variable table, score bar, and source badges
    await scrollDown(page, 300);
    await beat(2500);
  } catch (e) {
    console.warn('  HELLP card expand failed:', e.message);
  }

  // ── 14. DDx heading + Clinical Reasoning + first DDx card ───────────
  try {
    const ddxHeading = page.locator('h2:has-text("Differential Diagnosis")');
    await ddxHeading.scrollIntoViewIfNeeded();
    await beat(1500);

    // DDx cards use border-l-4; CardHeader has cursor-pointer
    const ddxCards = page.locator('[class*="border-l-4"] [class*="cursor-pointer"]');

    // Expand DDx #1: STEMI (high likelihood)
    const first = ddxCards.first();
    if ((await first.count()) > 0) {
      await first.scrollIntoViewIfNeeded();
      await first.click();
      await beat(1500);

      // Scroll to see supporting findings (green checks)
      await scrollDown(page, 250);
      await beat(1500);
    }
  } catch (e) {
    console.warn('  DDx #1 expand failed:', e.message);
  }

  // ── 15. DDx #2 — "Must Rule Out" badge + refuting findings ──────────
  try {
    const ddxCards = page.locator('[class*="border-l-4"] [class*="cursor-pointer"]');
    const second = ddxCards.nth(1);
    if ((await second.count()) > 0) {
      await second.scrollIntoViewIfNeeded();
      await beat(500);
      await second.click();
      await beat(1500);

      // Scroll to see supporting + refuting findings
      await scrollDown(page, 250);
      await beat(1500);
    }
  } catch (e) {
    console.warn('  DDx #2 expand failed:', e.message);
  }

  // ── 16. Clinical Pearls — expand collapsed section ──────────────────
  try {
    const pearlsHeading = page.locator('h2:has-text("Clinical Pearls")');
    await pearlsHeading.scrollIntoViewIfNeeded();
    await beat(500);
    await pearlsHeading.click();
    await beat(2500);
  } catch (e) {
    console.warn('  Clinical Pearls expand failed:', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE 3: Return to top
  // ══════════════════════════════════════════════════════════════════════
  await scrollToTop(page);
  await beat(1500);
}
