/**
 * Smart Mock Interview Engine — runs entirely in the browser when the backend
 * API is unreachable. Detects acuity from patient responses, extracts
 * structured info cumulatively, skips phases whose data is already collected,
 * and fast-tracks emergencies to triage in 2-3 exchanges.
 */

// ── Types ──

interface MockMessage {
  role: 'assistant' | 'user';
  content: string;
}

interface ExtractedInfo {
  chiefComplaint: string | null;
  onset: string | null;
  duration: string | null;
  severity: string | null;
  location: string | null;
  radiation: string | null;
  quality: string | null;
  aggravating: string | null;
  alleviating: string | null;
  associatedSymptoms: string[];
  conditions: string[];
  medications: string[];
  allergies: string[];
  allergiesAsked: boolean;
  surgeries: string[];
  socialHistory: string[];
  familyHistory: string[];
  rosPositive: string[];
  rosNegative: string[];
  redFlags: string[];
}

type AcuityTier = 'esi1' | 'esi2' | 'esi3' | 'esi4_5';

// ── Keyword Dictionaries ──

const ESI1_PATTERNS = [
  'not breathing', 'stopped breathing', 'unconscious', 'unresponsive',
  'seizure now', 'having a seizure', 'actively seizing', 'severe bleeding',
  'won\'t stop bleeding', 'bleeding out', 'no pulse', 'cardiac arrest',
  'choking', 'anaphylaxis', 'can\'t swallow', 'throat closing',
];

const ESI2_PATTERNS: Array<{ requires: string[]; plus: string[] } | string> = [
  // Chest pain combos
  { requires: ['chest pain', 'chest pressure', 'chest tightness'], plus: ['arm', 'jaw', 'sweating', 'sweat', 'diaphoresis', 'pressure', 'crushing', 'radiating', 'radiate'] },
  'worst headache', 'thunderclap headache', 'worst headache of my life',
  'can\'t breathe', 'cannot breathe', 'severe shortness of breath',
  'struggling to breathe', 'gasping',
  'stroke', 'face drooping', 'arm weakness', 'slurred speech', 'facial droop',
  'crushing chest', 'elephant on my chest',
  'coughing blood', 'coughing up blood', 'vomiting blood',
  'sudden vision loss', 'sudden blindness',
  'severe allergic reaction',
];

const ESI3_KEYWORDS = [
  'fever', 'abdominal pain', 'stomach pain', 'belly pain',
  'blood in stool', 'rectal bleeding', 'bloody stool',
  'back pain', 'numbness', 'tingling',
  'vomiting', 'can\'t keep anything down',
  'high fever', 'dehydrated', 'severe pain',
  'kidney stone', 'appendicitis',
  'wound', 'laceration', 'deep cut',
];

const ESI4_5_KEYWORDS = [
  'cold', 'runny nose', 'stuffy nose', 'congestion',
  'sore throat', 'cough', 'mild cough',
  'rash', 'itchy', 'hives',
  'sprain', 'twisted', 'mild headache', 'earache', 'ear pain',
  'pink eye', 'conjunctivitis', 'bug bite', 'insect bite',
  'prescription refill', 'medication refill',
];

const CONDITION_KEYWORDS = [
  'diabetes', 'diabetic', 'type 1', 'type 2',
  'hypertension', 'high blood pressure', 'htn',
  'asthma', 'copd', 'emphysema',
  'heart disease', 'heart failure', 'chf', 'coronary artery disease', 'cad',
  'atrial fibrillation', 'afib', 'a-fib',
  'anxiety', 'depression', 'bipolar',
  'arthritis', 'rheumatoid', 'osteoarthritis',
  'thyroid', 'hypothyroid', 'hyperthyroid',
  'kidney disease', 'ckd', 'liver disease', 'cirrhosis',
  'cancer', 'stroke history', 'previous stroke', 'dvt', 'pulmonary embolism',
  'seizure disorder', 'epilepsy',
  'hiv', 'hepatitis',
];

const MED_KEYWORDS = [
  'aspirin', 'ibuprofen', 'tylenol', 'acetaminophen', 'naproxen',
  'metformin', 'insulin', 'glipizide', 'jardiance', 'ozempic',
  'lisinopril', 'losartan', 'amlodipine', 'hydrochlorothiazide', 'hctz',
  'atorvastatin', 'rosuvastatin', 'simvastatin',
  'metoprolol', 'carvedilol', 'atenolol', 'propranolol',
  'omeprazole', 'pantoprazole', 'famotidine',
  'warfarin', 'coumadin', 'eliquis', 'apixaban', 'xarelto', 'rivaroxaban',
  'plavix', 'clopidogrel', 'blood thinner', 'blood thinners',
  'albuterol', 'inhaler', 'fluticasone', 'montelukast', 'singulair',
  'levothyroxine', 'synthroid',
  'sertraline', 'zoloft', 'fluoxetine', 'prozac', 'escitalopram', 'lexapro',
  'gabapentin', 'pregabalin', 'lyrica',
  'prednisone', 'prednisolone', 'dexamethasone',
  'vitamin d', 'multivitamin', 'fish oil', 'calcium', 'iron',
];

const ALLERGY_KEYWORDS = [
  'penicillin', 'amoxicillin', 'sulfa', 'sulfamethoxazole',
  'latex', 'iodine', 'contrast dye',
  'codeine', 'morphine', 'hydrocodone', 'oxycodone',
  'nsaid', 'nsaids', 'aspirin allergy',
  'peanut', 'tree nut', 'shellfish', 'egg', 'dairy', 'soy',
  'bee sting', 'wasp',
];

