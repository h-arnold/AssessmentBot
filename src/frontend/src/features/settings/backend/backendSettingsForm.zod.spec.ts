import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { BackendSettingsFormSchema } from './backendSettingsForm.zod';

const validTrimmedBackendUrl = 'https://backend.example.com';

const validFormValues = {
    hasApiKey: false,
    apiKey: 'replacement-key-123',
    backendUrl: `  ${validTrimmedBackendUrl}  `,
    backendAssessorBatchSize: 30,
    slidesFetchBatchSize: 20,
    daysUntilAuthRevoke: 60,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-1234',
};

const lowerCaseLogLevelFormValues = {
    ...validFormValues,
    jsonDbLogLevel: 'warn',
};

const validStoredKeyFormValues = {
    ...validFormValues,
    hasApiKey: true,
    apiKey: '',
};

const blankDriveFolderFormValues = {
    ...validFormValues,
    jsonDbRootFolderId: '   ',
};

describe('backendSettingsForm.zod schema', () => {
    it('accepts a complete form payload with a trimmed backend URL', () => {
        expect(BackendSettingsFormSchema.parse(validFormValues)).toEqual({
            ...validFormValues,
            backendUrl: validTrimmedBackendUrl,
        });
    });

    it('accepts a blank API key when a stored key already exists', () => {
        expect(BackendSettingsFormSchema.parse(validStoredKeyFormValues)).toEqual({
            ...validStoredKeyFormValues,
            backendUrl: validTrimmedBackendUrl,
        });
    });

    it('normalises the JSON DB log level to uppercase', () => {
        expect(BackendSettingsFormSchema.parse(lowerCaseLogLevelFormValues)).toEqual({
            ...lowerCaseLogLevelFormValues,
            backendUrl: validTrimmedBackendUrl,
            jsonDbLogLevel: 'WARN',
        });
    });

    it('accepts and trims a blankable JSON DB root folder ID', () => {
        expect(BackendSettingsFormSchema.parse(blankDriveFolderFormValues)).toEqual({
            ...blankDriveFolderFormValues,
            backendUrl: validTrimmedBackendUrl,
            jsonDbRootFolderId: '',
        });
    });

    it('requires an API key when no stored key exists', () => {
        expect(() =>
            BackendSettingsFormSchema.parse({
                ...validStoredKeyFormValues,
                hasApiKey: false,
                apiKey: '',
            })
        ).toThrow(ZodError);
    });

    it.each([
        ['backend URL', { backendUrl: 'not-a-url' }],
        ['backend assessor batch size', { backendAssessorBatchSize: 0 }],
        ['slides fetch batch size', { slidesFetchBatchSize: 101 }],
        ['days until auth revoke', { daysUntilAuthRevoke: 366 }],
        ['JSON DB lock timeout', { jsonDbLockTimeoutMs: 999 }],
        ['JSON DB log level', { jsonDbLogLevel: 'TRACE' }],
        ['JSON DB root folder ID', { jsonDbRootFolderId: 'short' }],
    ])('rejects invalid %s input', (_, patch) => {
        expect(() =>
            BackendSettingsFormSchema.parse({
                ...validFormValues,
                ...patch,
            })
        ).toThrow(ZodError);
    });
});
