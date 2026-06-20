import { z } from 'zod';

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
  content: z.null(),
  contentHash: z.null(),
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
  assessments: z.record(z.string(), z.unknown()).optional(),
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

export const AssignmentDefinitionPartialSchema = z.object({
  primaryTitle: z.string(),
  primaryTopic: z.string(),
  primaryTopicKey: z.string(),
  yearGroupKey: z.string(),
  yearGroupLabel: z.string(),
  alternateTitles: z.array(z.string()),
  alternateTopics: z.array(z.string()),
  documentType: z.string(),
  // These three fields are nullable on the wire: AssignmentDefinition.toPartialJSON()
  // passes them through from the instance, and AssignmentDefinition.fromJSON() coerces
  // missing referenceDocumentId / templateDocumentId to null. assignmentWeighting is
  // marked nullable to match the existing convention in
  // assignmentDefinition.zod.ts (WeightingSchema.nullable()) and
  // assignmentDefinitionPartials.zod.ts (z.number().nullable()).
  referenceDocumentId: z.string().nullable(),
  templateDocumentId: z.string().nullable(),
  assignmentWeighting: z.number().nullable(),
  definitionKey: z.string(),
  tasks: z.null(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AssignmentDefinitionPartial = z.infer<typeof AssignmentDefinitionPartialSchema>;

export const AssignmentPartialSchema = z.object({
  courseId: z.string(),
  assignmentId: z.string(),
  assignmentName: z.string(),
  dueDate: z.string().nullable(),
  lastUpdated: z.string().nullable(),
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