const SYMPTOM_KEYWORDS: Record<string, string[]> = {
  'nausea': ['nausea', 'nauseous', 'queasy', 'sick to my stomach'],
  'vomiting': ['vomiting', 'throwing up', 'vomited', 'emesis'],
  'shortness of breath': ['shortness of breath', 'short of breath', 'sob', 'dyspnea', 'winded', 'breathless', 'hard to breathe'],
  'chest pain': ['chest pain', 'chest pressure', 'chest tightness', 'chest heaviness'],
  'dizziness': ['dizzy', 'dizziness', 'lightheaded', 'light headed', 'vertigo', 'room spinning'],
  'fatigue': ['fatigue', 'tired', 'exhausted', 'no energy', 'weak', 'weakness'],
  'fever': ['fever', 'febrile', 'temperature', 'chills', 'sweats', 'night sweats'],
  'headache': ['headache', 'head pain', 'migraine', 'head pounding'],
  'abdominal pain': ['abdominal pain', 'stomach pain', 'belly pain', 'stomach ache', 'cramping'],
  'back pain': ['back pain', 'lower back', 'upper back'],
  'palpitations': ['palpitations', 'heart racing', 'heart pounding', 'heart fluttering'],
  'diaphoresis': ['sweating', 'sweaty', 'diaphoresis', 'drenched in sweat', 'cold sweat'],
  'syncope': ['passed out', 'fainted', 'syncope', 'blacked out', 'lost consciousness'],
  'numbness': ['numbness', 'numb', 'tingling', 'pins and needles'],
  'vision changes': ['blurry vision', 'vision changes', 'seeing double', 'blind spot'],
  'cough': ['cough', 'coughing', 'hacking'],
  'sore throat': ['sore throat', 'throat pain', 'painful swallowing'],
  'diarrhea': ['diarrhea', 'loose stool', 'watery stool'],
  'constipation': ['constipation', 'constipated', 'haven\'t had a bowel movement'],
  'rash': ['rash', 'hives', 'itchy skin', 'skin rash', 'breakout'],
  'swelling': ['swelling', 'swollen', 'edema', 'puffy'],
  'joint pain': ['joint pain', 'joints hurt', 'arthralgia'],
};

const RED_FLAG_PATTERNS = [
  { pattern: ['chest pain', 'radiating', 'arm'], flag: 'Chest pain with radiation — rule out ACS' },
  { pattern: ['chest pain', 'jaw'], flag: 'Chest pain with jaw involvement — rule out ACS' },
  { pattern: ['chest pain', 'diaphoresis'], flag: 'Chest pain with diaphoresis — high concern for ACS' },
  { pattern: ['chest pain', 'sweating'], flag: 'Chest pain with diaphoresis — high concern for ACS' },
  { pattern: ['worst headache'], flag: 'Thunderclap headache — rule out SAH' },
  { pattern: ['sudden', 'headache'], flag: 'Sudden-onset headache — rule out SAH' },
  { pattern: ['blood', 'stool'], flag: 'GI bleeding — needs urgent evaluation' },
  { pattern: ['vomiting', 'blood'], flag: 'Hematemesis — needs urgent evaluation' },
  { pattern: ['coughing', 'blood'], flag: 'Hemoptysis — needs urgent evaluation' },
  { pattern: ['face', 'droop'], flag: 'Possible stroke — time-sensitive' },
  { pattern: ['slurred', 'speech'], flag: 'Possible stroke — time-sensitive' },
  { pattern: ['sudden', 'vision'], flag: 'Sudden vision change — rule out stroke/retinal event' },
  { pattern: ['fever', 'stiff neck'], flag: 'Fever with neck stiffness — rule out meningitis' },
  { pattern: ['chest pain', 'shortness of breath'], flag: 'Chest pain with dyspnea — rule out PE/ACS' },
  { pattern: ['leg', 'swelling', 'pain'], flag: 'Unilateral leg pain/swelling — rule out DVT' },
];

const QUALITY_KEYWORDS: Record<string, string> = {
  'sharp': 'sharp', 'stabbing': 'sharp/stabbing', 'knife': 'sharp/stabbing',
  'dull': 'dull', 'aching': 'dull/aching', 'achy': 'dull/aching',
  'pressure': 'pressure', 'squeezing': 'pressure/squeezing', 'crushing': 'crushing/pressure',
  'tightness': 'tightness', 'tight': 'tightness',
  'burning': 'burning', 'burn': 'burning',
  'throbbing': 'throbbing', 'pulsating': 'throbbing/pulsating',
  'cramping': 'cramping', 'cramp': 'cramping',
  'tearing': 'tearing', 'ripping': 'tearing/ripping',
  'colicky': 'colicky', 'waves': 'intermittent/colicky',
};

const LOCATION_KEYWORDS = [
  'chest', 'head', 'abdomen', 'stomach', 'back', 'neck', 'shoulder',
  'arm', 'leg', 'knee', 'ankle', 'wrist', 'hand', 'foot', 'hip',
  'throat', 'jaw', 'ear', 'eye', 'groin', 'flank', 'side',
  'left side', 'right side', 'epigastric', 'periumbilical',
  'left arm', 'right arm', 'left leg', 'right leg',
  'lower back', 'upper back', 'mid back',
  'left lower quadrant', 'right lower quadrant', 'llq', 'rlq', 'ruq', 'luq',
];

