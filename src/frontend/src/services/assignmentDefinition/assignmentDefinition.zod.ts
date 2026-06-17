import { z } from 'zod';
import { NullableIsoDateTimeWithTimezoneSchema } from './assignmentDefinitionPartials.zod';

export const MIN_WEIGHTING_VALUE = 0;
export const MAX_WEIGHTING_VALUE = 10;
export const DEFAULT_WEIGHTING_VALUE = 1;

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

const UrlStringSchema = TrimmedNonEmptyStringSchema.refine(
  (value) => {
    try {
      const url = new URL(value);
      return Boolean(url.protocol) && Boolean(url.hostname);
    } catch {
      return false;
    }
  },
  {
    message: 'Expected a valid URL.',
  }
);

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
    assignmentWeighting: WeightingSchema.nullable(),
    tasks: z.array(AssignmentDefinitionTaskSchema),
    createdAt: NullableIsoDateTimeWithTimezoneSchema,
    updatedAt: NullableIsoDateTimeWithTimezoneSchema,
  })
  .strict();

export type AssignmentDefinition = z.infer<typeof AssignmentDefinitionSchema>;

export const GetAssignmentDefinitionResponseSchema = AssignmentDefinitionSchema;

export type GetAssignmentDefinitionResponse = z.infer<typeof GetAssignmentDefinitionResponseSchema>;

/**
 * Checks whether any of the three ID-shape fields is present.
 *
 * @internal Extracted to reduce cyclomatic complexity of the public helper.
 * @param {boolean} hasReferenceId - Whether {@link UpsertAssignmentDefinitionRequestSchema.referenceDocumentId} is set.
 * @param {boolean} hasTemplateId - Whether {@link UpsertAssignmentDefinitionRequestSchema.templateDocumentId} is set.
 * @param {boolean} hasDocumentType - Whether {@link UpsertAssignmentDefinitionRequestSchema.documentType} is set.
 * @returns {boolean} `true` when at least one ID-shape field is present.
 */
function hasAnyIdField(
  hasReferenceId: boolean,
  hasTemplateId: boolean,
  hasDocumentType: boolean
): boolean {
  if (hasReferenceId) {
    return true;
  }
  if (hasTemplateId) {
    return true;
  }
  if (hasDocumentType) {
    return true;
  }
  return false;
}

/**
 * Checks whether all three ID-shape fields are present.
 *
 * @internal Extracted to reduce cyclomatic complexity of the public helper.
 * @param {boolean} hasReferenceId - Whether {@link UpsertAssignmentDefinitionRequestSchema.referenceDocumentId} is set.
 * @param {boolean} hasTemplateId - Whether {@link UpsertAssignmentDefinitionRequestSchema.templateDocumentId} is set.
 * @param {boolean} hasDocumentType - Whether {@link UpsertAssignmentDefinitionRequestSchema.documentType} is set.
 * @returns {boolean} `true` when every ID-shape field is present.
 */
function hasAllIdFields(
  hasReferenceId: boolean,
  hasTemplateId: boolean,
  hasDocumentType: boolean
): boolean {
  if (!hasReferenceId) {
    return false;
  }
  if (!hasTemplateId) {
    return false;
  }
  if (!hasDocumentType) {
    return false;
  }
  return true;
}

/**
 * Validates that the upsert payload conforms to either the URL-shape or the
 * ID-shape contract, enforcing mutual exclusion.
 *
 * @param {Object} value - The raw upsert payload fields.
 * @param {string} [value.referenceDocumentUrl] - URL of the reference document (URL-shape).
 * @param {string} [value.templateDocumentUrl] - URL of the template document (URL-shape).
 * @param {string} [value.referenceDocumentId] - ID of the reference document (ID-shape).
 * @param {string} [value.templateDocumentId] - ID of the template document (ID-shape).
 * @param {string} [value.documentType] - Document type discriminator (ID-shape).
 * @returns {string|null} An error message string, or `null` when the payload is valid.
 */
export function validateUpsertShape(value: {
  referenceDocumentUrl?: string;
  templateDocumentUrl?: string;
  referenceDocumentId?: string;
  templateDocumentId?: string;
  documentType?: string;
}): string | null {
  const hasReferenceUrl = value.referenceDocumentUrl !== undefined;
  const hasTemplateUrl = value.templateDocumentUrl !== undefined;
  const hasReferenceId = value.referenceDocumentId !== undefined;
  const hasTemplateId = value.templateDocumentId !== undefined;
  const hasDocumentType = value.documentType !== undefined;

  if (hasReferenceUrl !== hasTemplateUrl) {
    return 'referenceDocumentUrl and templateDocumentUrl must be provided together.';
  }

  if (hasReferenceUrl) {
    if (hasAnyIdField(hasReferenceId, hasTemplateId, hasDocumentType)) {
      return 'URL-shape and ID-shape fields are mutually exclusive. Provide either referenceDocumentUrl + templateDocumentUrl, or referenceDocumentId + templateDocumentId + documentType.';
    }
    return null;
  }

  if (hasAllIdFields(hasReferenceId, hasTemplateId, hasDocumentType)) {
    return null;
  }
  return 'Provide either referenceDocumentUrl + templateDocumentUrl (wizard shape), or referenceDocumentId + templateDocumentId + documentType (ID shape).';
}

/**
 * Upsert request schema supporting two mutually exclusive shapes:
 * - URL-shape (wizard): `referenceDocumentUrl` + `templateDocumentUrl` (both required, no ID fields)
 * - ID-shape (link flow): `referenceDocumentId` + `templateDocumentId` + `documentType` (all three required, no URL fields)
 * The `.superRefine()` delegates to `validateUpsertShape` for enforcement.
 */
export const UpsertAssignmentDefinitionRequestSchema = z
  .object({
    definitionKey: TrimmedNonEmptyStringSchema.optional(),
    primaryTitle: TrimmedNonEmptyStringSchema,
    primaryTopicKey: TrimmedNonEmptyStringSchema,
    yearGroupKey: TrimmedNonEmptyStringSchema,
    referenceDocumentUrl: UrlStringSchema.optional(),
    templateDocumentUrl: UrlStringSchema.optional(),
    referenceDocumentId: TrimmedNonEmptyStringSchema.optional(),
    templateDocumentId: TrimmedNonEmptyStringSchema.optional(),
    documentType: DocumentTypeSchema.optional(),
    alternateTitles: z.array(TrimmedNonEmptyStringSchema).optional(),
    alternateTopics: z.array(TrimmedNonEmptyStringSchema).optional(),
    assignmentWeighting: WeightingSchema.optional().nullable(),
    taskWeightings: z.array(TaskWeightingInputSchema).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const errorMessage = validateUpsertShape(value);
    if (errorMessage !== null) {
      context.addIssue({
        code: 'custom',
        message: errorMessage,
        path: ['__root__'],
      });
    }
  });

export type UpsertAssignmentDefinitionRequest = z.infer<
  typeof UpsertAssignmentDefinitionRequestSchema
>;

export const UpsertAssignmentDefinitionResponseSchema = AssignmentDefinitionSchema;

export type UpsertAssignmentDefinitionResponse = z.infer<
  typeof UpsertAssignmentDefinitionResponseSchema
>;
