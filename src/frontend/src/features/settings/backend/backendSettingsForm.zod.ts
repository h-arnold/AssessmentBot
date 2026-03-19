import { z } from 'zod';

const BackendAssessorBatchSizeSchema = z.number().int().min(1).max(500);
const SlidesFetchBatchSizeSchema = z.number().int().min(1).max(100);
const DaysUntilAuthRevokeSchema = z.number().int().min(1).max(365);
const JsonDbLockTimeoutMsSchema = z.number().int().min(10 ** 3).max(6 * 10 ** 5);
const JsonDbLogLevelValues = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
const JsonDbLogLevelSchema = z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(JsonDbLogLevelValues));

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
 * Determines whether a string matches the backend Drive folder identifier contract.
 *
 * @param {string} value The candidate folder identifier.
 * @returns {boolean} True when the identifier shape is valid.
 */
const isDriveFolderId = (value: string): boolean => {
    if (value.length < 10) {
        return false;
    }

    for (const character of value) {
        if (
            !isAlphaNumericCharacter(character) &&
            character !== '_' &&
            character !== '-'
        ) {
            return false;
        }
    }

    return true;
};

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
        backendAssessorBatchSize: BackendAssessorBatchSizeSchema,
        slidesFetchBatchSize: SlidesFetchBatchSizeSchema,
        daysUntilAuthRevoke: DaysUntilAuthRevokeSchema,
        jsonDbMasterIndexKey: z.string().trim().min(1),
        jsonDbLockTimeoutMs: JsonDbLockTimeoutMsSchema,
        jsonDbLogLevel: JsonDbLogLevelSchema,
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
        if (value.hasApiKey) {
            if (value.apiKey !== '' && !isBackendApiKeyToken(value.apiKey)) {
                context.addIssue({
                    code: 'custom',
                    path: ['apiKey'],
                    message:
                        'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.',
                });
            }
            return;
        }

        if (value.apiKey === '' || !isBackendApiKeyToken(value.apiKey)) {
            context.addIssue({
                code: 'custom',
                path: ['apiKey'],
                message:
                    'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.',
            });
        }
    })
    .strict();

export type BackendSettingsForm = z.infer<typeof BackendSettingsFormSchema>;