// ── Phase Order ──

const PHASE_ORDER = [
  'greeting',
  'chief_complaint',
  'hpi',
  'review_of_systems',
  'pmh_psh_fh_sh',
  'medications',
  'allergies',
  'review_and_triage',
  'complete',
] as const;

type Phase = typeof PHASE_ORDER[number];

// ── Phase → Relevant Fields Mapping ──

const PHASE_RELEVANT_FIELDS: Partial<Record<Phase, (keyof ExtractedInfo)[]>> = {
  chief_complaint: ['onset', 'duration', 'severity'],
  hpi: ['quality', 'radiation', 'aggravating', 'alleviating'],
  review_of_systems: ['associatedSymptoms', 'rosPositive', 'rosNegative'],
  pmh_psh_fh_sh: ['conditions', 'surgeries', 'familyHistory', 'socialHistory'],
  medications: ['medications'],
  allergies: ['allergies', 'allergiesAsked'],
};

// ── Extraction Functions ──

function extractInfo(messages: MockMessage[]): ExtractedInfo {
  const userTexts = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase());
  const all = userTexts.join(' ');

  const info: ExtractedInfo = {
    chiefComplaint: null,
    onset: null,
    duration: null,
    severity: null,
    location: null,
    radiation: null,
    quality: null,
    aggravating: null,
    alleviating: null,
    associatedSymptoms: [],
    conditions: [],
    medications: [],
    allergies: [],
    allergiesAsked: false,
    surgeries: [],
    socialHistory: [],
    familyHistory: [],
    rosPositive: [],
    rosNegative: [],
    redFlags: [],
  };

  if (userTexts.length === 0) return info;

  // Chief complaint = first user message
  info.chiefComplaint = messages.find(m => m.role === 'user')?.content || null;

  // Severity
  const severityMatch = all.match(/(\d+)\s*(?:\/\s*10|out of\s*10)/);
  if (severityMatch) {
    info.severity = `${severityMatch[1]}/10`;
  } else if (all.match(/\bsevere\b|\bterrible\b|\bexcruciating\b|\bworst\b|\bintense\b|\bunbearable\b/)) {
    info.severity = 'severe';
  } else if (all.match(/\bmoderate\b|\bmedium\b|\bnotable\b/)) {
    info.severity = 'moderate';
  } else if (all.match(/\bmild\b|\bslight\b|\bminor\b|\ba little\b/)) {
    info.severity = 'mild';
  }

  // Onset / Duration
  const onsetMatch = all.match(/(?:started|began|since|for the (?:past|last))\s+(.{3,40}?)(?:\.|,|$)/);
  if (onsetMatch) info.onset = onsetMatch[1].trim();

  const durationMatch = all.match(/(?:for|lasting|past|last)\s+(\d+\s*(?:minute|hour|day|week|month|year)s?)/);
  if (durationMatch) info.duration = durationMatch[1].trim();

  // Also detect "2 hours", "3 days" patterns near time-related words
  if (!info.duration) {
    const durAlt = all.match(/(\d+\s*(?:minute|hour|day|week|month|year)s?)(?:\s+(?:ago|now))?/);
    if (durAlt) info.duration = durAlt[1].trim();
  }

  // Location
  for (const loc of LOCATION_KEYWORDS) {
    if (all.includes(loc)) {
      info.location = loc;
      break;
    }
  }

  // Radiation
  const radiationMatch = all.match(/(?:radiat(?:e|es|ing)|spread(?:s|ing)?|goes?|moving)\s+(?:to |into |down |up )?(?:(?:my|the|left|right)\s+)?([\w\s]{2,20})/);
  if (radiationMatch) info.radiation = radiationMatch[1].trim();

  // Quality
  for (const [keyword, qual] of Object.entries(QUALITY_KEYWORDS)) {
    if (all.includes(keyword)) {
      info.quality = qual;
      break;
    }
  }

  // Aggravating factors
  const aggMatch = all.match(/(?:worse with|worse when|aggravated by|hurts more when|increases with)\s+(.{3,50}?)(?:\.|,|$)/);
  if (aggMatch) info.aggravating = aggMatch[1].trim();

  // Alleviating factors
  const alleMatch = all.match(/(?:better with|better when|relieved by|helps when|improves with|eases with)\s+(.{3,50}?)(?:\.|,|$)/);
  if (alleMatch) info.alleviating = alleMatch[1].trim();

  // Associated symptoms
  for (const [symptom, terms] of Object.entries(SYMPTOM_KEYWORDS)) {
    if (terms.some(t => all.includes(t))) {
      if (!info.associatedSymptoms.includes(symptom)) {
        info.associatedSymptoms.push(symptom);
      }
    }
  }

  // Conditions
  for (const cond of CONDITION_KEYWORDS) {
    if (all.includes(cond) && !info.conditions.includes(cond)) {
      info.conditions.push(cond);
    }
  }

  // Medications
  for (const med of MED_KEYWORDS) {
    if (all.includes(med) && !info.medications.includes(med)) {
      info.medications.push(med);
    }
  }

  // Allergies
  if (all.match(/\bno known allerg|\bnkda\b|\bno allerg|\bno drug allerg/)) {
    info.allergies = ['NKDA'];
    info.allergiesAsked = true;
  } else {
    for (const alg of ALLERGY_KEYWORDS) {
      if (all.includes(alg) && !info.allergies.includes(alg)) {
        info.allergies.push(alg);
      }
    }
    if (info.allergies.length > 0) info.allergiesAsked = true;
  }

  // Check if allergies were mentioned in response to a direct question
  const assistantMessages = messages.filter(m => m.role === 'assistant').map(m => m.content.toLowerCase());
  if (assistantMessages.some(m => m.includes('allerg'))) {
    // An allergy question was asked — check if patient responded
    const lastAllergyQ = messages.findLastIndex(m => m.role === 'assistant' && m.content.toLowerCase().includes('allerg'));
    if (lastAllergyQ >= 0 && lastAllergyQ < messages.length - 1) {
      const responseAfter = messages.slice(lastAllergyQ + 1).find(m => m.role === 'user');
      if (responseAfter) {
        const resp = responseAfter.content.toLowerCase();
        if (resp.match(/\bnone\b|\bno\b|\bnot that i know|\bnkda\b|\bno allerg/)) {
          info.allergies = ['NKDA'];
          info.allergiesAsked = true;
        } else if (info.allergies.length === 0 && resp.length > 0) {
          info.allergiesAsked = true;
        }
      }
    }
  }

  // Surgeries
  const surgeryKeywords = [
    'appendectomy', 'cholecystectomy', 'gallbladder removal', 'hernia repair',
    'knee replacement', 'hip replacement', 'c-section', 'cesarean', 'tonsillectomy',
    'hysterectomy', 'bypass surgery', 'cabg', 'stent', 'pacemaker',
  ];
  for (const surg of surgeryKeywords) {
    if (all.includes(surg) && !info.surgeries.includes(surg)) {
      info.surgeries.push(surg);
    }
  }
  if (all.match(/\bno surger|\bnever had surgery|\bno prior surgery|\bno previous surgery/)) {
    if (info.surgeries.length === 0) info.surgeries = ['none reported'];
  }

  // Social history
  const socialPatterns: Array<{ test: RegExp; label: string }> = [
    { test: /\bsmok(?:e|es|ing|er)\b/, label: 'smoking' },
    { test: /\bvap(?:e|es|ing)\b/, label: 'vaping' },
    { test: /\bdrink(?:s|ing)?\s*(?:alcohol)?\b.*(?:daily|weekly|beer|wine|liquor)/, label: 'alcohol use' },
    { test: /\balcohol\b/, label: 'alcohol use' },
    { test: /\bmarijuana\b|\bcannabis\b|\bweed\b|\bthc\b/, label: 'cannabis use' },
    { test: /\bdrug(?:s)?\s*(?:use)?\b|\bcocaine\b|\bheroin\b|\bmeth\b|\bfentanyl\b|\bopioid\b/, label: 'substance use' },
    { test: /\bno\s+(?:smok|drink|drug|alcohol|substance)/, label: 'denies substance use' },
  ];
  for (const sp of socialPatterns) {
    if (sp.test.test(all) && !info.socialHistory.includes(sp.label)) {
      info.socialHistory.push(sp.label);
    }
  }

  // Family history
  const familyPatterns: Array<{ test: RegExp; label: string }> = [
    { test: /(?:family|father|mother|parent|dad|mom|brother|sister|grandparent).*(?:heart|cardiac|mi\b)/, label: 'family history of heart disease' },
    { test: /(?:family|father|mother|parent|dad|mom|brother|sister|grandparent).*(?:stroke|cva)/, label: 'family history of stroke' },
    { test: /(?:family|father|mother|parent|dad|mom|brother|sister|grandparent).*(?:cancer|tumor)/, label: 'family history of cancer' },
    { test: /(?:family|father|mother|parent|dad|mom|brother|sister|grandparent).*(?:diabetes)/, label: 'family history of diabetes' },
    { test: /\bno family history\b|\bno significant family\b/, label: 'no significant family history' },
  ];
  for (const fp of familyPatterns) {
    if (fp.test.test(all) && !info.familyHistory.includes(fp.label)) {
      info.familyHistory.push(fp.label);
    }
  }

  // ROS — mark positives (already captured in associatedSymptoms)
  info.rosPositive = [...info.associatedSymptoms];

  // Detect negative ROS from explicit denials
  const denialPattern = /(?:no|deny|denies|without|negative for)\s+([\w\s]{3,30})/g;
  let denialMatch;
  while ((denialMatch = denialPattern.exec(all)) !== null) {
    const denied = denialMatch[1].trim();
    for (const [symptom, terms] of Object.entries(SYMPTOM_KEYWORDS)) {
      if (terms.some(t => denied.includes(t)) || denied.includes(symptom)) {
        if (!info.rosNegative.includes(symptom)) {
          info.rosNegative.push(symptom);
        }
      }
    }
  }

  // Red flags
  for (const rf of RED_FLAG_PATTERNS) {
    if (rf.pattern.every(p => all.includes(p))) {
      if (!info.redFlags.includes(rf.flag)) {
        info.redFlags.push(rf.flag);
      }
    }
  }

  return info;
}

