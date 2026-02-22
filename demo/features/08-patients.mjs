/**
 * 08 — Patient Management (~15-20s)
 * Shows: patient list, add new patient form, patient detail
 */
import { beat, waitForPageReady, slowType, scrollDown } from '../lib/timing.mjs';
import { seedLocalStorage } from '../lib/seed.mjs';

export const name = '08_patients';
export const title = 'Patient Management';

export async function record(page, baseUrl) {
  // Seed patients
  await seedLocalStorage(page, { patients: true, caseSessions: true, visitSummaries: true });

  // Navigate to patients page
  await page.goto(`${baseUrl}/patients`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Show the patient list
  await beat(1500);

  // Search for a patient
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible()) {
    await slowType(page, 'input[placeholder*="earch"]', 'Chen', 60);
    await beat(1500);
    await searchInput.clear();
    await beat(500);
  }

  // Click "Add Patient" or "New Patient" button
  const addBtn = page.getByText(/add.*patient|new.*patient/i).first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await beat(1000);

    // Fill in the new patient form
    const firstNameInput = page.getByLabel(/first name/i).first();
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill('Robert');
      await beat(300);
    }

    const lastNameInput = page.getByLabel(/last name/i).first();
    if (await lastNameInput.isVisible()) {
      await lastNameInput.fill('Williams');
      await beat(300);
    }

    const dobInput = page.getByLabel(/date of birth/i).first();
    if (await dobInput.isVisible()) {
      await dobInput.fill('1970-06-15');
      await beat(300);
    }

    const mrnInput = page.getByLabel(/mrn/i).first();
    if (await mrnInput.isVisible()) {
      await mrnInput.fill('MRN-2024-0500');
      await beat(300);
    }

    await beat(1000);
    await scrollDown(page, 300);
    await beat(1000);
  }

  // Go back to the list
  await page.goto(`${baseUrl}/patients`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
  await beat(1500);

  // Click on a patient to view details
  const patientRow = page.getByText('Maria Santos').first();
  if (await patientRow.isVisible()) {
    await patientRow.click();
    await beat(2000);
    await scrollDown(page, 300);
    await beat(1500);
  }
}
