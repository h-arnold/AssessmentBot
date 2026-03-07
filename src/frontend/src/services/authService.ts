import { callApi } from './apiService';

const GET_AUTHORISATION_STATUS_METHOD = 'getAuthorisationStatus';

/**
 * Calls the backend API handler transport and returns current authorisation status.
 */
export async function getAuthorisationStatus(): Promise<boolean> {
    return callApi<boolean>(GET_AUTHORISATION_STATUS_METHOD);
}