// ── Phase-Relevance Helpers ──

function hasRelevantNewInfo(
  phase: Phase,
  infoBefore: ExtractedInfo,
  infoAfter: ExtractedInfo,
): boolean {
  const fields = PHASE_RELEVANT_FIELDS[phase];
  if (!fields) return false;

  for (const field of fields) {
    const before = infoBefore[field];
    const after = infoAfter[field];

    if (typeof after === 'boolean') {
      if (after !== before) return true;
    } else if (Array.isArray(after)) {
      if ((after as string[]).length > (before as string[]).length) return true;
    } else {
      // string | null
      if (after !== null && before === null) return true;
    }
  }
  return false;
}

function countConsecutiveNonAnswers(
  messages: MockMessage[],
  currentPhase: Phase,
): number {
  // Walk backward through user messages, counting how many consecutive latest
  // messages did NOT contribute new info to the current phase.
  const userIndices: number[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') userIndices.push(i);
    if (userIndices.length >= 3) break; // only need last few
  }

  let nonAnswers = 0;
  for (const idx of userIndices) {
    const before = extractInfo(messages.slice(0, idx));
    const after = extractInfo(messages.slice(0, idx + 1));
    if (!hasRelevantNewInfo(currentPhase, before, after)) {
      nonAnswers++;
    } else {
      break; // found a message that DID contribute — stop counting
    }
  }
  return nonAnswers;
}

