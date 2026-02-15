import { z } from 'zod';

export const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().min(1, 'Date of birth is required').refine(
    (val) => !isNaN(Date.parse(val)),
    'Invalid date format'
  ),
  sex: z.enum(['male', 'female', 'other']),
  mrn: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  allergies: z.array(z.string()),
  conditions: z.array(z.string()),
  medications: z.array(z.string()),
});

export type PatientFormData = z.infer<typeof patientSchema>;
