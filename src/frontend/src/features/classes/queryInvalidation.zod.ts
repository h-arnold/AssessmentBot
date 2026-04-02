import { z } from 'zod';

export const refreshErrorMetadataSchema = z
  .object({
    code: z.string().optional(),
    requestId: z.string().optional(),
    retriable: z.boolean().optional(),
  })
  .readonly();

export const requiredClassPartialsRefreshSuccessOutcomeSchema = z
  .object({
    mutationStatus: z.literal('success'),
    refreshStatus: z.literal('success'),
  })
  .readonly();

export const requiredClassPartialsRefreshFailureOutcomeSchema = z
  .object({
    mutationStatus: z.literal('success'),
    refreshError: refreshErrorMetadataSchema,
    refreshStatus: z.literal('failed'),
  })
  .readonly();

export const requiredClassPartialsRefreshOutcomeSchema = z.union([
  requiredClassPartialsRefreshSuccessOutcomeSchema,
  requiredClassPartialsRefreshFailureOutcomeSchema,
]);

export type RefreshErrorMetadata = z.infer<typeof refreshErrorMetadataSchema>;
export type RequiredClassPartialsRefreshSuccessOutcomeBase = z.infer<
  typeof requiredClassPartialsRefreshSuccessOutcomeSchema
>;
export type RequiredClassPartialsRefreshFailureOutcomeBase = z.infer<
  typeof requiredClassPartialsRefreshFailureOutcomeSchema
>;
export type RequiredClassPartialsRefreshOutcomeBase = z.infer<
  typeof requiredClassPartialsRefreshOutcomeSchema
>;
