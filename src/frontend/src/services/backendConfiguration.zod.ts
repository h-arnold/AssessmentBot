import { z } from 'zod';
import {
  backendApiKeyValidationMessage,
  isBackendApiKeyToken,
  isMaskedBackendApiKeyValue,
} from './backendConfigurationValidation';

const IntegerSchema = z.number().int();
const NonEmptyStringSchema = z.string();
const BackendUrlSchema = z.union([z.url(), z.literal('')]);

const BackendApiKeyWriteSchema = z.string().refine(
  (value) => isBackendApiKeyToken(value),
  {
    message: backendApiKeyValidationMessage,
  }
);
const MaskedApiKeySchema = z.string().refine(isMaskedBackendApiKeyValue);

/**
 * Transport schema for backend configuration reads.
 *
 * @remarks
 * The read payload intentionally allows a blank `backendUrl` so partial-load responses carrying a
 * backend `loadError` can still be parsed and surfaced to the settings UI without failing the
 * entire query.
 */
export const BackendConfigSchema = z
  .object({
    backendAssessorBatchSize: IntegerSchema,
    apiKey: MaskedApiKeySchema,
    hasApiKey: z.boolean(),
    backendUrl: BackendUrlSchema,
    revokeAuthTriggerSet: z.boolean(),
    daysUntilAuthRevoke: IntegerSchema,
    slidesFetchBatchSize: IntegerSchema,
    jsonDbMasterIndexKey: NonEmptyStringSchema,
    jsonDbLockTimeoutMs: IntegerSchema,
    jsonDbLogLevel: NonEmptyStringSchema,
    jsonDbBackupOnInitialise: z.boolean(),
    jsonDbRootFolderId: z.string(),
    loadError: z.string().optional(),
  })
  .strict();

export type BackendConfig = z.infer<typeof BackendConfigSchema>;

/**
 * Transport schema for backend configuration writes.
 *
 * @remarks
 * This schema models the editable patch payload only. Read-only transport fields such as
 * `hasApiKey`, `loadError`, and `revokeAuthTriggerSet` are intentionally excluded from writes.
 */
export const BackendConfigWriteInputSchema = z
  .object({
    backendAssessorBatchSize: IntegerSchema.optional(),
    apiKey: BackendApiKeyWriteSchema.optional(),
    backendUrl: z.url().optional(),
    daysUntilAuthRevoke: IntegerSchema.optional(),
    slidesFetchBatchSize: IntegerSchema.optional(),
    jsonDbMasterIndexKey: NonEmptyStringSchema.optional(),
    jsonDbLockTimeoutMs: IntegerSchema.optional(),
    jsonDbLogLevel: NonEmptyStringSchema.optional(),
    jsonDbBackupOnInitialise: z.boolean().optional(),
    jsonDbRootFolderId: z.string().optional(),
  })
  .strict();

export type BackendConfigWriteInput = z.infer<typeof BackendConfigWriteInputSchema>;

/**
 * Transport schema for backend configuration save results.
 *
 * @remarks
 * This models the domain result returned inside the shared API success envelope. Transport-layer
 * failures are still represented by the outer `callApi` error envelope rather than this union.
 */
export const BackendConfigWriteResultSchema = z.union([
  z
    .object({
      success: z.literal(true),
    })
    .strict(),
  z
    .object({
      success: z.literal(false),
      error: z.string(),
    })
    .strict(),
]);

export type BackendConfigWriteResult = z.infer<typeof BackendConfigWriteResultSchema>;
