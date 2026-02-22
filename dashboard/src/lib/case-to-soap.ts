import type { SOAPData } from '@/components/charting/SOAPEditor';
import type { CaseAnalysisData } from '@/types/case';

/**
 * Extract vital signs from free-text case description using regex.
 */
function extractVitals(text: string): SOAPData['objective']['vital_signs'] {
  const vitals: SOAPData['objective']['vital_signs'] = {
    BP: null, HR: null, Temp: null, RR: null, SpO2: null,
  };

  // BP: "BP 165/95", "blood pressure 120/80"
  const bpMatch = text.match(/(?:BP|blood pressure)[:\s]+(\d{2,3}\/\d{2,3})/i);
  if (bpMatch) vitals.BP = bpMatch[1];

  // HR: "HR 102", "heart rate 88"
  const hrMatch = text.match(/(?:HR|heart rate)[:\s]+(\d{2,3})/i);
  if (hrMatch) vitals.HR = hrMatch[1];

  // RR: "RR 20", "respiratory rate 18"
  const rrMatch = text.match(/(?:RR|respiratory rate)[:\s]+(\d{1,2})/i);
  if (rrMatch) vitals.RR = rrMatch[1];

  // SpO2: "SpO2 96%", "oxygen saturation 98%", "O2 sat 94%"
  const spo2Match = text.match(/(?:SpO2|oxygen saturation|O2 sat)[:\s]+(\d{2,3})%?/i);
  if (spo2Match) vitals.SpO2 = `${spo2Match[1]}%`;

  // Temp: "Temp 98.4", "temperature 38.5"
  const tempMatch = text.match(/(?:Temp|temperature)[:\s]+([\d.]+)/i);
  if (tempMatch) vitals.Temp = tempMatch[1];

  return vitals;
}

/**
 * Build a SOAP note structure from a completed case analysis.
 */
export function buildSOAPFromCase(
  result: CaseAnalysisData,
  caseText: string,
): SOAPData {
  const pc = result.parsed_case;
  const am = result.acute_management;

  // Subjective
  const chiefComplaint = pc?.findings?.presentation || null;
  const hpi = caseText.slice(0, 500) + (caseText.length > 500 ? '...' : '');
  const ros = pc?.findings?.associated_symptoms || [];

  // Objective
  const vitals = extractVitals(caseText);
  const physicalExam = pc?.findings?.physical_exam || [];
  const labs = pc?.findings?.labs || [];
  const imaging = pc?.findings?.imaging || [];

  // Assessment
  const primaryDx = result.top_recommendation || null;
  const ddxList = result.differential_diagnosis?.diagnoses?.map(d => d.diagnosis) || [];

  // Plan
  const medications = result.treatment_options
    ?.filter(t => t.verdict === 'recommended')
    .map(t => ({ drug: t.name, dose: '', frequency: '' })) || [];

  const referrals = am?.consults || [];
  const followUp = result.suggested_followups?.[0] || null;
  const patientEducation = am?.key_counseling || [];

  return {
    subjective: {
      chief_complaint: chiefComplaint,
      history_of_present_illness: hpi,
      review_of_systems: ros,
      patient_reported: [],
    },
    objective: {
      vital_signs: vitals,
      physical_exam: physicalExam,
      labs,
      imaging,
    },
    assessment: {
      primary_diagnosis: primaryDx,
      differential: ddxList,
      clinical_impression: result.recommendation_rationale || null,
    },
    plan: {
      medications,
      procedures: [],
      referrals,
      follow_up: followUp,
      patient_education: patientEducation,
    },
  };
}