// ── Acuity Detection ──

function detectAcuityTier(messages: MockMessage[]): AcuityTier {
  const all = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase())
    .join(' ');

  // ESI-1: Critical / Resuscitation
  if (ESI1_PATTERNS.some(p => all.includes(p))) {
    return 'esi1';
  }

  // ESI-2: Emergency — check combo patterns and standalone keywords
  for (const pattern of ESI2_PATTERNS) {
    if (typeof pattern === 'string') {
      if (all.includes(pattern)) return 'esi2';
    } else {
      // Combo: needs at least one from `requires` AND at least one from `plus`
      const hasBase = pattern.requires.some(r => all.includes(r));
      const hasPlus = pattern.plus.some(p => all.includes(p));
      if (hasBase && hasPlus) return 'esi2';
    }
  }

  // ESI-3: Urgent
  if (ESI3_KEYWORDS.some(k => all.includes(k))) {
    return 'esi3';
  }

  // ESI-4/5: Routine
  if (ESI4_5_KEYWORDS.some(k => all.includes(k))) {
    return 'esi4_5';
  }

  // Default to ESI-3 if unclear
  return 'esi3';
}

// ── Pain Detection ──

const PAIN_INDICATORS = [
  'pain', 'ache', 'aching', 'hurt', 'hurts', 'hurting', 'sore', 'soreness',
  'cramp', 'cramping', 'throb', 'throbbing', 'sting', 'stinging',
  'pressure', 'tightness', 'burning',
];

function isPainComplaint(info: ExtractedInfo): boolean {
  const cc = (info.chiefComplaint || '').toLowerCase();
  return PAIN_INDICATORS.some(p => cc.includes(p));
}

// ── False-Positive Guards ──

/**
 * Checks if an assistant message about a topic (keyword) was followed by a
 * user response — indicating the phase was directly asked and answered.
 */
function wasPhaseDirectlyAsked(messages: MockMessage[], keyword: string): boolean {
  for (let i = 0; i < messages.length; i++) {
    if (
      messages[i].role === 'assistant' &&
      messages[i].content.toLowerCase().includes(keyword)
    ) {
      // Check if a user message followed this assistant message
      const nextUser = messages.slice(i + 1).find(m => m.role === 'user');
      if (nextUser) return true;
    }
  }
  return false;
}

// ── Adaptive Question Builders ──

function buildChiefComplaintQuestion(info: ExtractedInfo): string | null {
  const missing: string[] = [];
  if (!info.onset && !info.duration) missing.push('When did this start?');
  if (!info.severity) missing.push('How severe is it, on a scale of 1 to 10?');

  if (missing.length === 0) return null; // skip
  return `Thank you for telling me about that. ${missing.join(' ')}`;
}

function buildHpiQuestion(info: ExtractedInfo): string | null {
  const gaps: string[] = [];
  const pain = isPainComplaint(info);

  if (pain) {
    if (!info.quality) gaps.push('what the pain feels like (sharp, dull, pressure, burning, etc.)');
    if (!info.radiation) gaps.push('whether it spreads or radiates anywhere');
  } else {
    // Non-pain complaints: ask about triggers instead of radiation/quality
    if (!info.aggravating) gaps.push('what triggers or worsens it');
    if (!info.alleviating) gaps.push('what seems to help');
  }

  if (pain && !info.aggravating && !info.alleviating) {
    gaps.push('anything that makes it better or worse');
  }
  if (!info.onset && !info.duration) gaps.push('when this started');

  if (gaps.length === 0) return null;

  if (gaps.length === 1) {
    return `Can you tell me ${gaps[0]}?`;
  }

  return `I need a bit more detail. Can you describe:\n• ${gaps.join('\n• ')}`;
}

function buildRosQuestion(info: ExtractedInfo): string | null {
  const alreadyCovered = new Set([
    ...info.rosPositive,
    ...info.rosNegative,
    ...info.associatedSymptoms,
  ]);

  const systemsToAsk = [
    'fever', 'nausea', 'vomiting', 'diarrhea',
    'dizziness', 'headache', 'vision changes',
    'shortness of breath', 'palpitations',
    'numbness', 'swelling', 'rash',
  ].filter(s => !alreadyCovered.has(s));

  if (systemsToAsk.length === 0) return null;

  // Pick at most 4-5 to ask about
  const toAsk = systemsToAsk.slice(0, 5);
  return `Are you experiencing any of the following: ${toAsk.join(', ')}? Any other symptoms you haven't mentioned?`;
}

