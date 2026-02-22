/**
 * 02e — Case Analysis: Tools Tab (Interactive)
 * Shows: Image analysis, lab extraction, SOAP export, case timeline.
 * Interactive: Uploads CXR image, uploads lab report, imports results, generates & copies SOAP note.
 */
import { beat, scrollDown } from '../lib/timing.mjs';
import { loadSeededCase, scrollToTop } from '../lib/case-helpers.mjs';
import { mockSOAPFromCase, mockImageAnalysis, mockLabExtraction } from '../lib/mocks.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const name = '02e_case_tools';
export const title = 'Case Analysis — Tools Tab';

export async function record(page, baseUrl) {
  await loadSeededCase(page, baseUrl, {
    extraMocks: async (p) => {
      await mockSOAPFromCase(p);
      await mockImageAnalysis(p);
      await mockLabExtraction(p);
    },
  });

  // Click the Tools tab
  const toolsTab = page.locator('[role="tab"]:has-text("Tools")');
  try {
    await toolsTab.waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    console.warn('  Tools tab not visible, skipping...');
    return;
  }
  await toolsTab.click();
  await beat(2500);

  // ── 1. Image Analysis — upload CXR ────────────────────────────────────
  try {
    const imageInput = page.locator('#image-upload');
    if (await imageInput.count() > 0) {
      const cxrPath = join(__dirname, '..', 'fixtures', 'sample_cxr.jpg');
      await imageInput.setInputFiles(cxrPath);
      await beat(1000);

      // Wait for mock image analysis results to render
      await page.waitForFunction(
        () => document.body.innerText.includes('Findings') ||
              document.body.innerText.includes('cardiac silhouette') ||
              document.body.innerText.includes('X-ray'),
        { timeout: 15000 }
      ).catch(() => {});
      await beat(2500);

      // Scroll to see full results
      await scrollDown(page, 400);
      await beat(2000);

      // Click "Import Findings to Case Analysis"
      const importFindingsBtn = page.locator('button:has-text("Import Findings")');
      if (await importFindingsBtn.count() > 0) {
        await importFindingsBtn.click();
        await beat(1500);
      }
    }
  } catch {
    console.warn('  Image upload not available, continuing...');
    await scrollDown(page, 400);
    await beat(2000);
  }

  // ── 2. Lab Extraction — upload lab report ─────────────────────────────
  await scrollDown(page, 400);
  await beat(1500);

  try {
    const labInput = page.locator('#lab-upload');
    if (await labInput.count() > 0) {
      const labPath = join(__dirname, '..', 'fixtures', 'sample_lab.jpg');
      await labInput.setInputFiles(labPath);
      await beat(1000);

      // Wait for mock lab results table to render
      await page.waitForFunction(
        () => document.body.innerText.includes('values extracted') ||
              document.body.innerText.includes('Troponin') ||
              document.body.innerText.includes('CK-MB'),
        { timeout: 15000 }
      ).catch(() => {});
      await beat(2500);

      // Scroll to see full lab table
      await scrollDown(page, 400);
      await beat(2000);

      // Click specific lab row checkboxes (Platelets, AST, LDH)
      const labCheckboxes = page.locator('tbody input[type="checkbox"]');
      try {
        // Click first few critical lab checkboxes
        for (let i = 0; i < Math.min(4, await labCheckboxes.count()); i++) {
          await labCheckboxes.nth(i).click();
          await beat(400);
        }
        await beat(800);
      } catch {
        // Individual checkbox clicks failed — try select all
        const selectAll = page.locator('thead input[type="checkbox"]');
        if (await selectAll.count() > 0) {
          await selectAll.click();
          await beat(800);
        }
      }

      // Click "Import Selected Labs to Case"
      const importLabsBtn = page.locator('button:has-text("Import")').filter({ hasText: /Labs|Selected/ });
      if (await importLabsBtn.count() > 0) {
        await importLabsBtn.first().click();
        await beat(1500);
      }
    }
  } catch {
    console.warn('  Lab upload not available, continuing...');
    await scrollDown(page, 400);
    await beat(2000);
  }

  // ── 3. SOAP Export — generate and copy ────────────────────────────────
  await scrollDown(page, 400);
  await beat(1500);

  const genSoapBtn = page.locator('button:has-text("Generate SOAP")');
  try {
    await genSoapBtn.first().waitFor({ state: 'visible', timeout: 5000 });
    await genSoapBtn.first().click();
    await beat(500);

    // Wait for SOAP note text to appear in textarea
    await page.waitForFunction(
      () => {
        const textareas = document.querySelectorAll('textarea');
        for (const ta of textareas) {
          if (ta.value.includes('SUBJECTIVE') || ta.value.includes('OBJECTIVE')) return true;
        }
        return false;
      },
      { timeout: 15000 }
    ).catch(() => {});
    await beat(2000);

    // Scroll through the generated SOAP note
    await scrollDown(page, 500);
    await beat(2500);

    // Click "Copy" button
    try {
      const copyBtn = page.locator('button:has-text("Copy")').first();
      if (await copyBtn.count() > 0) {
        await copyBtn.click();
        await beat(1500);
      }
    } catch {
      // Copy button not found — continue
    }

    await scrollDown(page, 500);
    await beat(2000);
  } catch {
    console.warn('  Generate SOAP button not found, scrolling through static content...');
    await scrollDown(page, 500);
    await beat(2000);
  }

  // ── 4. Case Timeline — expand collapsible sections ────────────────────
  await scrollDown(page, 400);
  await beat(1500);

  try {
    // Look for timeline / visual collapsible triggers
    const timelineTriggers = page.locator('button:has-text("Timeline"), button:has-text("Visual")');
    for (let i = 0; i < Math.min(2, await timelineTriggers.count()); i++) {
      const trigger = timelineTriggers.nth(i);
      await trigger.click();
      await beat(1500);
      await scrollDown(page, 300);
      await beat(1500);
    }
  } catch {
    // Timeline sections not available — continue
  }

  // ── 5. Return to top ──────────────────────────────────────────────────
  await scrollToTop(page);
  await beat(1500);
}
