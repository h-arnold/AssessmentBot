import { z } from 'zod';

const IntegerSchema = z.number().int();
const NonEmptyStringSchema = z.string();
const BackendUrlSchema = z.union([z.url(), z.literal('')]);

/**
 * Determines whether a character is ASCII alphanumeric.
 *
 * @param {string} character The character to inspect.
 * @returns {boolean} True when the character is alphanumeric.
 */
const isAlphaNumericCharacter = (character: string): boolean => {
    const characterCode = character.codePointAt(0);
    return (
        characterCode !== undefined &&
        ((characterCode >= 48 && characterCode <= 57) ||
            (characterCode >= 65 && characterCode <= 90) ||
            (characterCode >= 97 && characterCode <= 122))
    );
};

/**
 * Determines whether a value matches the backend API key token contract.
 *
 * @param {string} value The candidate API key.
 * @returns {boolean} True when the value is a valid token.
 */
const isBackendApiKeyToken = (value: string): boolean => {
    if (value === '') {
        return false;
    }

    const tokenSegments = value.split('-');
    if (tokenSegments.some((segment) => segment.length === 0)) {
        return false;
    }

    return tokenSegments.every((segment) => {
        for (const character of segment) {
            if (!isAlphaNumericCharacter(character)) {
                return false;
            }
        }

        return true;
    });
};

/**
 * Determines whether a masked API key value matches the read contract.
 *
 * @param {string} value The candidate masked API key.
 * @returns {boolean} True when the value is an accepted mask.
 */
const isMaskedApiKeyValue = (value: string): boolean => {
    return value === '' || value === '****' || (value.startsWith('****') && value.length === 8);
};

const BackendApiKeyWriteSchema = z.string().refine(
    (value) => isBackendApiKeyToken(value),
    {
        message:
            'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.',
    }
);
const MaskedApiKeySchema = z.string().refine(isMaskedApiKeyValue);

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