function buildPmhQuestion(info: ExtractedInfo): string | null {
  const hasConds = info.conditions.length > 0;
  const hasSurg = info.surgeries.length > 0;
  const hasFH = info.familyHistory.length > 0;
  const hasSH = info.socialHistory.length > 0;

  if (hasConds && hasSurg && hasFH && hasSH) return null;

  const parts: string[] = [];
  if (hasConds) {
    parts.push(`You mentioned ${info.conditions.join(', ')}.`);
  }

  const ask: string[] = [];
  if (!hasConds) ask.push('medical conditions (diabetes, high blood pressure, heart disease, etc.)');
  if (!hasSurg) ask.push('past surgeries');
  if (!hasFH) ask.push('significant family medical history');
  if (!hasSH) ask.push('smoking, alcohol, or substance use');

  if (ask.length === 0) return null;

  return `${parts.join(' ')} Do you have any ${ask.join(', ')}?`.trim();
}

function buildMedsQuestion(info: ExtractedInfo, messages?: MockMessage[]): string | null {
  if (info.medications.length > 0) {
    // Meds were found — but were they directly asked about?
    if (messages && !wasPhaseDirectlyAsked(messages, 'medication')) {
      // Casually mentioned (e.g., "my mother takes metformin") — confirm
      return `You mentioned ${info.medications.join(', ')} earlier. Are those your current medications, or were you referring to someone else?`;
    }
    return null; // directly asked and answered
  }
  return 'What medications are you currently taking? Include prescriptions, over-the-counter meds, and supplements. If none, just say none.';
}

function buildAllergyQuestion(info: ExtractedInfo, messages?: MockMessage[]): string | null {
  if (info.allergiesAsked || info.allergies.length > 0) {
    // Allergies were found — but were they directly asked about?
    if (messages && info.allergies.length > 0 && !info.allergiesAsked && !wasPhaseDirectlyAsked(messages, 'allerg')) {
      return `You mentioned ${info.allergies.join(', ')} — is that a personal allergy, or were you referring to someone else?`;
    }
    return null;
  }
  return 'Do you have any allergies to medications, foods, or anything else? If so, what reaction do you have?';
}

function buildCombinedMedsAllergyQuestion(info: ExtractedInfo, messages?: MockMessage[]): string | null {
  const medsQ = buildMedsQuestion(info, messages);
  const allergyQ = buildAllergyQuestion(info, messages);

  if (!medsQ && !allergyQ) return null;
  if (medsQ && allergyQ) {
    // If either is a confirmation question, ask them separately
    if (medsQ.includes('earlier') || allergyQ.includes('earlier')) {
      return medsQ; // ask meds confirmation first; allergies next round
    }
    return 'I need to ask two quick but important questions: What medications are you currently taking, especially blood thinners? And do you have any drug allergies?';
  }
  return medsQ || allergyQ;
}

// ── Re-ask Templates ──

const REASK_PREFIXES = [
  "Thank you for that information, I've noted it.",
  "Got it, I've recorded that.",
  "I appreciate you sharing that.",
];

function buildReaskQuestion(phase: Phase, info: ExtractedInfo, messages?: MockMessage[]): string | null {
  const phaseBuilders: Partial<Record<Phase, () => string | null>> = {
    chief_complaint: () => buildChiefComplaintQuestion(info),
    hpi: () => buildHpiQuestion(info),
    review_of_systems: () => buildRosQuestion(info),
    pmh_psh_fh_sh: () => buildPmhQuestion(info),
    medications: () => buildMedsQuestion(info, messages),
    allergies: () => buildAllergyQuestion(info, messages),
  };

  const builder = phaseBuilders[phase];
  if (!builder) return null;

  const question = builder();
  if (!question) return null;

  const prefix = REASK_PREFIXES[Math.floor(Math.random() * REASK_PREFIXES.length)];
  // Lowercase the first char of the question for a smooth join
  const lowerQ = question.charAt(0).toLowerCase() + question.slice(1);
  return `${prefix} To make sure I have a complete picture — ${lowerQ}`;
}

// ── Phase Progression ──

