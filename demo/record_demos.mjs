#!/usr/bin/env node
/**
 * Demo Video Recorder — records 10 feature demo videos as MP4
 *
 * Usage:
 *   node demo/record_demos.mjs                          # Record all 10 features
 *   node demo/record_demos.mjs --feature=dashboard      # Single feature
 *   node demo/record_demos.mjs --feature=dashboard,interview  # Multiple features
 *   node demo/record_demos.mjs --headless=false         # Show browser (default: headless)
 *   node demo/record_demos.mjs --skip-convert           # Skip ffmpeg MP4 conversion
 *   node demo/record_demos.mjs --base-url=http://...    # Custom base URL
 *   node demo/record_demos.mjs --concat=03_interview,05_charting  # Concatenate clips
 */

import { launchBrowser, createRecordingContext, finishRecording } from './lib/browser.mjs';
import { convertAllWebmToMp4, concatMp4s } from './lib/convert.mjs';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeTimestampedDir() {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  return join(__dirname, 'output', ts);
}

const OUTPUT_DIR = makeTimestampedDir();
const WEBM_DIR = join(OUTPUT_DIR, '_webm');

// All features in order
const FEATURES = [
  { id: 'dashboard',       module: './features/01-dashboard.mjs' },
  { id: 'case-analysis',   module: './features/02-case-analysis.mjs' },
  { id: 'case-assessment', module: './features/02a-case-assessment.mjs' },
  { id: 'case-treatment',  module: './features/02b-case-treatment.mjs' },
  { id: 'case-safety',     module: './features/02c-case-safety.mjs' },
  { id: 'case-orders',     module: './features/02d-case-orders.mjs' },
  { id: 'case-tools',      module: './features/02e-case-tools.mjs' },
  { id: 'interview',       module: './features/03-interview.mjs' },
  { id: 'ems-report',      module: './features/04-ems-report.mjs' },
  { id: 'charting',        module: './features/05-charting.mjs' },
  { id: 'imaging',         module: './features/06-imaging.mjs' },
  { id: 'labs',            module: './features/07-labs.mjs' },
  { id: 'patients',        module: './features/08-patients.mjs' },
  { id: 'referrals',       module: './features/09-referrals.mjs' },
  { id: 'patient-portal',  module: './features/10-patient-portal.mjs' },
];

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    features: null,       // null = all
    headless: true,
    skipConvert: false,
    baseUrl: 'http://localhost:3000',
    concat: null,         // e.g. ['03_interview', '05_charting']
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

async function main() {
  const opts = parseArgs();

  // Determine which features to record
  let featuresToRecord = FEATURES;
  if (opts.features) {
    featuresToRecord = FEATURES.filter(f => opts.features.includes(f.id));
    if (featuresToRecord.length === 0) {
      console.error(`No matching features found. Available: ${FEATURES.map(f => f.id).join(', ')}`);
      process.exit(1);
    }
  }

  // Ensure output directories exist
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(WEBM_DIR, { recursive: true });

  console.log(`\n=== Demo Video Recorder ===`);
  console.log(`Base URL: ${opts.baseUrl}`);
  console.log(`Headless: ${opts.headless}`);
  console.log(`Features: ${featuresToRecord.map(f => f.id).join(', ')}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Launch browser
  const browser = await launchBrowser(opts.headless);

  let successCount = 0;
  let failCount = 0;

  for (const feature of featuresToRecord) {
    console.log(`\n--- Recording: ${feature.id} ---`);
    const startTime = Date.now();

    try {
      // Import the feature module
      const mod = await import(feature.module);

      // Create recording context
      const context = await createRecordingContext(browser, mod.name, OUTPUT_DIR);
      const page = await context.newPage();

      // Record the feature
      await mod.record(page, opts.baseUrl);

      // Finish recording — close context, rename video file
      await finishRecording(context, page, OUTPUT_DIR);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Done: ${mod.title} (${duration}s)`);
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
      console.log('Videos are still available as .webm in demo/output/_webm/');
      console.log('Install ffmpeg to enable conversion: brew install ffmpeg');
    }
  }

  // Concatenate clips if --concat flag provided
  if (opts.concat && opts.concat.length > 1) {
    console.log(`\nConcatenating clips: ${opts.concat.join(', ')}`);
    const inputPaths = opts.concat.map(name => join(OUTPUT_DIR, `${name}.mp4`));
    const outputPath = join(OUTPUT_DIR, 'combined_demo.mp4');
    try {
      await concatMp4s(inputPaths, outputPath);
    } catch (err) {
      console.error(`\nConcatenation failed: ${err.message}`);
      console.log('Individual MP4 files are still available in the output directory.');
    }
  }

  console.log(`\nDone! Videos saved to: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
