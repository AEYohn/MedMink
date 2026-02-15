import { z } from 'zod';

export const caseTextSchema = z.object({
  caseText: z.string().min(20, 'Please provide at least 20 characters describing the clinical case'),
});

export type CaseTextFormData = z.infer<typeof caseTextSchema>;
