import { z } from 'zod';
import {
  backendApiKeyValidationMessage,
  isBackendApiKeyToken,
  isDriveFolderId,
} from '../../../services/backendConfigurationValidation';

const backendAssessorBatchSizeMinimum = 1;
const backendAssessorBatchSizeMaximum = 500;
const slidesFetchBatchSizeMinimum = 1;
const slidesFetchBatchSizeMaximum = 100;
const daysUntilAuthRevokeMinimum = 1;
const daysUntilAuthRevokeMaximum = 365;
const millisecondsPerSecond = 1000;
const maximumJsonDatabaseLockTimeoutSeconds = 600;
const backendAssessorBatchSizeSchema = z
  .number()
  .int()
  .min(backendAssessorBatchSizeMinimum)
  .max(backendAssessorBatchSizeMaximum);
const slidesFetchBatchSizeSchema = z
  .number()
  .int()
  .min(slidesFetchBatchSizeMinimum)
  .max(slidesFetchBatchSizeMaximum);
const daysUntilAuthRevokeSchema = z
  .number()
  .int()
  .min(daysUntilAuthRevokeMinimum)
  .max(daysUntilAuthRevokeMaximum);
const jsonDatabaseLockTimeoutMsSchema = z
  .number()
  .int()
  .min(millisecondsPerSecond)
  .max(maximumJsonDatabaseLockTimeoutSeconds * millisecondsPerSecond);
const jsonDatabaseLogLevelValues = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
const jsonDatabaseLogLevelSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.enum(jsonDatabaseLogLevelValues));

/**
 * Canonical frontend validation schema for the backend settings form.
 *
 * @remarks
 * `backendUrl` is trimmed before URL validation so incidental whitespace in the form input does not
 * produce a false negative. The frontend uses Zod URL validation here now so the user-input contract
 * and transport contract stay aligned while the backend validator hardening follow-up is completed
 * separately.
 */
export const BackendSettingsFormSchema = z
  .object({
    hasApiKey: z.boolean(),
    apiKey: z.string().trim(),
    backendUrl: z.string().trim().pipe(z.url()),
    backendAssessorBatchSize: backendAssessorBatchSizeSchema,
    slidesFetchBatchSize: slidesFetchBatchSizeSchema,
    daysUntilAuthRevoke: daysUntilAuthRevokeSchema,
    jsonDbMasterIndexKey: z.string().trim().min(1),
    jsonDbLockTimeoutMs: jsonDatabaseLockTimeoutMsSchema,
    jsonDbLogLevel: jsonDatabaseLogLevelSchema,
    jsonDbBackupOnInitialise: z.boolean(),
    jsonDbRootFolderId: z
      .string()
      .trim()
      .optional()
      .transform((value) => value ?? '')
      .refine((value) => value === '' || isDriveFolderId(value), {
        message:
          'JSON DB Root Folder ID must match the backend Drive folder identifier contract.',
      }),
  })
  .superRefine((value, context) => {
    const isTokenInvalid = !isBackendApiKeyToken(value.apiKey);

    if (isTokenInvalid && (!value.hasApiKey || value.apiKey !== '')) {
      context.addIssue({
        code: 'custom',
        path: ['apiKey'],
        message: backendApiKeyValidationMessage,
      });
    }
  })
  .strict();

export type BackendSettingsForm = z.infer<typeof BackendSettingsFormSchema>;
