import { z } from 'zod';
import { businessRules } from '../config/app-config';
import { BloodGroup, Gender, VisitType } from '../domain/enums';

/**
 * Validation schemas defined once and consumed by both ends of the wire.
 *
 * The backend derives its DTO validation from these and the clients drive form
 * validation from the same objects, so a rule can never be enforced on one side
 * and silently missing on the other.
 */

const { auth, patient } = businessRules;

/**
 * Bangladesh mobile number.
 *
 * Local form is 11 digits beginning `01`; the international form prefixes `+88`
 * (the leading `0` is part of the national number, so the country code here is
 * `88`, not `880`). Both are accepted, and both normalise to `+880…`.
 *
 * Accepting the canonical output as input matters: stored numbers are in `+88`
 * form, so a user signing in with the number exactly as the system displays it
 * must validate.
 */
const BD_MOBILE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;

export const bdMobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => BD_MOBILE_PATTERN.test(v), {
    message: 'Enter a valid Bangladeshi mobile number (e.g. 01712345678)',
  })
  .transform((v) => {
    const national = v.replace(/^\+?88/, '');
    return `+88${national}`;
  });

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

/**
 * Password policy. Length is the dominant factor in resistance to offline
 * attack, so the floor is high and composition rules stay light.
 */
export const passwordSchema = z
  .string()
  .min(auth.passwordMinLength, `Password must be at least ${auth.passwordMinLength} characters`)
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[a-z]/.test(v), 'Include at least one lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Include at least one uppercase letter')
  .refine((v) => /\d/.test(v), 'Include at least one number');

/** BMDC registration: alphanumeric, 4–15 chars (format check only — see docs). */
export const bmdcSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{4,15}$/, 'Enter a valid BMDC registration number');

export const otpSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${auth.otpLength}}$`), `Enter the ${auth.otpLength}-digit code`);

export const curaIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^${patient.idPrefix}-\\d{5,10}$`), 'Enter a valid Cura ID');

/**
 * Login accepts mobile OR email in a single field (spec 1.3.1.1).
 *
 * Written as a branch rather than `z.union`, because a union reports the *last*
 * branch's failure — someone mistyping a phone number would be told to "enter a
 * valid email address". Dispatching on `@` lets each input get the error that
 * actually applies to it.
 */
export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1, 'Enter your mobile number or email')
  .transform((value, ctx) => {
    const parsed = value.includes('@')
      ? emailSchema.safeParse(value)
      : bdMobileSchema.safeParse(value);

    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          parsed.error.issues[0]?.message ??
          'Enter a valid mobile number or email address',
      });
      return z.NEVER;
    }
    return parsed.data;
  });

