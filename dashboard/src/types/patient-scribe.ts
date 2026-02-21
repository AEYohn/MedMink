export interface PatientSOAPNotes {
  whatIToldTheDoctor: string; // Subjective
  whatTheDoctorFound: string; // Objective
  myDiagnosis: string; // Assessment
  myTreatmentPlan: string; // Plan
  questionsIHad: string[];
  thingsToRemember: string[];
}

export interface ScribeSession {
  id: string;
  createdAt: string; // ISO date
  transcript: string;
  enhancedNotes: PatientSOAPNotes | null;
  duration: number; // seconds
  title: string;
}
