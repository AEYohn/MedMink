/**
 * 02f — Case Analysis: Integrated Agent Reasoning (~30s)
 * Shows: User clicks Analyze Case, pipeline runs through 6 steps,
 *        then agent reasoning auto-starts inline (step 7), thinking + tool calls
 *        stream in the progress area, then results merge into Clinical Review
 *        (assessment banner, risk scores, DDx, consensus panel).
 */
import { beat, waitForText, scrollDown } from '../lib/timing.mjs';
import { runCaseAnalysis, scrollToTop } from '../lib/case-helpers.mjs';
import { mockAgentReasoningStream } from '../lib/mocks.mjs';

export const name = '02f_case_agent';
export const title = 'Case Analysis — Integrated Agent Reasoning';

export async function record(page, baseUrl) {
  // Run full analysis with agent mock installed — agent auto-triggers after pipeline
  await runCaseAnalysis(page, baseUrl, {
    extraMocks: async (p) => {
      await mockAgentReasoningStream(p);
    },
  });

  // 1. After analysis + agent complete, we should be on Clinical Review
  //    Look for the agent assessment banner that auto-merged into review
  try {
    await waitForText(page, 'AGENT ASSESSMENT', 15000);
    const agentBanner = page.locator('text=AGENT ASSESSMENT').first();
    await agentBanner.scrollIntoViewIfNeeded();
    await beat(3500);
  } catch {
    console.warn('  Agent Assessment banner not found, continuing...');
    await beat(1500);
  }

  // 2. [Agent] actions in Acute Management
  try {
    await scrollDown(page, 600);
    await beat(1000);
    const agentAction = page.locator('text=[Agent]').first();
    await agentAction.waitFor({ state: 'visible', timeout: 5000 });
    await agentAction.scrollIntoViewIfNeeded();
    await beat(3000);
  } catch {
    console.warn('  [Agent] actions not found, continuing...');
    await scrollDown(page, 400);
    await beat(1500);
  }

  // 3. Risk Scores with Agent badge
  try {
    await scrollDown(page, 800);
    await beat(1500);
    const timiCard = page.locator('text=TIMI Risk Score').first();
    if (await timiCard.count() > 0) {
      await timiCard.scrollIntoViewIfNeeded();
      await beat(1000);
      try { await timiCard.click(); } catch { /* may not be clickable */ }
      await beat(3000);
    } else {
      const agentBadge = page.locator('text=/^Agent$/').first();
      if (await agentBadge.count() > 0) {
        await agentBadge.scrollIntoViewIfNeeded();
        await beat(3000);
      }
    }
  } catch {
    console.warn('  Agent risk score not found, continuing...');
    await beat(1500);
  }

  // 4. DDx with agent diagnosis
  try {
    await scrollDown(page, 600);
    await beat(1000);
    const ddxSection = page.locator('text=Differential Diagnosis').first();
    if (await ddxSection.count() > 0) {
      await ddxSection.scrollIntoViewIfNeeded();
      await beat(3000);
    }
  } catch {
    console.warn('  Agent DDx card not found, continuing...');
    await scrollDown(page, 300);
    await beat(1500);
  }

  // 5. Consensus Panel
  try {
    await scrollDown(page, 400);
    await beat(500);
    const consensusPanel = page.locator('text=Cross-Modal Consensus').first();
    if (await consensusPanel.count() > 0) {
      await consensusPanel.scrollIntoViewIfNeeded();
      await beat(1000);
      await scrollDown(page, 300);
      await beat(3000);
    }
  } catch {
    console.warn('  Consensus panel not visible, continuing...');
    await beat(1500);
  }

  // 6. Return to top
  await scrollToTop(page);
  await beat(1500);
}