export const loginSchema = z.object({
  identifier: loginIdentifierSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    mobile: bdMobileSchema.optional(),
    email: emailSchema.optional(),
    bmdcNumber: bmdcSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.mobile || d.email, {
    message: 'Provide a mobile number or an email address',
    path: ['mobile'],
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyOtpSchema = z.object({
  challengeId: z.string().uuid(),
  code: otpSchema,
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/** Onboarding step 1 — mandatory: mobile, email, gender (spec 3.2.6.1). */
export const personalDetailsSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  mobile: bdMobileSchema,
  email: emailSchema,
  gender: z.nativeEnum(Gender),
  dateOfBirth: z.string().date().optional(),
  nid: z.string().trim().regex(/^\d{10,17}$/, 'Enter a valid NID number').optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  secondaryPhone: bdMobileSchema.optional(),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      city: z.string().trim().max(80).optional(),
      district: z.string().trim().max(80).optional(),
    })
    .optional(),
  language: z.enum(['en', 'bn']).default('en'),
  profilePhotoId: z.string().uuid().optional(),
});
export type PersonalDetailsInput = z.infer<typeof personalDetailsSchema>;

/** Onboarding step 2 — mandatory: BMDC, specialization (spec 3.2.6.2.1). */
export const professionalDetailsSchema = z.object({
  bmdcNumber: bmdcSchema,
  specializations: z.array(z.string().trim().min(2)).min(1, 'Select at least one specialization'),
  yearsOfExperience: z.number().int().min(0).max(70).optional(),
  workplace: z.string().trim().max(160).optional(),
});
export type ProfessionalDetailsInput = z.infer<typeof professionalDetailsSchema>;

const currentYear = new Date().getUTCFullYear();

/** Spec 3.2.6.3(c): if a degree row is started, name + institute become required. */
export const qualificationSchema = z.object({
  degreeName: z.string().trim().min(2, 'Degree name is required'),
  instituteName: z.string().trim().min(2, 'Institute is required'),
  passingYear: z.number().int().min(1930).max(currentYear).optional(),
  country: z.string().trim().max(80).optional(),
});

export const awardSchema = z.object({
  title: z.string().trim().min(2, 'Award title is required'),
  year: z.number().int().min(1930).max(currentYear).optional(),
  issuer: z.string().trim().max(160).optional(),
  country: z.string().trim().max(80).optional(),
});

export const academicDetailsSchema = z.object({
  qualifications: z.array(qualificationSchema).default([]),
  awards: z.array(awardSchema).default([]),
});
export type AcademicDetailsInput = z.infer<typeof academicDetailsSchema>;

/** Patient intake modal (spec: Patient Intake Action). */
export const patientIntakeSchema = z
  .object({
    mobile: bdMobileSchema,
    fullName: z.string().trim().min(2, 'Patient name is required').max(120),
    gender: z.nativeEnum(Gender).optional(),
    dateOfBirth: z.string().date().optional(),
    ageYears: z.number().int().min(0).max(130).optional(),
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    email: emailSchema.optional(),
    address: z.string().trim().max(240).optional(),
  })
  .refine((d) => d.dateOfBirth || d.ageYears !== undefined, {
    message: 'Provide a date of birth or an age',
    path: ['ageYears'],
  });
export type PatientIntakeInput = z.infer<typeof patientIntakeSchema>;

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid().optional(),
  patient: patientIntakeSchema.optional(),
  practiceId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z
    .number()
    .int()
    .refine(
      (v) => (businessRules.calendar.allowedSlotMinutes as readonly number[]).includes(v),
      'Unsupported appointment duration',
    ),
  visitType: z.nativeEnum(VisitType).default(VisitType.NEW),
  plannedProcedures: z.array(z.string().trim().max(120)).max(20).default([]),
  notes: z.string().trim().max(1000).optional(),
}).refine((d) => d.patientId || d.patient, {
  message: 'Select an existing patient or provide new patient details',
  path: ['patientId'],
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive().optional(),
  reason: z.string().trim().max(240).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(businessRules.search.minQueryLength),
  limit: z.number().int().min(1).max(businessRules.search.maxResults).default(10),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(businessRules.pagination.maxPageSize)
    .default(businessRules.pagination.defaultPageSize),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

/** Practice sessions — end must be after start (spec: Practice Time validation). */
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export const practiceSessionSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
  })
  .refine((s) => s.startTime < s.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });
export type PracticeSessionInput = z.infer<typeof practiceSessionSchema>;

export const vitalsSchema = z.object({
  weightKg: z.number().min(0.5).max(400).optional(),
  systolic: z.number().int().min(50).max(280).optional(),
  diastolic: z.number().int().min(30).max(180).optional(),
  pulseBpm: z.number().int().min(20).max(260).optional(),
  temperatureC: z.number().min(28).max(45).optional(),
  respiratoryRate: z.number().int().min(4).max(80).optional(),
});
export type VitalsInput = z.infer<typeof vitalsSchema>;

export const clinicalNoteSchema = z.object({
  complaints: z.array(z.string().trim().max(300)).default([]),
  observations: z.array(z.string().trim().max(300)).default([]),
  diagnoses: z.array(z.string().trim().max(300)).default([]),
  advice: z.array(z.string().trim().max(300)).default([]),
  notes: z.string().trim().max(4000).optional(),
});
export type ClinicalNoteInput = z.infer<typeof clinicalNoteSchema>;

export const prescriptionItemSchema = z.object({
  drugName: z.string().trim().min(1, 'Drug name is required').max(160),
  strength: z.string().trim().max(40).optional(),
  form: z.string().trim().max(40).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  morning: z.number().min(0).max(10).default(0),
  noon: z.number().min(0).max(10).default(0),
  night: z.number().min(0).max(10).default(0),
  mealRelation: z.enum(['BEFORE', 'AFTER', 'ANY']).default('ANY'),
  instruction: z.string().trim().max(300).optional(),
});

export const prescriptionSchema = z.object({
  items: z.array(prescriptionItemSchema).min(1, 'Add at least one medication'),
  investigations: z.array(z.string().trim().max(160)).default([]),
  followUpDate: z.string().date().optional(),
});
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
