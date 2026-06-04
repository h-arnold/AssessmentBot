/**
 * Shared test helpers for apiService.spec.
 */

export type CallApi = <TResponse>(method: string, parameters?: unknown) => Promise<TResponse>;

export const SECOND_ATTEMPT_CALL_COUNT = 2;
export const MAX_ATTEMPTS = 4;

type GoogleScript = {
  script?: {
    run?: unknown;
  };
};

/**
 * Sets a mock `google` runtime object for tests.
 *
 * @param {GoogleScript} value - The mock Google runtime to install.
 */
export function setGoogle(value: GoogleScript): void {
  (globalThis as unknown as Record<string, unknown>).google = value;
}

/**
 * Removes the mock `google` runtime object after each test.
 *
 * @returns {void} Nothing.
 */
export function clearGoogle(): void {
  delete (globalThis as Record<string, unknown>).google;
}

/**
 * Loads a fresh `callApi` export from the module under test.
 *
 * @returns {Promise<CallApi>} The `callApi` function from the module under test.
 */
export async function loadCallApi(): Promise<CallApi> {
  const apiServiceModule = (await import('../apiService')) as {
    callApi: CallApi;
  };

  return apiServiceModule.callApi;
}
