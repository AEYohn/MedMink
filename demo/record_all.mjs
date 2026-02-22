#!/usr/bin/env node
/**
 * Master Demo Recorder — all 33 clips for the full demo video
 *
 * Extends record_demos.mjs with additional feature clips:
 * - TxGemma drug tools (properties, interaction, toxicity)
 * - Foundation model imaging (CXR, Derm, Pathology)
 * - New findings & reassessment
 * - Follow-up chat
 * - Case timeline
 * - Compliance scanning
 * - Multilingual interview
 *
 * Usage:
 *   node demo/record_all.mjs                               # Record all clips
 *   node demo/record_all.mjs --feature=dashboard,interview  # Specific clips
 *   node demo/record_all.mjs --headless=false               # Show browser
 *   node demo/record_all.mjs --skip-convert                 # Skip MP4 conversion
 *   node demo/record_all.mjs --base-url=http://...          # Custom URL
 */

import { launchBrowser, createRecordingContext, finishRecording } from './lib/browser.mjs';
import { convertAllWebmToMp4, concatMp4s } from './lib/convert.mjs';
import { seedLocalStorage } from './lib/seed.mjs';
import { beat, waitForPageReady, scrollDown, centerOn, slowTypeLocator, waitForSSEComplete } from './lib/timing.mjs';
import { runCaseAnalysis, scrollToTop } from './lib/case-helpers.mjs';
import {
  mockCaseAnalysisStream,
  mockInterviewStart, mockInterviewRespond, mockInterviewComplete, mockManagementPlan,
  mockEMSStart, mockEMSDictate, mockEMSComplete,
  mockChartEnhance, mockComplianceScan,
  mockAIAssist, mockDischargePlan, mockReferral, mockHandoff,
  mockMedicationSafety, mockImageAnalysis, mockLabExtraction,
} from './lib/mocks.mjs';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeTimestampedDir() {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  return join(__dirname, 'output', ts);
}

// ─── Inline recording functions for NEW clips ────────────────────────────────

/** Clip: CXR Foundation — upload chest X-ray, show classification probabilities */
async function recordCXRFoundation(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Navigate to imaging tab/section
  const imgTab = page.locator('button:has-text("Imaging"), [role="tab"]:has-text("Imaging")').first();
  if (await imgTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await imgTab.click();
    await beat(1000);
  }

  // Upload CXR image
  const cxrPath = join(__dirname, 'sample_images', 'chest_xray_pneumonia_lobar.jpg');
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(cxrPath);
    await beat(3000);
  }

  // Wait for results
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

/** Clip: Derm Foundation — upload skin lesion, show melanoma risk */
async function recordDermFoundation(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Find derm upload area
  const dermPath = join(__dirname, 'sample_images', 'dermoscopy_melanoma_ISIC_0024310.jpg');
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

/** Clip: Pathology Foundation — upload tissue slide, show tumor classification */
async function recordPathFoundation(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  const pathPath = join(__dirname, 'sample_images', 'pathology_breast_carcinoma_HE.jpg');
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

/** Clip: Drug Properties — look up amiodarone via TxGemma */
async function recordDrugProperties(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Find drug lookup input
  const drugInput = page.locator('input[placeholder*="drug"], input[placeholder*="Drug"], input[placeholder*="medication"]').first();
  if (await drugInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await slowTypeLocator(drugInput, 'amiodarone', 50);
    await beat(500);

    // Submit
    const lookupBtn = page.locator('button:has-text("Look"), button:has-text("Search"), button:has-text("Check")').first();
    if (await lookupBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lookupBtn.click();
    } else {
      await drugInput.press('Enter');
    }
    await beat(3000);
  }

  // Wait for properties to load
  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Mechanism') ||
      document.body.innerText.includes('Properties') ||
      document.body.innerText.includes('amiodarone'),
      { timeout: 20000 }
    );
  } catch { /* continue */ }
  await beat(2000);
  await scrollDown(page, 300);
  await beat(2000);
}

