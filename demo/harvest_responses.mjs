#!/usr/bin/env node
/**
 * Harvest real API responses from the local FastAPI backend for demo mocks.
 *
 * Usage:
 *   1. Start the backend:  python -m src.api.main
 *   2. Run:                node demo/harvest_responses.mjs
 *
 * Set API_URL env var to override the default (http://localhost:8000).
 * Output: demo/fixtures/api_responses.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'http://localhost:8000';
const IS_REMOTE = !API_URL.includes('localhost') && !API_URL.includes('127.0.0.1');
const FIXTURES_DIR = join(__dirname, 'fixtures');
const OUTPUT_PATH = join(FIXTURES_DIR, 'api_responses.json');

// ---------------------------------------------------------------------------
// Input data — sourced from feature scripts (03-interview, 04-ems, chart page)
// ---------------------------------------------------------------------------

const PATIENT_RESPONSES = [
  "I've been having this terrible chest pain for about 2 hours. It started while I was resting and it feels like a heavy pressure right in the center of my chest.",
  "Yes, the pain goes to my left arm and jaw. I'm also feeling short of breath and a bit nauseous. I've been sweating a lot too.",
  "I have high blood pressure and high cholesterol. My father had a heart attack at age 55. I've been a smoker for 20 years, about a pack a day.",
  "I take lisinopril 20mg, atorvastatin 40mg, and aspirin 81mg every day. No allergies to any medications that I know of."
];

const DICTATION_TURNS = [
  "Dispatched to 742 Evergreen Terrace for a 58-year-old male with chest pain. Arrived on scene at 14:32. Patient found sitting upright in living room, alert and oriented, diaphoretic.",
  "Patient states substernal chest pain started approximately 45 minutes ago, rated 8 out of 10, radiating to left arm. History of hypertension and diabetes. Takes metformin and lisinopril daily.",
  "Vitals on scene: blood pressure 168/98, heart rate 104, respiratory rate 22, SpO2 94% on room air, blood glucose 142. 12-lead ECG shows ST elevation in leads V1 through V4.",
  "Administered aspirin 324mg PO, nitroglycerin 0.4mg sublingual with mild relief. Established 18-gauge IV left AC, normal saline TKO. Applied oxygen via nasal cannula at 4 liters.",
  "Transported emergent to General Hospital, STEMI alert activated en route. Pain decreased to 5 out of 10 after second nitro. Repeat vitals: BP 152/88, HR 96, SpO2 97%. Arrived at ED at 14:58, care transferred to Dr. Martinez."
];

const EXAMPLE_DICTATION = `Patient is a 62-year-old male presenting with chief complaint of substernal chest pressure for approximately 2 hours, onset at rest. He describes the pain as heavy pressure in the center of his chest, radiating to the left arm and jaw, associated with shortness of breath, nausea, and diaphoresis. Pain is constant since onset, not relieved by rest. Past medical history significant for hypertension, hyperlipidemia, and 20-pack-year smoking history. Family history notable for father with myocardial infarction at age 55. Home medications include lice in oh pril 20 milligrams daily, a tore va statin 40 milligrams daily, and aspirin 81 milligrams daily. No known drug allergies. Vital signs: blood pressure 162 over 98, heart rate 94, respiratory rate 20, oxygen saturation 96 percent on room air, temperature 98.4. Physical exam: patient is anxious and diaphoretic, regular rate and rhythm, no murmurs rubs or gallops, lungs clear to auscultation bilaterally, no lower extremity edema. 12 lead EKG shows ST elevation in leads V2 through V5 with reciprocal changes in inferior leads. Initial troponin I elevated at 0.82. Assessment is acute STEMI, ST elevation myocardial infarction, anterior wall. Plan: Cath lab activated, aspirin 325 milligrams chewed and swallowed, ticagrelor 180 milligrams loading dose, heparin bolus 60 units per kilogram, morphine 4 milligrams IV for pain, supplemental oxygen via nasal cannula at 2 liters. Cardiology on the way for emergent PCI. Admit to CCU post procedure.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`  ${msg}`);
}

async function fetchWithRetry(url, opts, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      const msg = err.message || '';
      const retryable = /fetch failed|ECONNRESET|socket hang up|ETIMEDOUT/i.test(msg);
      if (!retryable || attempt === maxRetries) throw err;
      const delay = [5000, 15000, 30000][attempt - 1] || 30000;
      log(`Attempt ${attempt} failed (${msg}), retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function fetchJSON(path, body = {}) {
  const res = await fetchWithRetry(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10 * 60 * 1000), // 10 min for Modal cold starts
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Upload a file as multipart form data */
async function fetchWithFile(path, filePath, fileField = 'image', extraFields = {}) {
  const fileData = await readFile(filePath);
  const fileName = filePath.split('/').pop();

  // Use undici or node native FormData with Blob
  const formData = new FormData();
  const blob = new Blob([fileData], { type: 'image/jpeg' });
  formData.append(fileField, blob, fileName);
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }

  const res = await fetchWithRetry(`${API_URL}${path}`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Fetch an SSE endpoint, collect all parsed JSON events, and return them.
 * Stops reading as soon as a `{ type: "done" }` event is received.
 */
async function fetchSSE(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 min

  const res = await fetchWithRetry(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  if (!res.ok) {
    clearTimeout(timeout);
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  const events = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            events.push(event);
            if (event.type === 'done') {
              reader.cancel();
              clearTimeout(timeout);
              return events;
            }
          } catch {
            // skip non-JSON data lines (heartbeats, etc.)
          }
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  return events;
}

// ---------------------------------------------------------------------------
// Harvesters
// ---------------------------------------------------------------------------

async function harvestCaseAnalysis() {
  console.log('\n[1/12] Case Analysis...');
  const caseText = (await readFile(join(__dirname, 'stemi_case.txt'), 'utf-8')).trim();

  /** Build SSE-shaped events from a sync result */
  function wrapSyncResult(result) {
    return [
      { type: 'step', step: 'parsing', status: 'completed', progress: 0.15, message: 'Parsing clinical case...' },
      { type: 'step', step: 'parallel_analysis', status: 'completed', progress: 0.30, message: 'Analyzing treatment options...' },
      { type: 'step', step: 'evidence_search', status: 'completed', progress: 0.50, message: 'Searching PubMed for evidence...' },
      { type: 'step', step: 'evaluating', status: 'completed', progress: 0.70, message: 'Evaluating against evidence...' },
      { type: 'step', step: 'medication_review', status: 'completed', progress: 0.85, message: 'Reviewing medications for safety...' },
      { type: 'step', step: 'complete', status: 'completed', progress: 1.0, message: 'Analysis complete' },
      { type: 'result', data: result },
      { type: 'done' },
    ];
  }

  let events;

  // Skip SSE for remote endpoints — Modal's ASGI bridge drops SSE connections
  if (IS_REMOTE) {
    log(`Remote API detected — using sync /api/case/analyze (skipping SSE)`);
    const result = await fetchJSON('/api/case/analyze', { case_text: caseText });
    log(`Got sync result (${Object.keys(result).length} keys)`);
    events = wrapSyncResult(result);
  } else {
    // Local: try streaming first, fall back to sync if SSE breaks
    try {
      log(`Trying SSE stream /api/case/analyze/stream...`);
      events = await fetchSSE('/api/case/analyze/stream', { case_text: caseText });
      const hasResult = events.some(e => e.type === 'result');
      if (!hasResult) throw new Error(`Stream returned ${events.length} events but no result`);
      log(`Collected ${events.length} SSE events from stream`);
    } catch (streamErr) {
      log(`SSE stream failed (${streamErr.message}), falling back to sync endpoint...`);
      const result = await fetchJSON('/api/case/analyze', { case_text: caseText });
      log(`Got sync result (${Object.keys(result).length} keys)`);
      events = wrapSyncResult(result);
    }
  }

  const resultEvent = events.find(e => e.type === 'result');
  if (resultEvent) {
    const keys = Object.keys(resultEvent.data || {});
    log(`Result keys: ${keys.join(', ')}`);
  }
  return { events };
}

// ---------------------------------------------------------------------------
// Case-dependent harvesters (need case analysis result)
// ---------------------------------------------------------------------------

/** Extract the result data from case analysis events */
function extractCaseResult(caseAnalysis) {
  const resultEvent = caseAnalysis.events.find(e => e.type === 'result');
  return resultEvent?.data || {};
}

async function harvestAIAssist(caseResult) {
  log('Harvesting AI Assist...');
  const result = await fetchJSON('/api/case/ai-assist', {
    context_type: 'treatment',
    context_item: caseResult.top_recommendation || '',
    question: 'why_recommended',
    case_snippet: (caseResult.parsed_case?.findings?.presentation || '').slice(0, 500),
  });
  log(`AI Assist answer: ${(result.answer || '').slice(0, 80)}...`);
  return result;
}

async function harvestDischargePlan(caseResult) {
  log('Harvesting Discharge Plan...');
  const result = await fetchJSON('/api/case/discharge-plan', {
    parsed_case: caseResult.parsed_case || {},
    treatment_options: caseResult.treatment_options || [],
    acute_management: caseResult.acute_management || {},
    top_recommendation: caseResult.top_recommendation || '',
  });
  log(`Discharge Plan: ${Object.keys(result).length} keys`);
  return result;
}

async function harvestReferral(caseResult) {
  log('Harvesting Referral...');
  const result = await fetchJSON('/api/case/referral', {
    specialty: 'Interventional Cardiology',
    parsed_case: caseResult.parsed_case || {},
    treatment_options: caseResult.treatment_options || [],
    acute_management: caseResult.acute_management || {},
  });
  log(`Referral: ${result.specialty || 'unknown specialty'}`);
  return result;
}

async function harvestHandoff(caseResult, format) {
  log(`Harvesting Handoff (${format})...`);
  const result = await fetchJSON('/api/case/handoff', {
    format,
    parsed_case: caseResult.parsed_case || {},
    treatment_options: caseResult.treatment_options || [],
    acute_management: caseResult.acute_management || {},
  });
  log(`Handoff (${format}): ${Object.keys(result.content || result).length} keys`);
  return result;
}

async function harvestMedSafety(caseResult) {
  log('Harvesting Medication Safety...');
  const pc = caseResult.parsed_case || {};
  const treatmentNames = (caseResult.treatment_options || []).map(t => t.name);
  const result = await fetchJSON('/api/case/medication-safety', {
    current_medications: pc.management?.medications || [],
    new_medications: treatmentNames,
    patient_conditions: pc.patient?.relevant_history || [],
    allergies: [],
    labs: pc.findings?.labs || [],
    age: pc.patient?.age || '',
    sex: pc.patient?.sex || '',
  });
  log(`Med Safety: ${(result.interactions || []).length} interactions, overall=${result.overall_safety}`);
  return result;
}

async function harvestImageAnalysis() {
  log('Harvesting Image Analysis...');
  const cxrPath = join(__dirname, 'fixtures', 'sample_cxr.jpg');
  const result = await fetchWithFile('/api/case/image/analyze', cxrPath, 'image', {
    context: '62M STEMI, post-PCI',
    modality: 'xray',
  });
  log(`Image Analysis: ${(result.findings || []).length} findings, modality=${result.modality}`);
  return result;
}

async function harvestLabExtraction() {
  log('Harvesting Lab Extraction...');
  const labPath = join(__dirname, 'fixtures', 'sample_lab.jpg');
  const result = await fetchWithFile('/api/labs/extract', labPath, 'image');
  log(`Lab Extraction: ${(result.labs || []).length} lab values`);
  return result;
}

async function harvestSOAPFromCase() {
  log('Harvesting SOAP from Case...');
  const caseText = (await readFile(join(__dirname, 'stemi_case.txt'), 'utf-8')).trim();
  const result = await fetchJSON('/api/chart/enhance-sync', {
    dictation_text: caseText,
  });
  log(`SOAP from Case: ${Object.keys(result.soap || result).length} sections`);
  return result;
}

// ---------------------------------------------------------------------------
// Independent harvesters (interview, EMS, chart enhance)
// ---------------------------------------------------------------------------

async function harvestInterview() {
  console.log('\n[2/12] Interview...');

  // Start session
  const start = await fetchJSON('/api/interview/start', { language: 'en' });
  log(`Started session ${start.session_id}, phase: ${start.phase}`);

  const conversationHistory = [
    { role: 'assistant', content: start.question },
  ];
  const turns = [];
  let currentPhase = start.phase;

  for (let i = 0; i < PATIENT_RESPONSES.length; i++) {
    const text = PATIENT_RESPONSES[i];
    conversationHistory.push({ role: 'user', content: text });

    const resp = await fetchJSON('/api/interview/respond', {
      session_id: start.session_id,
      text,
      conversation_history: conversationHistory,
      phase: currentPhase,
    });

    turns.push(resp);
    conversationHistory.push({ role: 'assistant', content: resp.question });
    currentPhase = resp.phase;
    log(`Turn ${i + 1}: phase=${resp.phase}, red_flags=${(resp.red_flags || []).length}`);
  }

  // Complete the interview and get triage result
  const complete = await fetchJSON(`/api/interview/${start.session_id}/complete`, {
    conversation_history: conversationHistory,
    phase: currentPhase,
  });
  log(`Triage: ESI ${complete.esi_level}, setting: ${complete.recommended_setting}`);

  return { start, turns, complete };
}

async function harvestEMS() {
  console.log('\n[3/12] EMS Report...');

  // Start session
  const start = await fetchJSON('/api/ems/start', {});
  log(`Started session ${start.session_id}, run_id: ${start.run_id}`);

  const conversationHistory = [
    { role: 'assistant', content: start.question },
  ];
  const turns = [];
  let currentPhase = start.phase;
  let currentExtractedData = start.extracted_data || {};

  for (let i = 0; i < DICTATION_TURNS.length; i++) {
    const text = DICTATION_TURNS[i];
    conversationHistory.push({ role: 'user', content: text });

    const resp = await fetchJSON('/api/ems/dictate', {
      session_id: start.session_id,
      text,
      conversation_history: conversationHistory,
      phase: currentPhase,
      extracted_data: currentExtractedData,
    });

    turns.push(resp);
    conversationHistory.push({ role: 'assistant', content: resp.question });
    currentPhase = resp.phase;
    currentExtractedData = resp.extracted_data || currentExtractedData;

    const pct = resp.section_completeness
      ? Object.values(resp.section_completeness).map(v => Math.round(v * 100) + '%').join(' ')
      : 'n/a';
    log(`Turn ${i + 1}: phase=${resp.phase}, completeness=[${pct}]`);
  }

  // Complete the run report
  const complete = await fetchJSON(`/api/ems/${start.session_id}/complete`);
  log(`Completed: ${(complete.icd10_codes || []).length} ICD-10 codes, narrative ${(complete.narrative || '').length} chars`);

  return { start, turns, complete };
}

async function harvestChartEnhance() {
  console.log('\n[4/12] Chart Enhance...');
  log(`Sending ${EXAMPLE_DICTATION.length}-char dictation to /api/chart/enhance`);

  const events = await fetchSSE('/api/chart/enhance', { dictation_text: EXAMPLE_DICTATION });
  log(`Collected ${events.length} SSE events`);

  const resultEvent = events.find(e => e.type === 'result');
  if (resultEvent?.data?.soap) {
    const soapKeys = Object.keys(resultEvent.data.soap);
    log(`SOAP sections: ${soapKeys.join(', ')}`);
  }
  return { events };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Harvesting API responses from ${API_URL}...`);

  // Check backend is reachable
  try {
    const res = await fetchWithRetry(`${API_URL}/openapi.json`, {
      signal: AbortSignal.timeout(IS_REMOTE ? 30000 : 5000),
    });
    if (!res.ok) throw new Error(`returned ${res.status}`);
    console.log('Backend is reachable.\n');
  } catch (err) {
    console.error(`\nERROR: Cannot reach backend at ${API_URL}`);
    console.error(`Start it first:  python -m src.api.main`);
    console.error(`Set API_URL env var if using a different port.\n`);
    process.exit(1);
  }

  const fixtures = { harvestedAt: new Date().toISOString() };
  const allSections = [];
  let failures = 0;

  async function harvest(name, label, fn) {
    allSections.push(name);
    try {
      fixtures[name] = await fn();
    } catch (err) {
      console.error(`  FAILED (${name}): ${err.message}`);
      fixtures[name] = null;
      failures++;
    }
  }

  // ── Phase 1: Case Analysis (required by subsequent harvesters) ──────
  await harvest('caseAnalysis', '1/12', harvestCaseAnalysis);

  // ── Phase 2: Case-dependent harvesters (sequential, need caseResult) ─
  const caseResult = fixtures.caseAnalysis ? extractCaseResult(fixtures.caseAnalysis) : {};
  if (fixtures.caseAnalysis) {
    console.log('\n[5-10/12] Case-dependent endpoints...');
    await harvest('aiAssist', '5/12', () => harvestAIAssist(caseResult));
    await harvest('dischargePlan', '6/12', () => harvestDischargePlan(caseResult));
    await harvest('referral', '7/12', () => harvestReferral(caseResult));
    await harvest('handoffIpass', '8/12', () => harvestHandoff(caseResult, 'ipass'));
    await harvest('handoffSbar', '9/12', () => harvestHandoff(caseResult, 'sbar'));
    await harvest('medicationSafety', '10/12', () => harvestMedSafety(caseResult));
  } else {
    console.log('\n  Skipping case-dependent endpoints (case analysis failed)');
    for (const s of ['aiAssist', 'dischargePlan', 'referral', 'handoffIpass', 'handoffSbar', 'medicationSafety']) {
      allSections.push(s);
      fixtures[s] = null;
      failures++;
    }
  }

  // ── Phase 3: Independent harvesters (can run in parallel with phase 2) ─
  // Run sequentially for simplicity since Modal cold starts can conflict
  console.log('\n[11-12/12] Independent endpoints...');
  await harvest('imageAnalysis', '11/12', harvestImageAnalysis);
  await harvest('labExtraction', '12/12', harvestLabExtraction);
  await harvest('soapFromCase', '13/12', harvestSOAPFromCase);

  // ── Phase 4: Interview, EMS, Chart Enhance (existing) ──────────────
  await harvest('interview', '2/12', harvestInterview);
  await harvest('ems', '3/12', harvestEMS);
  await harvest('chartEnhance', '4/12', harvestChartEnhance);

  // Write output
  await mkdir(FIXTURES_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(fixtures, null, 2));

  const ok = allSections.filter(s => fixtures[s] !== null).length;

  console.log(`\nDone! ${ok}/${allSections.length} sections harvested.`);
  if (failures > 0) console.log(`${failures} section(s) failed — re-run after fixing backend issues.`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
