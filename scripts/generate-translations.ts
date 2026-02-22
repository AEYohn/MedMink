#!/usr/bin/env npx tsx
/**
 * Translation generation script for MedMink Patient UI.
 *
 * Reads en.json source-of-truth and generates locale files for 22 languages.
 *
 * Translation engines (in priority order):
 *   1. MedGemma 27B via Modal (OpenAI-compatible vLLM endpoint)
 *   2. LibreTranslate (open-source, self-hosted or public)
 *   3. Placeholder files for manual review
 *
 * Usage:
 *   npx tsx scripts/generate-translations.ts
 *
 * Environment variables:
 *   MEDGEMMA_MODAL_URL  - Modal vLLM endpoint (default: from .env)
 *   MEDGEMMA_MODAL_MODEL - Model name (default: google/medgemma-27b-it)
 *   LIBRETRANSLATE_URL  - LibreTranslate API URL (default: https://libretranslate.com)
 *   LIBRETRANSLATE_KEY  - Optional API key for LibreTranslate
 */

import fs from 'fs';
import path from 'path';

// Load .env from project root (simple parser, no dependency)
function loadEnv(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(path.join(__dirname, '..', '.env'));

const LOCALES_DIR = path.join(__dirname, '..', 'dashboard', 'src', 'i18n', 'locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

const TARGET_LANGUAGES = [
  { code: 'es', name: 'Spanish', libre: 'es' },
  { code: 'zh', name: 'Simplified Chinese', libre: 'zh' },
  { code: 'ms', name: 'Malay', libre: 'ms' },
  { code: 'ta', name: 'Tamil', libre: 'ta' },
  { code: 'vi', name: 'Vietnamese', libre: 'vi' },
  { code: 'ar', name: 'Arabic', libre: 'ar' },
  { code: 'fr', name: 'French', libre: 'fr' },
  { code: 'de', name: 'German', libre: 'de' },
  { code: 'pt', name: 'Brazilian Portuguese', libre: 'pt' },
  { code: 'hi', name: 'Hindi', libre: 'hi' },
  { code: 'bn', name: 'Bengali', libre: 'bn' },
  { code: 'ko', name: 'Korean', libre: 'ko' },
  { code: 'ja', name: 'Japanese', libre: 'ja' },
  { code: 'ru', name: 'Russian', libre: 'ru' },
  { code: 'th', name: 'Thai', libre: 'th' },
  { code: 'tl', name: 'Filipino/Tagalog', libre: 'tl' },
  { code: 'he', name: 'Hebrew', libre: 'he' },
  { code: 'ur', name: 'Urdu', libre: 'ur' },
  { code: 'fa', name: 'Persian/Farsi', libre: 'fa' },
  { code: 'id', name: 'Indonesian', libre: 'id' },
  { code: 'sw', name: 'Swahili', libre: 'sw' },
  { code: 'am', name: 'Amharic', libre: 'am' },
];

// Medical/technical terms that should NOT be translated
const KEEP_ENGLISH = [
  'ESI', 'SpO2', 'CBC', 'EKG', 'BNP', 'MedMink', 'AI',
  'NKDA', 'mmHg', 'bpm', 'mg/dL', 'mg', 'mL',
];

// ---------------------------------------------------------------------------
// Engine 1: MedGemma 27B via Modal (OpenAI-compatible vLLM)
// ---------------------------------------------------------------------------

const MEDGEMMA_URL = process.env.MEDGEMMA_MODAL_URL || '';
const MEDGEMMA_MODEL = process.env.MEDGEMMA_MODAL_MODEL || 'google/medgemma-27b-it';

// MedGemma 27B has 8192 context window. We split keys into batches
// so prompt + response fits. ~40 keys per batch keeps input ~1500 tokens,
// leaving ~4000 tokens for the translated output.
const MEDGEMMA_BATCH_SIZE = 40;

function buildTranslationPrompt(enStrings: Record<string, string>, langName: string): string {
  return `Translate the following JSON from English to ${langName}.
Rules:
- Keep JSON keys as-is
- Keep {variable} placeholders as-is (e.g. {firstName}, {count})
- Keep medical terms in English: ${KEEP_ENGLISH.join(', ')}
- Keep "MedMink" and "AI" untranslated
- Keep \\n as-is
- Output ONLY the JSON object, nothing else

${JSON.stringify(enStrings, null, 2)}`;
}

async function translateBatchWithMedGemma(
  batch: Record<string, string>,
  langName: string,
): Promise<Record<string, string>> {
  const prompt = buildTranslationPrompt(batch, langName);

  const resp = await fetch(`${MEDGEMMA_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MEDGEMMA_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional medical translator. Output only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.2,
      stream: false,
    }),
    signal: AbortSignal.timeout(180_000), // 3 min timeout per batch
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`MedGemma API error ${resp.status}: ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';

  // Extract JSON from response (may contain markdown code blocks or thinking tokens)
  const cleaned = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .replace(/<unused\d+>/g, '');

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in MedGemma response');

  return JSON.parse(jsonMatch[0]);
}

async function translateWithMedGemma(
  enStrings: Record<string, string>,
  langName: string,
): Promise<Record<string, string>> {
  if (!MEDGEMMA_URL) throw new Error('MEDGEMMA_MODAL_URL not set');

  const entries = Object.entries(enStrings);
  const totalBatches = Math.ceil(entries.length / MEDGEMMA_BATCH_SIZE);
  const result: Record<string, string> = {};

  for (let i = 0; i < entries.length; i += MEDGEMMA_BATCH_SIZE) {
    const batchEntries = entries.slice(i, i + MEDGEMMA_BATCH_SIZE);
    const batch: Record<string, string> = {};
    for (const [k, v] of batchEntries) batch[k] = v;

    const batchNum = Math.floor(i / MEDGEMMA_BATCH_SIZE) + 1;
    process.stdout.write(`    batch ${batchNum}/${totalBatches}...`);

    const translated = await translateBatchWithMedGemma(batch, langName);

    // Merge into result, fill missing keys from English
    for (const [k, v] of batchEntries) {
      result[k] = translated[k] ?? v;
    }

    const gotKeys = Object.keys(translated).length;
    const expected = batchEntries.length;
    console.log(` ${gotKeys}/${expected} keys`);

    // Small delay between batches to avoid rate limiting
    if (i + MEDGEMMA_BATCH_SIZE < entries.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Engine 2: LibreTranslate (open-source)
// ---------------------------------------------------------------------------

const LIBRE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LIBRE_KEY = process.env.LIBRETRANSLATE_KEY || '';

async function translateWithLibre(
  enStrings: Record<string, string>,
  libreCode: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // Batch strings to reduce API calls — join with a separator that won't appear in values
  const SEP = '\n|||SEP|||\n';
  const entries = Object.entries(enStrings);

  // Translate in batches of 20 to stay within limits
  const BATCH_SIZE = 20;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const keys = batch.map(([k]) => k);
    const values = batch.map(([, v]) => v);
    const combined = values.join(SEP);

    const body: Record<string, string> = {
      q: combined,
      source: 'en',
      target: libreCode,
      format: 'text',
    };
    if (LIBRE_KEY) body.api_key = LIBRE_KEY;

    const resp = await fetch(`${LIBRE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`LibreTranslate error ${resp.status}: ${text.slice(0, 300)}`);
    }

    const data = await resp.json();
    const translated = (data.translatedText || '').split(SEP);

    for (let j = 0; j < keys.length; j++) {
      let val = translated[j]?.trim() || values[j];
      // Restore {variable} placeholders that may have been mangled
      const placeholders = values[j].match(/\{[a-zA-Z]+\}/g) || [];
      for (const ph of placeholders) {
        if (!val.includes(ph)) {
          // Try to find a mangled version and fix it
          const varName = ph.slice(1, -1);
          const mangled = new RegExp(`\\{\\s*${varName}\\s*\\}|${varName}`, 'i');
          val = val.replace(mangled, ph);
        }
      }
      result[keys[j]] = val;
    }

    // Small delay between batches
    if (i + BATCH_SIZE < entries.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Engine 3: Placeholder (last resort)
// ---------------------------------------------------------------------------

function generatePlaceholder(
  enStrings: Record<string, string>,
  langCode: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(enStrings)) {
    result[key] = `[${langCode.toUpperCase()}] ${value}`;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const enStrings: Record<string, string> = JSON.parse(fs.readFileSync(EN_PATH, 'utf-8'));

  const hasMedGemma = !!MEDGEMMA_URL;
  const hasLibre = !!LIBRE_URL;

  console.log(`Source: ${Object.keys(enStrings).length} keys in en.json`);
  console.log(`Targets: ${TARGET_LANGUAGES.length} languages`);
  console.log(`MedGemma: ${hasMedGemma ? MEDGEMMA_URL : 'not configured'}`);
  console.log(`LibreTranslate: ${hasLibre ? LIBRE_URL : 'not configured'}`);
  console.log('');

  let medgemmaSuccesses = 0;
  let libreSuccesses = 0;
  let placeholders = 0;

  for (const lang of TARGET_LANGUAGES) {
    const outPath = path.join(LOCALES_DIR, `${lang.code}.json`);
    let translated: Record<string, string> | null = null;
    let method = '';

    // Try MedGemma first
    if (hasMedGemma) {
      try {
        console.log(`[MedGemma] Translating → ${lang.name} (${lang.code})...`);
        translated = await translateWithMedGemma(enStrings, lang.name);
        method = 'MedGemma';
        medgemmaSuccesses++;
      } catch (err) {
        console.warn(`  ⚠ MedGemma failed for ${lang.code}: ${err}`);
      }
    }

    // Fall back to LibreTranslate
    if (!translated && hasLibre) {
      try {
        console.log(`[LibreTranslate] Translating → ${lang.name} (${lang.code})...`);
        translated = await translateWithLibre(enStrings, lang.libre);
        method = 'LibreTranslate';
        libreSuccesses++;
      } catch (err) {
        console.warn(`  ⚠ LibreTranslate failed for ${lang.code}: ${err}`);
      }
    }

    // Last resort: placeholder
    if (!translated) {
      translated = generatePlaceholder(enStrings, lang.code);
      method = 'placeholder';
      placeholders++;
    }

    fs.writeFileSync(outPath, JSON.stringify(translated, null, 2) + '\n');
    console.log(`  ✓ ${lang.code}.json written (${Object.keys(translated).length} keys) [${method}]`);

    // Rate limit between API calls
    if (method !== 'placeholder') {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('');
  console.log('Summary:');
  console.log(`  MedGemma:       ${medgemmaSuccesses} languages`);
  console.log(`  LibreTranslate: ${libreSuccesses} languages`);
  console.log(`  Placeholder:    ${placeholders} languages`);
  console.log('\nDone!');
}

main().catch(console.error);
