import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

const validMaskedBackendConfig = {
    backendAssessorBatchSize: 30,
    apiKey: '****cdef',
    hasApiKey: true,
    backendUrl: 'https://backend.example.com',
    revokeAuthTriggerSet: false,
    daysUntilAuthRevoke: 60,
    slidesFetchBatchSize: 20,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-123',
    loadError: 'apiKey: REDACTED',
};

const validMaskedBackendConfigWithoutLoadError = {
    backendAssessorBatchSize: 30,
    apiKey: '****cdef',
    hasApiKey: true,
    backendUrl: 'https://backend.example.com',
    revokeAuthTriggerSet: false,
    daysUntilAuthRevoke: 60,
    slidesFetchBatchSize: 20,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 15_000,
    jsonDbLogLevel: 'INFO',
    jsonDbBackupOnInitialise: true,
    jsonDbRootFolderId: 'folder-123',
};

const partialLoadBackendConfig = {
    ...validMaskedBackendConfig,
    backendUrl: '',
};

const validBackendConfigPatch = {
    backendAssessorBatchSize: 25,
    backendUrl: 'https://backend.example.com',
    daysUntilAuthRevoke: 45,
    slidesFetchBatchSize: 10,
    jsonDbMasterIndexKey: 'master-index',
    jsonDbLockTimeoutMs: 20_000,
    jsonDbLogLevel: 'DEBUG',
    jsonDbBackupOnInitialise: false,
    jsonDbRootFolderId: 'folder-456',
};

const validBackendConfigReplacementPatch = {
    ...validBackendConfigPatch,
    apiKey: 'replacement-key-123',
};

const malformedReadResponse = {
    ...validMaskedBackendConfig,
    hasApiKey: 'true',
};

const invalidBackendUrlReadResponse = {
    ...validMaskedBackendConfig,
    backendUrl: 'not-a-url',
};

const unmaskedApiKeyReadResponse = {
    ...validMaskedBackendConfig,
    apiKey: 'sk-live-abcdef123456',
};

const invalidMaskedApiKeyReadResponse = {
    ...validMaskedBackendConfig,
    apiKey: '****abc',
};

const malformedWriteResponse = {
    success: false,
};

const validWriteFailureResult = {
    success: false,
    error: 'Configuration save failed.',
};

const validWriteSuccessResult = {
    success: true,
};

const invalidWritePatch = {
    backendAssessorBatchSize: '25',
};

const blankApiKeyWritePatch = {
    ...validBackendConfigPatch,
    apiKey: '',
};

const writePatchWithReadOnlyFields = {
    ...validBackendConfigPatch,
    revokeAuthTriggerSet: true,
    hasApiKey: true,
    loadError: 'should not be writable',
};

const invalidBackendUrlWritePatch = {
    ...validBackendConfigPatch,
    backendUrl: 'not-a-url',
};

/**
 * Loads the backend-configuration service module under test.
 *
 * @returns {Promise<unknown>} The imported backend-configuration service module.
 */
async function loadBackendConfigurationService() {
    return import('./backendConfigurationService');
}

