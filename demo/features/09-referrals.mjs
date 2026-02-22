/**
 * 09 — Specialist Referrals (~10-15s)
 * Shows: referral inbox with mocked data via route intercept
 */
import { beat, waitForPageReady, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '09_referrals';
export const title = 'Specialist Referrals';

const MOCK_REFERRALS = [
  {
    id: 'ref-001',
    patient_name: 'Maria Santos',
    patient_id: 'patient-demo-001',
    specialty: 'Maternal-Fetal Medicine',
    urgency: 'emergent',
    status: 'sent',
    reason: 'Eclampsia with HELLP syndrome at 34 weeks — requires MFM co-management for delivery planning',
    from_provider: 'Dr. Sarah Martinez',
    to_provider: 'Dr. Lisa Chang',
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    case_session_id: 'session-demo-eclampsia',
  },
  {
    id: 'ref-002',
    patient_name: 'James Chen',
    patient_id: 'patient-demo-002',
    specialty: 'Cardiology',
    urgency: 'urgent',
    status: 'viewed',
    reason: 'Chest pain with ECG changes — evaluate for possible ACS, stress testing needed',
    from_provider: 'Dr. Sarah Martinez',
    to_provider: 'Dr. Michael Kim',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    case_session_id: null,
  },
  {
    id: 'ref-003',
    patient_name: 'Aisha Patel',
    patient_id: 'patient-demo-003',
    specialty: 'Neurology',
    urgency: 'routine',
    status: 'responded',
    reason: 'Recurrent migraine with aura — evaluate for prophylaxis optimization',
    from_provider: 'Dr. Sarah Martinez',
    to_provider: 'Dr. Rachel Foster',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    case_session_id: null,
    response_note: 'Appointment scheduled for 02/25. Will evaluate for CGRP antagonist therapy.',
  },
];

export async function record(page, baseUrl) {
  await seedLocalStorage(page, { patients: true, caseSessions: true, visitSummaries: false });

  // Mock the referrals API
  await page.route('**/api/case/referrals/inbox**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REFERRALS),
    });
  });

  // Navigate to referrals page
  await page.goto(`${baseUrl}/referrals`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(2000);

  // View the referral list
  await beat(1500);

  // Scroll to see all referrals
  await scrollDown(page, 300);
  await beat(1500);

  // Click on the first referral to see details
  const firstReferral = page.getByText('Maria Santos').first();
  if (await firstReferral.isVisible()) {
    await firstReferral.click();
    await beat(2000);
    await scrollDown(page, 300);
    await beat(1500);
  }

  // Go back
  await page.goBack();
  await waitForPageReady(page);
  await beat(1500);
}
