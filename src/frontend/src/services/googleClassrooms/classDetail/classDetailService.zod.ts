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

export const StudentSubmissionPartialSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  artifact: BaseTaskArtifactPartialSchema,
  assessments: z.record(z.string(), z.unknown()).optional(),
  feedback: z.record(z.string(), z.unknown()).optional(),
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
  referenceDocumentId: z.string(),
  templateDocumentId: z.string(),
  assignmentWeighting: z.number(),
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
