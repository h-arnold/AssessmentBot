import { callApi } from './apiService';
import type {
    BackendConfig,
    BackendConfigWriteInput,
    BackendConfigWriteResult,
} from './backendConfiguration.zod';
import {
    BackendConfigSchema,
    BackendConfigWriteInputSchema,
    BackendConfigWriteResultSchema,
} from './backendConfiguration.zod';

/**
 * Retrieves the backend configuration payload through the shared API transport.
 *
 * @returns {Promise<BackendConfig>} The parsed backend configuration payload.
 */
export async function getBackendConfig(): Promise<BackendConfig> {
    return BackendConfigSchema.parse(await callApi('getBackendConfig'));
}

/**
 * Sends a backend configuration patch through the shared API transport.
 *
 * @param {BackendConfigWriteInput} input Backend configuration patch payload.
 * @returns {Promise<BackendConfigWriteResult>} The parsed backend save result.
 */
export async function setBackendConfig(
    input: BackendConfigWriteInput
): Promise<BackendConfigWriteResult> {
    const parsedInput = BackendConfigWriteInputSchema.parse(input);
    return BackendConfigWriteResultSchema.parse(
        await callApi('setBackendConfig', parsedInput)
    );
}