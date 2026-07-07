import { z } from 'zod';

/** Maximum valid assessment score (inclusive). Backend PartialAssessment model range. */
const MAX_ASSESSMENT_SCORE = 5;

/**
 * A single assessment score: an integer 0-5, or `'N'` for non-applicable (SPaG).
 * @remarks Score range enforcement matches the backend PartialAssessment model.
 */
export const PartialAssessmentScoreSchema = z.union([
  z.number().int().min(0).max(MAX_ASSESSMENT_SCORE),
  z.literal('N'),
]);

export type PartialAssessmentScore = z.infer<typeof PartialAssessmentScoreSchema>;

/**
 * A single assessment entry keyed by criterion, containing only the `score` field
 * in the partial wire shape (reasoning is stripped).
 */
export const PartialAssessmentEntrySchema = z.object({
  score: PartialAssessmentScoreSchema,
});

export type PartialAssessmentEntry = z.infer<typeof PartialAssessmentEntrySchema>;

/**
 * The canonical `AssignmentDefinitionPartialSchema` lives in
 * `assignmentDefinitionPartials.zod.ts`. The `classDetailService.zod.ts` file
 * previously carried a duplicate lenient copy. After the unification in
 * Section 3 (Green Phase), the canonical schema is the single source of truth
 * and is imported/re-exported here.
 *
 * @remarks
 * `referenceDocumentId` and `templateDocumentId` in the canonical schema are
 * `.nullable()` (they used to be non-nullable in the canonical schema before
 * the unification; the classDetailService copy already had them nullable).
 */
import { AssignmentDefinitionPartialSchema } from '../../assignmentDefinition/assignmentDefinitionPartials.zod';

export const TeacherSummarySchema = z.object({
  userId: z.string().nullable(),
  email: z.string().nullable(),
  teacherName: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export type TeacherSummary = z.infer<typeof TeacherSummarySchema>;

export const StudentSummarySchema = z.object({
  name: z.string(),
  email: z.string(),
  id: z.string(),
});

export type StudentSummary = z.infer<typeof StudentSummarySchema>;

export const BaseTaskArtifactPartialSchema = z.object({
  taskId: z.string(),
  role: z.string(),
  pageId: z.string().nullable().optional(),
  documentId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  uid: z.string(),
  type: z.string(),
});

export type BaseTaskArtifactPartial = z.infer<typeof BaseTaskArtifactPartialSchema>;

/**
 * A single `StudentSubmissionItem.toPartialJSON()` entry inside a parent submission's
 * `items` dictionary.  This is the pre-existing (formerly named `StudentSubmissionPartialSchema`)
 * schema, now correctly scoped to a single item.
 * @remarks Matches the wire shape from {@link StudentSubmissionItem.toPartialJSON()} in
 *          `src/backend/Models/StudentSubmission.js:121-126`.
 */
export const StudentSubmissionItemPartialSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  artifact: BaseTaskArtifactPartialSchema,
  assessments: z.record(z.string(), PartialAssessmentEntrySchema).optional(),
  feedback: z.record(z.string(), z.unknown()).optional(),
});

export type StudentSubmissionItemPartial = z.infer<typeof StudentSubmissionItemPartialSchema>;

/**
 * Canonical nested-dictionary shape matching `StudentSubmission.toPartialJSON()` wire output.
 * The `items` field is a dictionary keyed by `taskId`, not a flat array.
 * @remarks This replaces the pre-existing buggy flat shape that modelled a single
 *          `StudentSubmissionItem` instead of the outer submission wrapper.  See
 *          `src/backend/Models/StudentSubmission.js:330-336` for the wire source of truth.
 */
export const StudentSubmissionPartialSchema = z.object({
  studentId: z.string(),
  studentName: z.string().nullable(),
  assignmentId: z.string(),
  documentId: z.string().nullable(),
  items: z.record(z.string(), StudentSubmissionItemPartialSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StudentSubmissionPartial = z.infer<typeof StudentSubmissionPartialSchema>;

/**
 * A partial assignment instance as returned by `toPartialJSON()`.
 *
 * @remarks
 * The `updatedAt` field was renamed from `lastUpdated` in v1 to align with
 * `StudentSubmissionPartial.updatedAt` and `AssignmentDefinitionPartial.updatedAt`.
 * The field remains `z.string().nullable()`; a null `updatedAt` on a candidate
 * assignment is a data bug that fails fast at the `getABClass` adapter boundary
 * (not a soft signal).
 */
export const AssignmentPartialSchema = z.object({
  assignmentId: z.string(),
  dueDate: z.string().nullable().optional(),
  updatedAt: z.string().nullable(),
  createdAt: z.string(),
  documentType: z.string().nullable(),
  submissions: z.array(StudentSubmissionPartialSchema),
  assignmentDefinition: AssignmentDefinitionPartialSchema,
});

export type AssignmentPartial = z.infer<typeof AssignmentPartialSchema>;

export const ClassFullSchema = z.object({
  classId: z.string(),
  className: z.string().nullable(),
  cohortKey: z.string().nullable(),
  courseLength: z.number(),
  yearGroupKey: z.string().nullable(),
  classOwner: TeacherSummarySchema.nullable(),
  teachers: z.array(TeacherSummarySchema),
  students: z.array(StudentSummarySchema),
  assignments: z.array(AssignmentPartialSchema),
  active: z.boolean().nullable(),
});

export type ClassFull = z.infer<typeof ClassFullSchema>;

export const ClassFullResponseSchema = ClassFullSchema.nullable();

export type ClassFullResponse = z.infer<typeof ClassFullResponseSchema>;