describe('backendConfigurationService', () => {
    afterEach(() => {
        callApiMock.mockReset();
        vi.restoreAllMocks();
        vi.resetModules();
    });

    it('getBackendConfig() calls callApi with getBackendConfig', async () => {
        callApiMock.mockResolvedValueOnce(validMaskedBackendConfig);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await getBackendConfig();

        expect(callApiMock).toHaveBeenCalledWith('getBackendConfig');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('setBackendConfig() calls callApi with setBackendConfig and the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce({ success: true });
        const { setBackendConfig } = await loadBackendConfigurationService();

        await setBackendConfig(validBackendConfigPatch);

        expect(callApiMock).toHaveBeenCalledWith('setBackendConfig', validBackendConfigPatch);
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('setBackendConfig() accepts a replacement API key in the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce({ success: true });
        const { setBackendConfig } = await loadBackendConfigurationService();

        await setBackendConfig(validBackendConfigReplacementPatch);

        expect(callApiMock).toHaveBeenCalledWith(
            'setBackendConfig',
            validBackendConfigReplacementPatch
        );
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('parses a valid masked configuration payload, including optional loadError, before returning it', async () => {
        callApiMock.mockResolvedValueOnce(validMaskedBackendConfig);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await expect(getBackendConfig()).resolves.toEqual(validMaskedBackendConfig);
    });

    it('parses a valid masked configuration payload when loadError is omitted', async () => {
        callApiMock.mockResolvedValueOnce(validMaskedBackendConfigWithoutLoadError);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await expect(getBackendConfig()).resolves.toEqual(
            validMaskedBackendConfigWithoutLoadError
        );
    });

    it('parses a partial-load payload with a blank backendUrl when loadError is present', async () => {
        callApiMock.mockResolvedValueOnce(partialLoadBackendConfig);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await expect(getBackendConfig()).resolves.toEqual(partialLoadBackendConfig);
    });

    it('rejects malformed read responses through the dedicated configuration schema', async () => {
        callApiMock.mockResolvedValueOnce(malformedReadResponse);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await expect(getBackendConfig()).rejects.toBeInstanceOf(ZodError);
    });

    it('rejects backend configuration payloads with a malformed backendUrl', async () => {
        callApiMock.mockResolvedValueOnce(invalidBackendUrlReadResponse);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await expect(getBackendConfig()).rejects.toBeInstanceOf(ZodError);
    });

    it('rejects backend configuration payloads that expose an unmasked apiKey value', async () => {
        callApiMock.mockResolvedValueOnce(unmaskedApiKeyReadResponse);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await expect(getBackendConfig()).rejects.toBeInstanceOf(ZodError);
    });

    it('rejects backend configuration payloads whose masked apiKey does not match the backend mask contract', async () => {
        callApiMock.mockResolvedValueOnce(invalidMaskedApiKeyReadResponse);
        const { getBackendConfig } = await loadBackendConfigurationService();

        await expect(getBackendConfig()).rejects.toBeInstanceOf(ZodError);
    });

    it('rejects malformed write responses through the dedicated configuration schema', async () => {
        callApiMock.mockResolvedValueOnce(malformedWriteResponse);
        const { setBackendConfig } = await loadBackendConfigurationService();

        await expect(setBackendConfig(validBackendConfigPatch)).rejects.toBeInstanceOf(ZodError);
    });

    it('accepts the valid write failure result contract before returning it', async () => {
        callApiMock.mockResolvedValueOnce(validWriteFailureResult);
        const { setBackendConfig } = await loadBackendConfigurationService();

        await expect(setBackendConfig(validBackendConfigPatch)).resolves.toEqual(
            validWriteFailureResult
        );
    });

    it('accepts the valid success write-result contract before returning it', async () => {
        callApiMock.mockResolvedValueOnce(validWriteSuccessResult);
        const { setBackendConfig } = await loadBackendConfigurationService();

        await expect(setBackendConfig(validBackendConfigPatch)).resolves.toEqual(
            validWriteSuccessResult
        );
    });

    it('rejects invalid write payload shapes before transport', async () => {
        const { setBackendConfig } = await loadBackendConfigurationService();

        await expect(
            setBackendConfig(
                invalidWritePatch as unknown as Parameters<typeof setBackendConfig>[0]
            )
        ).rejects.toBeInstanceOf(ZodError);
        expect(callApiMock).not.toHaveBeenCalled();
    });

    it('rejects blank API key values before transport', async () => {
        const { setBackendConfig } = await loadBackendConfigurationService();

        await expect(setBackendConfig(blankApiKeyWritePatch)).rejects.toBeInstanceOf(ZodError);
        expect(callApiMock).not.toHaveBeenCalled();
    });

    it('rejects write payloads with a malformed backendUrl before transport', async () => {
        const { setBackendConfig } = await loadBackendConfigurationService();

        await expect(setBackendConfig(invalidBackendUrlWritePatch)).rejects.toBeInstanceOf(
            ZodError
        );
        expect(callApiMock).not.toHaveBeenCalled();
    });

    it('rejects read-only write fields before transport', async () => {
        const { setBackendConfig } = await loadBackendConfigurationService();

        await expect(
            setBackendConfig(
                writePatchWithReadOnlyFields as Parameters<typeof setBackendConfig>[0]
            )
        ).rejects.toBeInstanceOf(ZodError);
        expect(callApiMock).not.toHaveBeenCalled();
    });
});
