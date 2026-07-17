const minimumDriveFolderIdLength = 10;
const maskedApiKeyPrefix = '****';
const maskedApiKeyWithSuffixLength = 8;
// API key contract: an alphanumeric prefix followed by an underscore and exactly 32 base64url
// characters. The backend mirrors this exact pattern in 03_validators.js; keep both in sync so
// validation does not drift between runtimes.
const backendApiKeyTokenRegex = /^[A-Za-z0-9]+_[A-Za-z0-9_-]{32}$/u;
const driveFolderIdRegex = /^[\dA-Za-z_-]+$/u;

export const backendApiKeyValidationMessage =
  'API Key must be an alphanumeric prefix followed by an underscore and exactly 32 base64url characters (A-Z, a-z, 0-9, hyphen, underscore).';

/**
 * Determines whether a value matches the backend API key token contract.
 *
 * @param {string} value The candidate API key.
 * @returns {boolean} True when the value is a valid token.
 */
export function isBackendApiKeyToken(value: string): boolean {
  return value !== '' && backendApiKeyTokenRegex.test(value);
}

/**
 * Determines whether a masked API key value matches the read contract.
 *
 * @param {string} value The candidate masked API key.
 * @returns {boolean} True when the value is an accepted mask.
 */
export function isMaskedBackendApiKeyValue(value: string): boolean {
  return (
    value === '' ||
    value === maskedApiKeyPrefix ||
    (value.startsWith(maskedApiKeyPrefix) && value.length === maskedApiKeyWithSuffixLength)
  );
}

/**
 * Determines whether a string matches the backend Drive folder identifier contract.
 *
 * @param {string} value The candidate folder identifier.
 * @returns {boolean} True when the identifier shape is valid.
 */
export function isDriveFolderId(value: string): boolean {
  return value.length >= minimumDriveFolderIdLength && driveFolderIdRegex.test(value);
}
