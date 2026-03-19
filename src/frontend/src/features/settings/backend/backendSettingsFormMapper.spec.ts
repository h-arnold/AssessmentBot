import { describe, expect, it } from 'vitest';
import {
    mapBackendConfigToBackendSettingsFormValues,
    mapBackendSettingsFormValuesToBackendConfigWriteInput,
} from './backendSettingsFormMapper';

const validTrimmedBackendUrl = 'https://backend.example.com';

type BackendSettingsFormTestValues = {
    hasApiKey: boolean;
    apiKey: string;
    backendUrl: string;
    backendAssessorBatchSize: number;
    slidesFetchBatchSize: number;
    daysUntilAuthRevoke: number;
    jsonDbMasterIndexKey: string;
    jsonDbLockTimeoutMs: number;
    jsonDbLogLevel: string;
    jsonDbBackupOnInitialise: boolean;
    jsonDbRootFolderId: string;
};

const maskedBackendConfig = {
    backendAssessorBatchSize: 30,
    apiKey: '****cdef',
    hasApiKey: true,
    backendUrl: validTrimmedBackendUrl,
    revokeAuthTriggerSet: false,
    daysUntilAuthRevoke: 60,
    slidesFetchBatchSize: 20,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-1234',
    loadError: 'apiKey: REDACTED',
};

const storedKeyFormValues = {
    hasApiKey: true,
    apiKey: '',
    backendUrl: validTrimmedBackendUrl,
    backendAssessorBatchSize: 30,
    slidesFetchBatchSize: 20,
    daysUntilAuthRevoke: 60,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-1234',
};

describe('backendSettingsFormMapper', () => {
    it('maps a masked backend payload to a blank API key input', () => {
        const formValues = mapBackendConfigToBackendSettingsFormValues(
            maskedBackendConfig
        ) as unknown as BackendSettingsFormTestValues;

        expect(formValues).toMatchObject({
            hasApiKey: true,
            apiKey: '',
            backendUrl: validTrimmedBackendUrl,
            backendAssessorBatchSize: 30,
            slidesFetchBatchSize: 20,
            daysUntilAuthRevoke: 60,
            jsonDbMasterIndexKey: 'master-index',
            jsonDbLockTimeoutMs: 15_000,
            jsonDbLogLevel: 'INFO',
            jsonDbBackupOnInitialise: true,
            jsonDbRootFolderId: 'folder-1234',
        });
        expect(formValues.apiKey).toBe('');
        expect(formValues.apiKey).not.toBe(maskedBackendConfig.apiKey);
    });

    it('omits apiKey when a stored key exists and the replacement field is blank', () => {
        const writePayload = mapBackendSettingsFormValuesToBackendConfigWriteInput({
            ...storedKeyFormValues,
            apiKey: '',
        } as unknown as Parameters<
            typeof mapBackendSettingsFormValuesToBackendConfigWriteInput
        >[0]);

        expect(writePayload).not.toHaveProperty('apiKey');
        expect(writePayload).not.toHaveProperty('revokeAuthTriggerSet');
        expect(writePayload).not.toHaveProperty('hasApiKey');
        expect(writePayload).not.toHaveProperty('loadError');
    });

    it('includes apiKey when a replacement value is entered', () => {
        const writePayload = mapBackendSettingsFormValuesToBackendConfigWriteInput({
            ...storedKeyFormValues,
            apiKey: 'replacement-key-123',
        } as unknown as Parameters<
            typeof mapBackendSettingsFormValuesToBackendConfigWriteInput
        >[0]);

        expect(writePayload).toMatchObject({
            apiKey: 'replacement-key-123',
        });
        expect(writePayload).not.toHaveProperty('revokeAuthTriggerSet');
        expect(writePayload).not.toHaveProperty('hasApiKey');
        expect(writePayload).not.toHaveProperty('loadError');
    });
});