function getNextPhase(
  currentPhase: Phase,
  info: ExtractedInfo,
  tier: AcuityTier,
  messages: MockMessage[],
): { phase: Phase; question: string } {
  // ESI-1: Immediate triage regardless of current phase
  if (tier === 'esi1') {
    return {
      phase: 'review_and_triage',
      question: 'This sounds like it could be a medical emergency. Based on what you\'ve described, I\'m completing your triage assessment immediately. If you haven\'t already, please alert nearby medical staff or call 911.',
    };
  }

  // ESI-2: Fast-track — only collect meds/allergies if missing, then triage
  if (tier === 'esi2' && info.chiefComplaint) {
    const combinedQ = buildCombinedMedsAllergyQuestion(info, messages);
    if (combinedQ) {
      return {
        phase: 'medications', // combined meds+allergies phase
        question: combinedQ,
      };
    }
    return {
      phase: 'review_and_triage',
      question: 'Thank you. Given the severity of your symptoms, I\'m completing your triage assessment now to ensure you receive prompt care.',
    };
  }

  // For ESI-3 and ESI-4/5: Walk phases but skip those with sufficient data

  const phaseBuilders: Partial<Record<Phase, () => string | null>> = {
    chief_complaint: () => buildChiefComplaintQuestion(info),
    hpi: () => buildHpiQuestion(info),
    review_of_systems: () => buildRosQuestion(info),
    pmh_psh_fh_sh: () => buildPmhQuestion(info),
    medications: () => buildMedsQuestion(info, messages),
    allergies: () => buildAllergyQuestion(info, messages),
  };

  const currentIdx = PHASE_ORDER.indexOf(currentPhase);

  // ── Re-check current phase before advancing ──
  // If the current phase still has unanswered questions, decide whether to
  // stay (re-ask) or advance based on how many consecutive non-answers.
  const currentBuilder = phaseBuilders[currentPhase];
  if (currentBuilder) {
    const pendingQuestion = currentBuilder();
    if (pendingQuestion) {
      const nonAnswerCount = countConsecutiveNonAnswers(messages, currentPhase);

      if (nonAnswerCount === 0) {
        // User partially answered — stay on phase with the builder's follow-up
        return { phase: currentPhase, question: pendingQuestion };
      }

      if (nonAnswerCount === 1) {
        // User went off-topic once — gentle re-ask
        const reask = buildReaskQuestion(currentPhase, info, messages);
        if (reask) {
          return { phase: currentPhase, question: reask };
        }
      }

      // nonAnswerCount >= 2 — stuck too long, fall through to advance
    }
  }

  // ── Forward scan: find next phase with unanswered questions ──

  // For ESI-3: compress — skip ROS if already have 3+ symptoms
  const skipRosForEsi3 = tier === 'esi3' && info.associatedSymptoms.length >= 3;

  for (let i = currentIdx + 1; i < PHASE_ORDER.length; i++) {
    const phase = PHASE_ORDER[i];

    // Skip ROS for ESI-3 if enough symptoms already collected
    if (phase === 'review_of_systems' && skipRosForEsi3) continue;

    const builder = phaseBuilders[phase];
    if (builder) {
      const question = builder();
      if (question) {
        return { phase, question };
      }
      // Phase data already sufficient — skip
      continue;
    }

    // review_and_triage phase — we've run out of questions
    if (phase === 'review_and_triage') {
      return {
        phase: 'review_and_triage',
        question: 'Thank you for providing all that information. I now have enough to complete your triage assessment. Is there anything else you\'d like to mention before I finalize?',
      };
    }
  }

  // Fallback — shouldn't reach here
  return {
    phase: 'review_and_triage',
    question: 'Thank you. I have enough information to complete your triage assessment now.',
  };
}

// ── Enhanced Triage / ESI Determination ──

function determineESI(info: ExtractedInfo, tier: AcuityTier): {
  level: number;
  reasoning: string;
  setting: string;
  settingReasoning: string;
  redFlags: string[];
} {
  const redFlags = [...info.redFlags];

  switch (tier) {
    case 'esi1':
      return {
        level: 1,
        reasoning: 'Patient presents with immediately life-threatening condition requiring resuscitation-level intervention.',
        setting: 'Emergency Department — Resuscitation Bay',
        settingReasoning: 'Requires immediate life-saving interventions, continuous monitoring, and resuscitation team.',
        redFlags: redFlags.length > 0 ? redFlags : ['Immediately life-threatening presentation'],
      };

    case 'esi2': {
      // Build specific reasoning based on symptoms
      const symptoms = info.associatedSymptoms;
      const cc = (info.chiefComplaint || '').toLowerCase();

      if (cc.includes('chest pain') || symptoms.includes('chest pain')) {
        if (redFlags.length === 0) redFlags.push('Chest pain requires urgent cardiac evaluation');
        return {
          level: 2,
          reasoning: `High-risk presentation: chest pain${info.radiation ? ` radiating to ${info.radiation}` : ''}${symptoms.includes('diaphoresis') ? ' with diaphoresis' : ''}${symptoms.includes('shortness of breath') ? ' and dyspnea' : ''}. Immediate evaluation needed to rule out acute coronary syndrome.`,
          setting: 'Emergency Department',
          settingReasoning: 'Requires immediate ECG, troponin, and cardiac monitoring. Cannot safely wait.',
          redFlags,
        };
      }

      if (cc.includes('headache') && (cc.includes('worst') || cc.includes('thunderclap') || cc.includes('sudden'))) {
        if (redFlags.length === 0) redFlags.push('Sudden severe headache — rule out SAH');
        return {
          level: 2,
          reasoning: 'Sudden-onset worst headache of life requires urgent neurological evaluation to rule out subarachnoid hemorrhage.',
          setting: 'Emergency Department',
          settingReasoning: 'Need emergent CT head and possible CTA/LP. Time-sensitive diagnosis.',
          redFlags,
        };
      }

      if (symptoms.includes('shortness of breath') || cc.includes('breathe')) {
        if (redFlags.length === 0) redFlags.push('Acute respiratory distress');
        return {
          level: 2,
          reasoning: 'Acute dyspnea is a high-risk symptom requiring immediate assessment of respiratory and cardiac status.',
          setting: 'Emergency Department',
          settingReasoning: 'Requires immediate pulse oximetry, chest imaging, and potential respiratory support.',
          redFlags,
        };
      }

      return {
        level: 2,
        reasoning: 'High-acuity presentation requiring emergent evaluation. Multiple concerning features identified.',
        setting: 'Emergency Department',
        settingReasoning: 'Time-sensitive condition that requires resources only available in an emergency department.',
        redFlags: redFlags.length > 0 ? redFlags : ['High-acuity presentation'],
      };
    }

    case 'esi3':
      return {
        level: 3,
        reasoning: `Patient presents with ${info.chiefComplaint || 'symptoms'} requiring evaluation and likely diagnostic workup. ${info.severity ? `Severity: ${info.severity}.` : ''} Stable but needs timely assessment.`,
        setting: 'Urgent Care or Emergency Department',
        settingReasoning: 'Symptoms require same-day evaluation with basic diagnostics. ED if urgent care unavailable or symptoms worsen.',
        redFlags: redFlags.length > 0 ? redFlags : ['None identified'],
      };

    case 'esi4_5': {
      const isEsi5 = !info.severity || info.severity === 'mild';
      return {
        level: isEsi5 ? 5 : 4,
        reasoning: `Low-acuity presentation: ${info.chiefComplaint || 'minor symptoms'}. ${isEsi5 ? 'No resources expected.' : 'May require 1 resource (e.g., simple lab or imaging).'}`,
        setting: 'Primary Care / Telehealth',
        settingReasoning: 'Symptoms can be appropriately managed in primary care or via telehealth visit. No emergent workup needed.',
        redFlags: ['None identified'],
      };
    }
  }
}

