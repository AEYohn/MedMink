/**
 * 02 — Case Analysis: Full Tab-by-Tab Walkthrough (~4-5 min)
 *
 * Uses element-targeted centerOn() to scroll each section to viewport center
 * so every feature is properly showcased without cut-off content.
 *
 *   1. Pastes STEMI case + watches streaming analysis pipeline
 *   2. Assessment tab — acute management, risk scores, DDx, pearls
 *   3. Treatment tab — 7 treatment cards + charts
 *   4. Safety tab — runs med safety check, scrolls through alerts
 *   5. Orders tab — discharge plan, referral, handoff
 *   6. Tools tab — SOAP export
 */
import { beat, waitForPageReady, scrollDown, centerOn } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import {
  mockCaseAnalysisStream, mockAIAssist, mockMedicationSafety,
  mockDischargePlan, mockReferral, mockHandoff,
  mockSOAPFromCase, mockImageAnalysis, mockLabExtraction,
} from '../lib/mocks.mjs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const name = '02_case_analysis';
export const title = 'Case Analysis — STEMI';

/** Scroll to top smoothly */
async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(1000);
}

export async function record(page, baseUrl) {
  // ── Setup: seed + install ALL mocks ──────────────────────────────────
  await seedLocalStorage(page, { patients: true, caseSessions: false, visitSummaries: false });
  await mockCaseAnalysisStream(page);
  await mockAIAssist(page);
  await mockMedicationSafety(page);
  await mockDischargePlan(page);
  await mockReferral(page);
  await mockHandoff(page);
  await mockSOAPFromCase(page);
  await mockImageAnalysis(page);
  await mockLabExtraction(page);

  const caseText = (await readFile(join(__dirname, '..', 'stemi_case.txt'), 'utf-8')).trim();

  // ══════════════════════════════════════════════════════════════════════
  // INTRO: Paste case text + run analysis (~15s)
  // ══════════════════════════════════════════════════════════════════════
  await page.goto(`${baseUrl}/case?new=true`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  // Wait for ?new=true useEffect to finish (it replaces URL to /case)
  await page.waitForURL('**/case', { timeout: 10000 }).catch(() => {});
  await beat(1000);

  const textarea = page.locator('textarea[placeholder*="Paste your clinical case"]');
  await textarea.click();
  await beat(500);
  await textarea.pressSequentially(caseText, { delay: 0 });
  await beat(1000);

  // Debug: check textarea value and button state
  const val = await textarea.inputValue();
  console.log(`  DEBUG textarea value length: ${val.length} (expected: ${caseText.length})`);
  const btnState = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    const ta = document.querySelector('textarea');
    return {
      btnDisabled: btn?.disabled,
      btnText: btn?.textContent?.trim(),
      taValue: ta?.value?.length,
    };
  });
  console.log('  DEBUG button state:', JSON.stringify(btnState));

  const analyzeBtn = page.locator('button:has-text("Analyze Case")');
  await analyzeBtn.click();
  await beat(1000);

  // Wait for results tabs to appear
  try {
    await page.locator('[role="tablist"]').waitFor({ state: 'visible', timeout: 30000 });
  } catch {
    console.warn('  Timeout waiting for analysis results, continuing...');
  }
  await beat(3000);

  // ══════════════════════════════════════════════════════════════════════
  // TAB 1: Assessment (default) (~65s)
  // ══════════════════════════════════════════════════════════════════════
  console.log('  → Assessment tab');

  // 1. Case Summary card — patient demographics
  await centerOn(page, 'Case Summary', { pause: 3000 });

  // 2. Acute Management Protocol heading — orange card
  await centerOn(page, 'Acute Management Protocol', { pause: 3000 });

  // 3. Risk Stratification — orange banner
  await centerOn(page, 'Risk Stratification', { pause: 3000 });

  // 4. Immediate Actions — top of checklist
  await centerOn(page, 'Immediate Actions', { pause: 3000 });

  // 5. Scroll down to show more immediate action items (6-11)
  await scrollDown(page, 350);
  await beat(2500);

  // 6. Do Not Do — red warning box
  await centerOn(page, 'Do Not Do', { pause: 3000 });

  // 7. Monitoring Plan — monitoring checklist
  await centerOn(page, 'Monitoring Plan', { pause: 2500 });

  // 8. Metabolic Corrections — purple section
  await centerOn(page, 'Metabolic Corrections', { pause: 2500 });

  // 9. Disposition — badge + consults
  await centerOn(page, 'Disposition:', { pause: 2500 });

  // 10. Activity Restrictions — amber box
  await centerOn(page, 'Activity Restrictions', { pause: 2500 });

  // 11. Differential Diagnosis — right column section heading
  await centerOn(page, 'Differential Diagnosis', { pause: 2500 });

  // 12. Expand first DDx (STEMI) — show supporting/refuting findings
  try {
    const ddxCards = page.locator('[class*="border-l-4"] [class*="cursor-pointer"]');
    const firstDDx = ddxCards.first();
    if (await firstDDx.count() > 0) {
      await firstDDx.click();
      await beat(2500);
      await scrollDown(page, 250);
      await beat(2000);
    }
  } catch (e) {
    console.warn('  DDx expand failed:', e.message);
  }

  // 13. Clinical Pearls — click to expand, show amber list
  try {
    const pearlsHeading = page.locator('h2:has-text("Clinical Pearls")').first();
    if (await pearlsHeading.count() > 0) {
      await pearlsHeading.scrollIntoViewIfNeeded();
      await beat(500);
      await pearlsHeading.click();
      await beat(1000);
      await centerOn(page, 'Clinical Pearls', { pause: 3000 });
    }
  } catch {}

  // ══════════════════════════════════════════════════════════════════════
  // TAB 2: Treatment (~50s)
  // ══════════════════════════════════════════════════════════════════════
  await scrollToTop(page);
  await beat(500);

  const treatmentTab = page.locator('[role="tab"]:has-text("Treatment")');
  if (await treatmentTab.isVisible()) {
    console.log('  → Treatment tab');
    await treatmentTab.click();
    await beat(2500);

    // 1. AI TOP RECOMMENDATION banner
    await centerOn(page, 'AI TOP RECOMMENDATION', { pause: 3000 });

    // 2. First treatment card (Aspirin 325mg) — verdict + confidence
    try {
      const treatmentCards = page.locator('.border-l-4').filter({ has: page.locator('text=/Aspirin|aspirin/') });
      if (await treatmentCards.count() > 0) {
        await treatmentCards.first().scrollIntoViewIfNeeded();
        await beat(2500);
      } else {
        await centerOn(page, 'Aspirin', { pause: 2500 });
      }
    } catch {
      await centerOn(page, 'Aspirin', { pause: 2500 });
    }

    // 3. Third card (IV Heparin)
    await centerOn(page, 'Heparin', { pause: 2500 });

    // 4. Fourth card (Emergent PCI) — key intervention
    await centerOn(page, 'PCI', { pause: 3000 });

    // 5. Sixth card (Beta-blocker)
    await centerOn(page, 'Beta-blocker', { pause: 2500 });

    // 6. Seventh card (Insulin) — last treatment
    await centerOn(page, 'Insulin', { pause: 2500 });

    // 7. Scroll to charts (Treatment Comparison + Evidence Radar)
    await centerOn(page, 'Treatment Comparison', { pause: 3000 });
    await centerOn(page, 'Evidence Radar', { pause: 3000 });
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 3: Safety (~40s)
  // ══════════════════════════════════════════════════════════════════════
  await scrollToTop(page);
  await beat(500);

  const safetyTab = page.locator('[role="tab"]:has-text("Safety")');
  if (await safetyTab.isVisible()) {
    console.log('  → Safety tab');
    await safetyTab.click();
    await beat(2500);

    // 1. Click "Run Check" and wait for results
    try {
      const runCheckBtn = page.locator('button:has-text("Run Check")');
      await runCheckBtn.waitFor({ state: 'visible', timeout: 5000 });
      await runCheckBtn.click();
      await beat(500);

      // Wait for safety alerts to render
      await page.waitForFunction(
        () => document.body.innerText.includes('Drug Interaction') ||
              document.body.innerText.includes('interaction') ||
              document.body.innerText.includes('Aspirin'),
        { timeout: 10000 }
      ).catch(() => {});
      await beat(3000);
    } catch {
      console.warn('  Run Check not found, continuing...');
    }

    // 2. First interaction (Aspirin + Heparin — bleeding risk)
    await centerOn(page, 'Aspirin', { pause: 2500 });

    // 3. Drug-disease conflict (Beta-blocker + heart failure)
    await centerOn(page, 'Beta-blocker', { pause: 2500 });

    // 4. Dosing concern (Heparin weight-based)
    await centerOn(page, 'Heparin', { pause: 2500 });

    // 5. Overall safety summary
    await centerOn(page, 'safety summary', { pause: 3000 });

    // Fallback: scroll to bottom to catch any remaining alerts
    await scrollDown(page, 400);
    await beat(2000);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 4: Orders (~60s)
  // ══════════════════════════════════════════════════════════════════════
  await scrollToTop(page);
  await beat(500);

  const ordersTab = page.locator('[role="tab"]:has-text("Orders")');
  if (await ordersTab.isVisible()) {
    console.log('  → Orders tab');
    await ordersTab.click();
    await beat(2500);

    // 1. Click "Generate Discharge Plan" and wait
    try {
      const genDischargeBtn = page.locator('button:has-text("Generate Discharge Plan")');
      await genDischargeBtn.waitFor({ state: 'visible', timeout: 5000 });
      await genDischargeBtn.click();
      await beat(500);

      await page.waitForFunction(
        () => document.body.innerText.includes('Medication Reconciliation') ||
              document.body.innerText.includes('medication') ||
              document.body.innerText.includes('Ticagrelor'),
        { timeout: 15000 }
      ).catch(() => {});
      await beat(3000);
    } catch {
      console.warn('  Generate Discharge Plan not found, continuing...');
    }

    // 2. Readmission Risk card
    await centerOn(page, 'Readmission Risk', { pause: 2500 });

    // 3. Medication Reconciliation table — top rows
    await centerOn(page, 'Medication Reconciliation', { pause: 3000 });

    // 4. Scroll to show remaining medication rows
    await scrollDown(page, 300);
    await beat(2500);

    // 5. Patient Instructions textarea
    await centerOn(page, 'Patient Instructions', { pause: 3000 });

    // 6. Follow-Up Timeline
    await centerOn(page, 'Follow-Up', { pause: 2500 });

    // 7. Return to ED If You Experience (red flags)
    await centerOn(page, 'Return to ED', { pause: 3000 });

    // 8. Referral Note heading
    await centerOn(page, 'Referral Note', { pause: 2500 });

    // 9. Generate Handoff + show I-PASS content
    try {
      const genHandoffBtn = page.locator('button:has-text("Generate Handoff")');
      if (await genHandoffBtn.count() > 0) {
        await genHandoffBtn.scrollIntoViewIfNeeded();
        await beat(500);
        await genHandoffBtn.click();
        await beat(500);

        await page.waitForFunction(
          () => document.body.innerText.includes('I-PASS') ||
                document.body.innerText.includes('Illness Severity') ||
                document.body.innerText.includes('patient_summary'),
          { timeout: 15000 }
        ).catch(() => {});
        await beat(3000);
      }
    } catch {
      console.warn('  Generate Handoff not found, continuing...');
    }

    // 10. I-PASS Handoff content
    await centerOn(page, 'I-PASS', { pause: 3000 });

    // 11. Scroll to show Action List + Situation Awareness
    await scrollDown(page, 400);
    await beat(2500);

    // 12. Release to Patient (emerald card)
    await centerOn(page, 'Release to Patient', { pause: 3000 });
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 5: Tools (~30s)
  // ══════════════════════════════════════════════════════════════════════
  await scrollToTop(page);
  await beat(500);

  const toolsTab = page.locator('[role="tab"]:has-text("Tools")');
  if (await toolsTab.isVisible()) {
    console.log('  → Tools tab');
    await toolsTab.click();
    await beat(2500);

    // 1. Show Image/Lab upload cards
    await scrollDown(page, 350);
    await beat(2500);

    // 2. Generate SOAP Note
    try {
      const genSoapBtn = page.locator('button:has-text("Generate SOAP")').first();
      if (await genSoapBtn.count() > 0) {
        await genSoapBtn.scrollIntoViewIfNeeded();
        await beat(500);
        await genSoapBtn.click();
        await beat(500);

        await page.waitForFunction(
          () => {
            const textareas = document.querySelectorAll('textarea');
            for (const ta of textareas) {
              if (ta.value.includes('SUBJECTIVE') || ta.value.includes('OBJECTIVE')) return true;
            }
            return document.body.innerText.includes('SUBJECTIVE') ||
                   document.body.innerText.includes('SOAP');
          },
          { timeout: 15000 }
        ).catch(() => {});
        await beat(3000);
      }
    } catch {
      console.warn('  Generate SOAP not found, continuing...');
    }

    // 3. Center on SOAP textarea — show Subjective/Objective
    await centerOn(page, 'SOAP Note', { pause: 3000 });

    // 4. Scroll to show Assessment/Plan sections
    await scrollDown(page, 400);
    await beat(2500);
  }

  // ══════════════════════════════════════════════════════════════════════
  // OUTRO: Return to Assessment tab for clean ending (~5s)
  // ══════════════════════════════════════════════════════════════════════
  await scrollToTop(page);
  const assessmentTab = page.locator('[role="tab"]:has-text("Assessment")');
  if (await assessmentTab.isVisible()) {
    await assessmentTab.click();
    await beat(2500);
  }
}