/** Clip: Drug Interaction — warfarin + amiodarone */
async function recordDrugInteraction(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Find interaction check inputs
  const inputs = page.locator('input[placeholder*="rug"]');
  if (await inputs.count() >= 2) {
    await slowTypeLocator(inputs.nth(0), 'warfarin', 50);
    await beat(300);
    await slowTypeLocator(inputs.nth(1), 'amiodarone', 50);
    await beat(500);

    const checkBtn = page.locator('button:has-text("Check"), button:has-text("Interact")').first();
    if (await checkBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkBtn.click();
    }
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Interaction') ||
      document.body.innerText.includes('Severity') ||
      document.body.innerText.includes('warfarin'),
      { timeout: 20000 }
    );
  } catch { /* continue */ }
  await beat(2000);
}

/** Clip: New Findings & Reassessment */
async function recordReassessment(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  // Find and click "Add Findings" button
  const addFindingsBtn = page.locator('button:has-text("Add Finding"), button:has-text("New Finding")').first();
  if (await addFindingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addFindingsBtn.click();
    await beat(1000);

    // Fill in findings form
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slowTypeLocator(textarea, 'Repeat troponin I now 4.2 ng/mL (up from 0.82). ECG shows new Q waves in V2-V4.', 30);
      await beat(1000);
    }

    // Submit
    const submitBtn = page.locator('button:has-text("Reassess"), button:has-text("Submit"), button:has-text("Add")').first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();
      await beat(5000);
    }
  }

  await scrollDown(page, 400);
  await beat(2000);
}

/** Clip: Follow-Up Chat */
async function recordFollowupChat(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Open follow-up chat
  const chatToggle = page.locator('button:has-text("Follow-Up"), button:has-text("Chat"), button:has-text("Ask")').first();
  if (await chatToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatToggle.click();
    await beat(1000);
  }

  // Scroll the chat input into view and type a question
  const chatInput = page.locator('input[placeholder*="question"], input[placeholder*="ask"], textarea[placeholder*="question"]').first();
  if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await chatInput.scrollIntoViewIfNeeded();
    await beat(500);
    await chatInput.click({ force: true });
    await beat(300);
    await chatInput.fill('Should we consider fibrinolytics if cath lab delay exceeds 120 minutes?');
    await beat(500);
    await chatInput.press('Enter');
    await beat(5000);
  }

  await scrollDown(page, 300);
  await beat(2000);
}

/** Clip: Case Timeline */
async function recordCaseTimeline(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await page.goto(`${baseUrl}/case`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Look for timeline section or tab
  const timelineBtn = page.locator('button:has-text("Timeline"), [role="tab"]:has-text("Timeline")').first();
  if (await timelineBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await timelineBtn.click();
    await beat(2000);
  }

  // Scroll through timeline events
  await scrollDown(page, 300);
  await beat(1500);
  await scrollDown(page, 300);
  await beat(1500);
}

/** Clip: Compliance Scanning */
async function recordComplianceScan(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true });
  await mockComplianceScan(page);

  await page.goto(`${baseUrl}/chart`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Look for compliance section
  const complianceBtn = page.locator('button:has-text("Compliance"), button:has-text("Scan")').first();
  if (await complianceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await complianceBtn.click();
    await beat(3000);
  }

  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes('Grade') ||
      document.body.innerText.includes('Compliance') ||
      document.body.innerText.includes('Score'),
      { timeout: 15000 }
    );
  } catch { /* continue */ }
  await beat(2000);
  await scrollDown(page, 300);
  await beat(1500);
}

/** Clip: Multilingual Interview (Spanish/Mandarin) */
async function recordMultilingualInterview(page, baseUrl) {
  await seedLocalStorage(page, { patients: false, caseSessions: false });
  await mockInterviewStart(page);
  await mockInterviewRespond(page);
  await mockManagementPlan(page);

  await page.goto(`${baseUrl}/interview`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Look for language selector
  const langSelect = page.locator('select, [role="combobox"], button:has-text("English")').first();
  if (await langSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await langSelect.click();
    await beat(500);

    // Select Spanish
    const spanishOption = page.locator('option[value="es"], [role="option"]:has-text("Español"), li:has-text("Español")').first();
    if (await spanishOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await spanishOption.click();
    } else {
      await langSelect.selectOption('es').catch(() => {});
    }
    await beat(1000);
  }

  // Start interview
  const startBtn = page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Iniciar")').first();
  if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startBtn.click();
    await beat(3000);
  }

  // Type a response in Spanish
  const input = page.locator('input[placeholder*="response"], input[placeholder*="respuesta"], textarea').first();
  if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
    await slowTypeLocator(input, 'Tengo un dolor fuerte en el pecho desde esta mañana', 40);
    await beat(500);
    await input.press('Enter');
    await beat(3000);
  }

  await beat(2000);
}