function buildStructuredHPI(info: ExtractedInfo): Record<string, string> {
  const hpi: Record<string, string> = {};

  if (info.onset) hpi.onset = info.onset;
  if (info.duration) hpi.duration = info.duration;
  if (info.location) hpi.location = info.location;
  if (info.quality) hpi.character = info.quality;
  if (info.severity) hpi.severity = info.severity;
  if (info.radiation) hpi.radiation = info.radiation;
  if (info.aggravating) hpi.aggravating_factors = info.aggravating;
  if (info.alleviating) hpi.alleviating_factors = info.alleviating;
  if (info.associatedSymptoms.length > 0) {
    hpi.associated_symptoms = info.associatedSymptoms.join(', ');
  }

  if (Object.keys(hpi).length === 0) {
    hpi.narrative = 'As described by patient';
  }

  return hpi;
}

// ── Public API ──

const GREETING_BY_LANGUAGE: Record<string, string> = {
  en: "Hi there, welcome! What brings you in today?",
  es: "¡Hola, bienvenido! ¿Qué lo trae por aquí hoy?",
  zh: "您好，欢迎！今天是什么原因来就诊？",
  ms: "Hai, selamat datang! Apa yang membawa anda ke sini hari ini?",
  ta: "வணக்கம், வரவேற்கிறோம்! இன்று என்ன காரணமாக வந்தீர்கள்?",
  vi: "Xin chào, chào mừng bạn! Hôm nay bạn đến vì lý do gì?",
  ar: "مرحباً، أهلاً وسهلاً! ما الذي أتى بك اليوم؟",
};

export function mockStartInterview(language: string = 'en'): {
  session_id: string;
  phase: string;
  question: string;
} {
  return {
    session_id: `mock_${Date.now()}`,
    phase: 'greeting',
    question: GREETING_BY_LANGUAGE[language] || GREETING_BY_LANGUAGE.en,
  };
}

export function mockRespond(
  _sessionId: string,
  _text: string,
  messages: MockMessage[],
  currentPhase: string,
): {
  phase: string;
  question: string;
  prompt_cough_recording?: boolean;
} {
  // 1. Extract info from ALL messages
  const info = extractInfo(messages);

  // 2. Detect acuity tier
  const tier = detectAcuityTier(messages);

  // 3. Check for respiratory keywords to prompt cough recording
  const promptCough = _text.toLowerCase().match(/cough|wheez|breath|respiratory|lung|asthma|copd/) !== null;

  // 4. Get next phase + adaptive question
  const { phase, question } = getNextPhase(currentPhase as Phase, info, tier, messages);

  return {
    phase,
    question,
    prompt_cough_recording: promptCough,
  };
}

export function mockComplete(
  _sessionId: string,
  messages: MockMessage[],
): Record<string, unknown> {
  const info = extractInfo(messages);
  const tier = detectAcuityTier(messages);
  const esi = determineESI(info, tier);
  const hpi = buildStructuredHPI(info);

  return {
    chief_complaint: info.chiefComplaint || 'Not specified',
    hpi,
    review_of_systems: {
      positive: info.rosPositive.length > 0 ? info.rosPositive : ['None reported'],
      negative: info.rosNegative.length > 0 ? info.rosNegative : ['Not assessed'],
    },
    past_medical_history: info.conditions.length > 0 ? info.conditions : ['None reported'],
    surgical_history: info.surgeries.length > 0 ? info.surgeries : ['None reported'],
    family_history: info.familyHistory.length > 0 ? info.familyHistory : ['None reported'],
    social_history: info.socialHistory.length > 0 ? info.socialHistory : ['None reported'],
    medications: info.medications.length > 0 ? info.medications : ['None reported'],
    allergies: info.allergies.length > 0 ? info.allergies : ['No known drug allergies'],
    esi_level: esi.level,
    esi_reasoning: esi.reasoning,
    recommended_setting: esi.setting,
    setting_reasoning: esi.settingReasoning,
    red_flags: esi.redFlags,
  };
}
