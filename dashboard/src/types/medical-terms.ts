export type TermCategory = 'diagnosis' | 'medication' | 'procedure' | 'lab' | 'anatomy' | 'vital-sign';

export interface MedicalTerm {
  term: string;
  aliases?: string[]; // alternate spellings / abbreviations
  definition: string;
  whyItMatters: string;
  category: TermCategory;
}

export interface TermExplanation {
  term: string;
  definition: string;
  whyItMatters: string;
  category: TermCategory;
}
