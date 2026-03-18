import { z } from 'zod';

const IntegerSchema = z.number().int();
const NonEmptyStringSchema = z.string();
const MaskedApiKeySchema = z
    .string()
    .refine((value) => value === '' || value === '****' || /^\*{4}.{4}$/.test(value));

export const BackendConfigSchema = z
    .object({
        backendAssessorBatchSize: IntegerSchema,
        apiKey: MaskedApiKeySchema,
        hasApiKey: z.boolean(),
        backendUrl: z.string(),
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

export const BackendConfigWriteInputSchema = z
    .object({
        backendAssessorBatchSize: IntegerSchema.optional(),
        apiKey: z.string().optional(),
        backendUrl: z.string().optional(),
        revokeAuthTriggerSet: z.boolean().optional(),
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