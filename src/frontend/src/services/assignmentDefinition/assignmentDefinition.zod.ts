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
 * @param {boolean} hasReferenceId - Whether the `referenceDocumentId` field is present in the payload.
 * @param {boolean} hasTemplateId - Whether the `templateDocumentId` field is present in the payload.
 * @param {boolean} hasDocumentType - Whether the `documentType` field is present in the payload.
 * @returns {boolean} `true` when at least one ID-shape field is present.
 */
function hasAnyIdField(
  hasReferenceId: boolean,
  hasTemplateId: boolean,
  hasDocumentType: boolean
): boolean {
  return hasReferenceId || hasTemplateId || hasDocumentType;
}

/**
 * Checks whether all three ID-shape fields are present.
 *
 * @internal Extracted to reduce cyclomatic complexity of the public helper.
 * @param {boolean} hasReferenceId - Whether the `referenceDocumentId` field is present in the payload.
 * @param {boolean} hasTemplateId - Whether the `templateDocumentId` field is present in the payload.
 * @param {boolean} hasDocumentType - Whether the `documentType` field is present in the payload.
 * @returns {boolean} `true` when every ID-shape field is present.
 */
function hasAllIdFields(
  hasReferenceId: boolean,
  hasTemplateId: boolean,
  hasDocumentType: boolean
): boolean {
  return hasReferenceId && hasTemplateId && hasDocumentType;
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

/**
 * Fields from the upsert request used to discriminate between URL-shape and
 * ID-shape payloads.
 */
type ShapeDiscriminatorFields = Pick<
  UpsertAssignmentDefinitionRequest,
  | 'referenceDocumentUrl'
  | 'templateDocumentUrl'
  | 'referenceDocumentId'
  | 'templateDocumentId'
  | 'documentType'
>;

/**
 * Validates that the upsert payload conforms to either the URL-shape or the
 * ID-shape contract, enforcing mutual exclusion.
 *
 * @remarks
 * This function enforces the URL-shape vs ID-shape mutual exclusion rule,
 * mirroring the backend transport validation split described in
 * `docs/developer/backend/api-layer.md`. The wizard's existing payload (URL-shape)
 * continues to pass without modification; the link flow uses the ID-shape contract.
 *
 * @param {ShapeDiscriminatorFields} value - The raw upsert payload fields.
 * @returns {string|null} An error message string, or `null` when the payload is valid.
 */
export function validateUpsertShape(value: ShapeDiscriminatorFields): string | null {
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
  return 'Provide either referenceDocumentUrl + templateDocumentUrl (URL-shape), or referenceDocumentId + templateDocumentId + documentType (ID-shape).';
}

export const UpsertAssignmentDefinitionResponseSchema = AssignmentDefinitionSchema;

export type UpsertAssignmentDefinitionResponse = z.infer<
  typeof UpsertAssignmentDefinitionResponseSchema
>;