// ─── Feature Registry ────────────────────────────────────────────────────────

const FEATURES = [
  // === Dashboard ===
  { id: 'dashboard', module: './features/01-dashboard.mjs', clip: 1 },

  // === Case Analysis Flow ===
  { id: 'case-analysis', module: './features/02-case-analysis.mjs', clip: 2 },
  { id: 'case-assessment', module: './features/02a-case-assessment.mjs', clip: 4 },
  { id: 'case-treatment', module: './features/02b-case-treatment.mjs', clip: 5 },
  { id: 'case-safety', module: './features/02c-case-safety.mjs', clip: 6 },

  // === Risk Scores (existing in case-assessment) ===
  // Clip 7 is part of case-assessment

  // === Medical Imaging (Foundation Models) ===
  { id: 'cxr-foundation', inline: recordCXRFoundation, name: '08_cxr_foundation', title: 'CXR Foundation — Chest X-Ray', clip: 8 },
  { id: 'derm-foundation', inline: recordDermFoundation, name: '09_derm_foundation', title: 'Derm Foundation — Skin Lesion', clip: 9 },
  { id: 'path-foundation', inline: recordPathFoundation, name: '10_path_foundation', title: 'Path Foundation — Pathology', clip: 10 },

  // === Drug Tools (TxGemma) ===
  { id: 'drug-properties', inline: recordDrugProperties, name: '11_drug_properties', title: 'Drug Properties (TxGemma)', clip: 11 },
  { id: 'drug-interaction', inline: recordDrugInteraction, name: '12_drug_interaction', title: 'Drug Interaction (TxGemma)', clip: 12 },

  // === Case Orders ===
  { id: 'case-orders', module: './features/02d-case-orders.mjs', clip: 13 },

  // === Case Tools (SOAP export, report) ===
  { id: 'case-tools', module: './features/02e-case-tools.mjs', clip: 15 },

  // === New Findings & Reassessment ===
  { id: 'reassessment', inline: recordReassessment, name: '17_reassessment', title: 'New Findings & Reassessment', clip: 17 },

  // === Follow-Up Chat ===
  { id: 'followup-chat', inline: recordFollowupChat, name: '18_followup_chat', title: 'Follow-Up Clinical Chat', clip: 18 },

  // === Case Timeline ===
  { id: 'case-timeline', inline: recordCaseTimeline, name: '19_case_timeline', title: 'Case Timeline', clip: 19 },

  // === Patient Interview ===
  { id: 'interview', module: './features/03-interview.mjs', clip: 20 },

  // === EMS Report ===
  { id: 'ems-report', module: './features/04-ems-report.mjs', clip: 25 },

  // === Clinical Charting ===
  { id: 'charting', module: './features/05-charting.mjs', clip: 30 },

  // === Compliance ===
  { id: 'compliance', inline: recordComplianceScan, name: '31_compliance', title: 'Compliance Scanning', clip: 31 },

  // === Imaging (existing) ===
  { id: 'imaging', module: './features/06-imaging.mjs', clip: 32 },

  // === Labs ===
  { id: 'labs', module: './features/07-labs.mjs', clip: 33 },

  // === Patients ===
  { id: 'patients', module: './features/08-patients.mjs', clip: 34 },

  // === Referrals ===
  { id: 'referrals', module: './features/09-referrals.mjs', clip: 35 },

  // === Patient Portal ===
  { id: 'patient-portal', module: './features/10-patient-portal.mjs', clip: 36 },

  // === Multilingual Interview ===
  { id: 'multilingual', inline: recordMultilingualInterview, name: '37_multilingual', title: 'Multilingual Interview', clip: 37 },
];

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    features: null,
    headless: true,
    skipConvert: false,
    baseUrl: 'http://localhost:3000',
    concat: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--feature=')) {
      opts.features = arg.slice('--feature='.length).split(',').map(s => s.trim());
    } else if (arg === '--headless=false' || arg === '--no-headless') {
      opts.headless = false;
    } else if (arg === '--skip-convert') {
      opts.skipConvert = true;
    } else if (arg.startsWith('--base-url=')) {
      opts.baseUrl = arg.slice('--base-url='.length);
    } else if (arg.startsWith('--concat=')) {
      opts.concat = arg.slice('--concat='.length).split(',').map(s => s.trim());
    }
  }

  return opts;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const OUTPUT_DIR = makeTimestampedDir();
  const WEBM_DIR = join(OUTPUT_DIR, '_webm');

  let featuresToRecord = FEATURES;
  if (opts.features) {
    featuresToRecord = FEATURES.filter(f => opts.features.includes(f.id));
    if (featuresToRecord.length === 0) {
      console.error(`No matching features. Available: ${FEATURES.map(f => f.id).join(', ')}`);
      process.exit(1);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(WEBM_DIR, { recursive: true });

  console.log(`\n=== Full Demo Recorder (${featuresToRecord.length} clips) ===`);
  console.log(`Base URL: ${opts.baseUrl}`);
  console.log(`Headless: ${opts.headless}`);
  console.log(`Features: ${featuresToRecord.map(f => f.id).join(', ')}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  const browser = await launchBrowser(opts.headless);
  let successCount = 0;
  let failCount = 0;

  for (const feature of featuresToRecord) {
    console.log(`\n--- Recording: ${feature.id} (clip ${feature.clip}) ---`);
    const startTime = Date.now();

    try {
      let recordFn, featureName, featureTitle;

      if (feature.module) {
        // Import existing feature module
        const mod = await import(feature.module);
        recordFn = mod.record;
        featureName = mod.name;
        featureTitle = mod.title;
      } else if (feature.inline) {
        // Use inline recording function
        recordFn = feature.inline;
        featureName = feature.name;
        featureTitle = feature.title;
      } else {
        console.warn(`  Skipping ${feature.id}: no module or inline function`);
        continue;
      }

      // Create recording context
      const context = await createRecordingContext(browser, featureName, OUTPUT_DIR);
      const page = await context.newPage();

      // Record the feature
      await recordFn(page, opts.baseUrl);

      // Finish recording
      await finishRecording(context, page, OUTPUT_DIR);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Done: ${featureTitle} (${duration}s)`);
      successCount++;
    } catch (err) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  FAILED: ${feature.id} after ${duration}s — ${err.message}`);
      failCount++;
    }
  }

  await browser.close();

  console.log(`\n=== Recording Summary ===`);
  console.log(`  Success: ${successCount}/${featuresToRecord.length}`);
  if (failCount > 0) console.log(`  Failed: ${failCount}`);

  // Convert webm to mp4
  if (!opts.skipConvert && successCount > 0) {
    try {
      await convertAllWebmToMp4(WEBM_DIR, OUTPUT_DIR);
    } catch (err) {
      console.error(`\nMP4 conversion failed: ${err.message}`);
      console.log('Videos are still available as .webm in the _webm/ directory.');
      console.log('Install ffmpeg to enable conversion: brew install ffmpeg');
    }
  }

  // Concatenate clips if --concat flag provided
  if (opts.concat && opts.concat.length > 1) {
    console.log(`\nConcatenating clips: ${opts.concat.join(', ')}`);
    const inputPaths = opts.concat.map(name => join(OUTPUT_DIR, `${name}.mp4`));
    const outputPath = join(OUTPUT_DIR, 'full_demo.mp4');
    try {
      await concatMp4s(inputPaths, outputPath);
    } catch (err) {
      console.error(`\nConcatenation failed: ${err.message}`);
    }
  }

  console.log(`\nDone! Videos saved to: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
