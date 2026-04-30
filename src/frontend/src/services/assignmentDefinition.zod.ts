import { z } from 'zod';

const MIN_WEIGHTING_VALUE = 0;
const MAX_WEIGHTING_VALUE = 10;

const TrimmedNonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0 && value.trim() === value, {
    message: 'Expected a non-empty, trimmed string.',
  });

const WeightingSchema = z.number().min(MIN_WEIGHTING_VALUE).max(MAX_WEIGHTING_VALUE);
const DocumentTypeSchema = z.enum(['SLIDES', 'SHEETS']);

const AssignmentDefinitionTaskSchema = z
  .object({
    taskId: TrimmedNonEmptyStringSchema,
    taskTitle: TrimmedNonEmptyStringSchema,
    taskWeighting: WeightingSchema,
  })
  .strict();

const TaskWeightingInputSchema = z
  .object({
    taskId: TrimmedNonEmptyStringSchema,
    taskWeighting: WeightingSchema,
  })
  .strict();

const UrlStringSchema = TrimmedNonEmptyStringSchema.refine((value) => {
  try {
    const url = new URL(value);
    return Boolean(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}, {
  message: 'Expected a valid URL.',
});

const NullableIsoTimestampSchema = TrimmedNonEmptyStringSchema.refine((value) => {
  return !Number.isNaN(Date.parse(value));
}, {
  message: 'Expected an ISO timestamp string.',
}).nullable();

export const GetAssignmentDefinitionRequestSchema = z
  .object({
    definitionKey: TrimmedNonEmptyStringSchema,
  })
  .strict();

export type GetAssignmentDefinitionRequest = z.infer<typeof GetAssignmentDefinitionRequestSchema>;

export const AssignmentDefinitionSchema = z
  .object({
    definitionKey: TrimmedNonEmptyStringSchema,
    primaryTitle: TrimmedNonEmptyStringSchema,
    primaryTopicKey: TrimmedNonEmptyStringSchema,
    primaryTopic: TrimmedNonEmptyStringSchema,
    yearGroupKey: TrimmedNonEmptyStringSchema,
    yearGroupLabel: TrimmedNonEmptyStringSchema,
    alternateTitles: z.array(TrimmedNonEmptyStringSchema),
    alternateTopics: z.array(TrimmedNonEmptyStringSchema),
    documentType: DocumentTypeSchema,
    referenceDocumentId: TrimmedNonEmptyStringSchema,
    templateDocumentId: TrimmedNonEmptyStringSchema,
    assignmentWeighting: WeightingSchema,
    tasks: z.array(AssignmentDefinitionTaskSchema),
    createdAt: NullableIsoTimestampSchema,
    updatedAt: NullableIsoTimestampSchema,
  })
  .strict();

export type AssignmentDefinition = z.infer<typeof AssignmentDefinitionSchema>;

export const GetAssignmentDefinitionResponseSchema = AssignmentDefinitionSchema;

export type GetAssignmentDefinitionResponse = z.infer<typeof GetAssignmentDefinitionResponseSchema>;

export const UpsertAssignmentDefinitionRequestSchema = z
  .object({
    definitionKey: TrimmedNonEmptyStringSchema.optional(),
    primaryTitle: TrimmedNonEmptyStringSchema,
    primaryTopicKey: TrimmedNonEmptyStringSchema,
    yearGroupKey: TrimmedNonEmptyStringSchema,
    referenceDocumentUrl: UrlStringSchema,
    templateDocumentUrl: UrlStringSchema,
    assignmentWeighting: WeightingSchema.optional(),
    taskWeightings: z.array(TaskWeightingInputSchema).optional(),
  })
  .strict();

export type UpsertAssignmentDefinitionRequest = z.infer<typeof UpsertAssignmentDefinitionRequestSchema>;

export const UpsertAssignmentDefinitionResponseSchema = AssignmentDefinitionSchema;

export type UpsertAssignmentDefinitionResponse = z.infer<
  typeof UpsertAssignmentDefinitionResponseSchema
>;
