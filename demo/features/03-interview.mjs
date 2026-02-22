/**
 * 03 — Patient Interview (~70-90s)
 * Shows: start interview, 6 patient turns, auto-triage (ESI result with red flags,
 *        HPI summary, ROS, recommendations), management plan panel (DDx,
 *        investigations, treatment, disposition)
 */
import { beat, waitForPageReady, scrollDown, centerOn } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';
import { mockInterviewStart, mockInterviewRespond, mockInterviewComplete, mockManagementPlan } from '../lib/mocks.mjs';

export const name = '03_interview';
export const title = 'AI Patient Interview';

const PATIENT_RESPONSES = [
  // Turn 0 → chief_complaint
  "I've been having this terrible chest pain for about 2 hours. It started while I was resting and it feels like a heavy pressure right in the center of my chest.",
  // Turn 1 → hpi
  "Yes, the pain goes to my left arm and jaw. I'm also feeling short of breath and a bit nauseous. I've been sweating a lot too.",
  // Turn 2 → hpi
  "I have high blood pressure and high cholesterol. My father had a heart attack at age 55. I've been a smoker for 20 years, about a pack a day.",
  // Turn 3 → review_of_systems
  "I take lisinopril 20mg, atorvastatin 40mg, and aspirin 81mg every day. No allergies to any medications that I know of.",
  // Turn 4 → review_and_triage (triggers auto-triage)
  "No, I don't think I'm having shortness of breath, but the sweating won't stop and the pain is still there.",
  // Turn 5 → review_and_triage (confirmation — may not be reached if auto-triage fires)
  "Yes, that sounds right."
];

/** Helper: scroll management plan panel by a given amount */
function scrollMgmtPanel(page, top) {
  return page.evaluate((scrollTop) => {
    const panels = document.querySelectorAll('[class*="overflow-y-auto"]');
    for (const panel of panels) {
      if (panel.textContent?.includes('Management Plan') || panel.textContent?.includes('Differential')) {
        if (scrollTop === 'bottom') {
          panel.scrollTop = panel.scrollHeight;
        } else if (scrollTop === 'top') {
          panel.scrollTop = 0;
        } else {
          panel.scrollBy({ top: scrollTop, behavior: 'smooth' });
        }
        break;
      }
    }
  }, top);
}

export async function record(page, baseUrl) {
  // Seed patients for context
  await seedLocalStorage(page, { patients: true, caseSessions: false, visitSummaries: false });

  // Install API mocks before navigating
  await mockInterviewStart(page);
  await mockInterviewRespond(page);
  await mockInterviewComplete(page);
  await mockManagementPlan(page);

  // Navigate to interview page
  await page.goto(`${baseUrl}/interview`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  // Click Start Interview (scroll into view first — sidebar may push it below viewport)
  const startBtn = page.locator('button:has-text("Start Interview")');
  await startBtn.scrollIntoViewIfNeeded();
  await beat(500);
  await startBtn.click();
  await beat(1000);

  // Wait for the AI greeting to appear (textarea becomes visible once session starts)
  try {
    await page.locator('textarea[placeholder*="Type your response"]').waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    console.warn('  Timeout waiting for greeting, continuing...');
  }
  await beat(2000);

  // ---------------------------------------------------------------------------
  // Send patient responses (loop exits early if textarea disappears after triage)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < PATIENT_RESPONSES.length; i++) {
    const response = PATIENT_RESPONSES[i];

    const textarea = page.locator('textarea[placeholder*="Type your response"]');
    if (!(await textarea.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`  Textarea gone after turn ${i} — auto-triage likely fired`);
      break;
    }

    // Count current messages to detect new ones
    const msgCountBefore = await page.evaluate(() =>
      document.querySelectorAll('[class*="rounded-2xl"][class*="px-"]').length
    );

    await textarea.click();
    await beat(300);
    await textarea.pressSequentially(response, { delay: 25 });
    await beat(500);

    // Submit (press Enter)
    await textarea.press('Enter');
    await beat(1500);

    // Wait for AI response to appear (new message count increases)
    try {
      await page.waitForFunction(
        (prevCount) => {
          const msgs = document.querySelectorAll('[class*="rounded-2xl"][class*="px-"]');
          return msgs.length > prevCount;
        },
        msgCountBefore,
        { timeout: 10000 }
      );
    } catch {
      // continue even if count detection fails
    }
    await beat(1500);

    // Scroll chat to bottom to see latest messages
    await page.evaluate(() => {
      const chatContainer = document.querySelector('[class*="overflow-y-auto"]');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    });
    await beat(1000);
  }

  // ---------------------------------------------------------------------------
  // Auto-triage fires automatically when mock returns phase: "review_and_triage"
  // → frontend auto-calls completeInterview → ESI triage result appears
  // ---------------------------------------------------------------------------
  await beat(2000);

  try {
    await page.waitForFunction(
      () => document.body.innerText.includes('ESI'),
      { timeout: 25000 }
    );
  } catch {
    console.warn('  Timeout waiting for auto-triage result, continuing...');
  }

  // Dwell on the ESI triage result header
  await beat(3500);

  // ---------------------------------------------------------------------------
  // Scroll through the full triage result (red flags, HPI summary, ROS, recs)
  // ---------------------------------------------------------------------------

  // Show red flags section
  await centerOn(page, 'Red Flags', { pause: 3000 });

  // Show HPI summary
  await centerOn(page, 'Chief Complaint', { pause: 3000 });

  // Show Review of Systems
  await centerOn(page, 'Review of Systems', { pause: 2500 });

  // Show setting rationale / recommended setting
  await centerOn(page, 'Setting Rationale', { pause: 3000 });

  // Scroll back to top to show the phase progress bar in complete state
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await beat(3000);

  // ---------------------------------------------------------------------------
  // Show the Management Plan panel on the right side (DDx, investigations,
  // treatment plan, disposition)
  // ---------------------------------------------------------------------------

  // Reset management plan panel to top
  await scrollMgmtPanel(page, 'top');
  await beat(2000);

  // Scroll through DDx section
  await scrollMgmtPanel(page, 250);
  await beat(2500);

  // Scroll through investigations
  await scrollMgmtPanel(page, 300);
  await beat(2500);

  // Scroll through treatment plan
  await scrollMgmtPanel(page, 350);
  await beat(2500);

  // Scroll to bottom to show disposition
  await scrollMgmtPanel(page, 'bottom');
  await beat(3000);

  // Scroll back to top for a final overview
  await scrollMgmtPanel(page, 'top');
  await beat(2000);
}
