/**
 * 04 — EMS Run Report (~60-80s)
 * Shows: new run report, 5 dictation turns, Quick Entry panel (vitals/meds/procedures),
 *        completion with narrative, ICD-10 codes, medical necessity, validation flags,
 *        section completeness progress bars
 */
import { beat, waitForPageReady, centerOn } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { mockEMSStart, mockEMSDictate, mockEMSComplete } from '../lib/mocks.mjs';

export const name = '04_ems_report';
export const title = 'EMS Run Report';

const DICTATION_TURNS = [
  "Dispatched to 742 Evergreen Terrace for a 58-year-old male with chest pain. Arrived on scene at 14:32. Patient found sitting upright in living room, alert and oriented, diaphoretic.",
  "Patient states substernal chest pain started approximately 45 minutes ago, rated 8 out of 10, radiating to left arm. History of hypertension and diabetes. Takes metformin and lisinopril daily.",
  "Vitals on scene: blood pressure 168/98, heart rate 104, respiratory rate 22, SpO2 94% on room air, blood glucose 142. 12-lead ECG shows ST elevation in leads V1 through V4.",
  "Administered aspirin 324mg PO, nitroglycerin 0.4mg sublingual with mild relief. Established 18-gauge IV left AC, normal saline TKO. Applied oxygen via nasal cannula at 4 liters.",
  "Transported emergent to General Hospital, STEMI alert activated en route. Pain decreased to 5 out of 10 after second nitro. Repeat vitals: BP 152/88, HR 96, SpO2 97%. Arrived at ED at 14:58, care transferred to Dr. Martinez."
];

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: false, caseSessions: false, visitSummaries: false });

  // Clear any existing EMS sessions so we start fresh (shows "New Run Report" button)
  await page.addInitScript(() => {
    localStorage.removeItem('ems-sessions');
    localStorage.removeItem('ems-current-session');
  });

  // Install API mocks before navigating
  await mockEMSStart(page);
  await mockEMSDictate(page);
  await mockEMSComplete(page);

  // Navigate to EMS page
  await page.goto(`${baseUrl}/ems`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Click New Run Report (scroll into view first — sidebar may push it below viewport)
  const newRunBtn = page.locator('button:has-text("New Run Report")');
  await newRunBtn.scrollIntoViewIfNeeded();
  await beat(500);
  await newRunBtn.click();
  await beat(1500);

  // Wait for session to start — try multiple selectors for robustness
  let inputLocator = null;
  for (const sel of [
    'input[placeholder*="ictate"]',
    'input[placeholder*="type"]',
    'textarea[placeholder*="ictate"]',
    'textarea[placeholder*="type"]',
  ]) {
    const loc = page.locator(sel).first();
    try {
      await loc.waitFor({ state: 'visible', timeout: 5000 });
      inputLocator = loc;
      break;
    } catch {
      // try next selector
    }
  }
  if (!inputLocator) {
    console.warn('  Could not find dictation input, trying to continue...');
    await beat(2000);
    // Last resort: any visible input or textarea
    inputLocator = page.locator('input:visible, textarea:visible').first();
  }
  await beat(1500);

  // ---------------------------------------------------------------------------
  // Send dictation turns
  // ---------------------------------------------------------------------------
  for (let i = 0; i < DICTATION_TURNS.length; i++) {
    const text = DICTATION_TURNS[i];

    // Count current messages to detect new ones
    const msgCountBefore = await page.evaluate(() =>
      document.querySelectorAll('[class*="rounded-2xl"][class*="px-"], [class*="rounded-lg"][class*="bg-"]').length
    );

    // Re-query input in case DOM changed
    const input = page.locator('input[placeholder*="ictate"], input[placeholder*="type"]').first();
    if (!(await input.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.warn(`  Input not visible at turn ${i}, skipping remaining`);
      break;
    }

    await input.click();
    await beat(300);
    await input.fill(text);
    await beat(500);

    // Submit
    await input.press('Enter');
    await beat(1500);

    // Wait for AI response
    try {
      await page.waitForFunction(
        (prevCount) => {
          const msgs = document.querySelectorAll('[class*="rounded-2xl"][class*="px-"], [class*="rounded-lg"][class*="bg-"]');
          return msgs.length > prevCount;
        },
        msgCountBefore,
        { timeout: 10000 }
      );
    } catch {
      // continue
    }
    await beat(1500);

    // Scroll chat to see latest
    await page.evaluate(() => {
      const chatContainer = document.querySelector('[class*="overflow-y-auto"]');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    });
    await beat(1000);
  }

  // ---------------------------------------------------------------------------
  // Show Quick Entry panel — Vitals / Meds / Procedures tabs
  // ---------------------------------------------------------------------------
  const quickEntryBtn = page.locator('button:has-text("Quick Entry")');
  if (await quickEntryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Open Quick Entry
    await quickEntryBtn.click();
    await beat(1500);

    // Show Vitals tab (default)
    await centerOn(page, 'Vitals', { pause: 2500 });

    // Switch to Meds tab
    const medsTab = page.locator('button:has-text("Meds")').first();
    if (await medsTab.isVisible().catch(() => false)) {
      await medsTab.click();
      await beat(2500);
    }

    // Switch to Procedures tab
    const procsTab = page.locator('button:has-text("Procedures")').first();
    if (await procsTab.isVisible().catch(() => false)) {
      await procsTab.click();
      await beat(2500);
    }

    // Close Quick Entry
    await quickEntryBtn.click();
    await beat(1000);
  }

  // ---------------------------------------------------------------------------
  // Click Complete — show narrative, ICD-10, medical necessity, validation flags
  // ---------------------------------------------------------------------------
  const completeBtn = page.locator('button:has-text("Complete")');
  if (await completeBtn.isVisible({ timeout: 3000 }).catch(() => false) &&
      await completeBtn.isEnabled()) {
    await completeBtn.scrollIntoViewIfNeeded();
    await completeBtn.click();
    await beat(2000);

    // Wait for narrative/ICD codes to appear (mocked so should be fast)
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('I21') || document.body.innerText.includes('Narrative'),
        { timeout: 15000 }
      );
    } catch {
      console.warn('  Timeout waiting for completion data, continuing...');
    }
    await beat(2000);

    // ---------------------------------------------------------------------------
    // Scroll through the completion outputs
    // ---------------------------------------------------------------------------

    // Show narrative preview
    await centerOn(page, 'Narrative', { pause: 3500 });

    // Scroll down within the narrative preview container to show full text
    await page.evaluate(() => {
      const containers = document.querySelectorAll('[class*="overflow-y-auto"]');
      for (const c of containers) {
        if (c.textContent?.includes('Narrative') && c.textContent?.includes('ICD')) {
          c.scrollBy({ top: 200, behavior: 'smooth' });
          break;
        }
      }
    });
    await beat(2500);

    // Show ICD-10 codes with confidence scores
    await centerOn(page, 'ICD-10', { pause: 3000 });

    // Show medical necessity statement
    await centerOn(page, 'Medical Necessity', { pause: 3000 });

    // Show validation flags panel
    await centerOn(page, 'Validation Flags', { pause: 3000 });

    // Show section completeness progress bars (in the header area)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await beat(1500);

    // Scroll to the EMS Run Report header where progress bars live
    await centerOn(page, 'EMS Run Report', { pause: 3000 });
  }
}
