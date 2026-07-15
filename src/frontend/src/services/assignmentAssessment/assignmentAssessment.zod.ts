import { z } from 'zod';

export const StartAssessmentRunRequestSchema = z
  .object({
    definitionKey: z.string(),
    assignmentId: z.string(),
    courseId: z.string(),
  })
  .strict();

export type StartAssessmentRunRequest = z.infer<typeof StartAssessmentRunRequestSchema>;

export const StartAssessmentRunResponseSchema = z.void().nullable();

export type StartAssessmentRunResponse = z.infer<typeof StartAssessmentRunResponseSchema>;

/**
 * Schema for an assessment, matching `Assessment.toJSON()` in
 * `src/backend/Models/Assessment.js`.
 */
export const AssessmentSchema = z.object({
  score: z.number(),
  reasoning: z.string(),
});

const BaseTaskArtifactFields = z.object({
  taskId: z.string(),
  role: z.string(),
  pageId: z.string(),
  documentId: z.string(),
  uid: z.string(),
  contentHash: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

/**
 * Schema for a base task artifact, matching `BaseTaskArtifact.toJSON()` in
 * `src/backend/Models/Artifacts/0_BaseTaskArtifact.js`.
 *
 * @remarks
 * Uses a union discriminated by `type` to validate `content` shape:
 * - TEXT/TABLE/IMAGE → content is `string | null`
 * - SPREADSHEET → content is `Array<Array<string | number | null>> | null`
 * - base → content is `unknown` (the base type; artifacts that have not been
 *   assigned a more specific type)
 */
export const BaseTaskArtifactSchema = z.discriminatedUnion('type', [
  BaseTaskArtifactFields.extend({
    type: z.enum(['TEXT', 'TABLE', 'IMAGE']),
    content: z.string().nullable(),
  }),
  BaseTaskArtifactFields.extend({
    type: z.literal('SPREADSHEET'),
    content: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).nullable(),
  }),
  BaseTaskArtifactFields.extend({
    type: z.literal('base'),
    content: z.unknown(),
  }),
]);

/**
 * Schema for a task definition, matching `TaskDefinition.toJSON()` in
 * `src/backend/Models/TaskDefinition.js`.
 */
export const TaskDefinitionSchema = z.object({
  id: z.string(),
  taskTitle: z.string(),
  pageId: z.string(),
  taskNotes: z.string().nullable(),
  taskMetadata: z.record(z.string(), z.unknown()),
  taskWeighting: z.number(),
  index: z.number().nullable(),
  artifacts: z.object({
    reference: z.array(BaseTaskArtifactSchema),
    template: z.array(BaseTaskArtifactSchema),
  }),
});

/**
 * Schema for a student submission item, matching `StudentSubmissionItem.toJSON()` in
 * `src/backend/Models/StudentSubmission.js`.
 */
export const StudentSubmissionItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  artifact: BaseTaskArtifactSchema,
  assessments: z.record(z.string(), AssessmentSchema),
  feedback: z.record(
    z.string(),
    z.looseObject({
      type: z.string(),
      createdAt: z.string(),
    })
  ),
});

/**
 * Schema for a student submission, matching `StudentSubmission.toJSON()` in
 * `src/backend/Models/StudentSubmission.js`.
 */
export const StudentSubmissionSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  assignmentId: z.string(),
  documentId: z.string().nullable(),
  items: z.record(z.string(), StudentSubmissionItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Schema for an assignment definition, matching `AssignmentDefinition.toJSON()` in
 * `src/backend/Models/AssignmentDefinition.js`.
 */
export const AssignmentDefinitionSchema = z.object({
  primaryTitle: z.string(),
  primaryTopic: z.string().nullable(),
  primaryTopicKey: z.string().nullable(),
  yearGroupKey: z.string().nullable(),
  yearGroupLabel: z.string().nullable(),
  alternateTitles: z.array(z.string()),
  alternateTopics: z.array(z.string()),
  documentType: z.string().nullable(),
  referenceDocumentId: z.string().nullable(),
  templateDocumentId: z.string().nullable(),
  referenceLastModified: z.string().nullable(),
  templateLastModified: z.string().nullable(),
  assignmentWeighting: z.number(),
  definitionKey: z.string(),
  tasks: z.record(z.string(), TaskDefinitionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Schema for the full assignment payload returned by `getAssignment`.
 *
 * @remarks
 * Mirrors the top-level fields of `Assignment.toJSON()` in
 * `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js`,
 * which emits `courseId`, `assignmentId`, `assignmentName`, `dueDate`,
 * `updatedAt`, `createdAt`, plus `_extractFullDefinitionFields` (documentType,
 * referenceDocumentId, templateDocumentId, tasks), submissions, and
 * assignmentDefinition. The inner `AssignmentDefinition.toJSON()` is the
 * source of truth at `src/backend/Models/AssignmentDefinition.js`.
 * Check those files when the backend response shape changes.
 *
 * This top-level schema is `.strict()`, so extra fields directly on the
 * assignment payload cause a Zod error. Nested object schemas (for example
 * `TaskDefinitionSchema`, `StudentSubmissionSchema`, `AssignmentDefinitionSchema`,
 * and `BaseTaskArtifactSchema`) are intentionally non-strict and tolerate extra
 * keys, so only the top-level shape is enforced strictly.
 */
export const AssignmentFullSchema = z
  .object({
    courseId: z.string(),
    assignmentId: z.string(),
    assignmentName: z.string(),
    dueDate: z.string().nullable(),
    updatedAt: z.string().nullable(),
    createdAt: z.string(),
    documentType: z.string().nullable(),
    referenceDocumentId: z.string().nullable(),
    templateDocumentId: z.string().nullable(),
    tasks: z.record(z.string(), TaskDefinitionSchema).nullable(),
    submissions: z.array(StudentSubmissionSchema),
    assignmentDefinition: AssignmentDefinitionSchema,
  })
  .strict();

export type AssignmentFull = z.infer<typeof AssignmentFullSchema>;

/**
 * Response schema for `getAssignment`. Accepts the full assignment object or `null`
 * (when the backend cannot find the assignment document).
 *
 * @remarks
 * The non-null payload mirrors `Assignment.toJSON()` from the backend. The
 * nullable wrapper matches the backend's `null`-on-not-found contract.
 * Source-of-truth backend file: `00_AssignmentSerialisation.js`.
 */
export const AssignmentFullResponseSchema = AssignmentFullSchema.nullable();

export type AssignmentFullResponse = z.infer<typeof AssignmentFullResponseSchema>;

/**
 * Request schema for `getAssignment`. Requires `courseId` and `assignmentId` as strings.
 */
export const GetAssignmentRequestSchema = z
  .object({
    courseId: z.string(),
    assignmentId: z.string(),
  })
  .strict();

export type GetAssignmentRequest = z.infer<typeof GetAssignmentRequestSchema>;
