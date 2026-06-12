const minimumDriveFolderIdLength = 10;
const maskedApiKeyPrefix = '****';
const maskedApiKeyWithSuffixLength = 8;
const backendApiKeyTokenCharacterRegex = /^[\dA-Za-z-]+$/u;
const driveFolderIdRegex = /^[\dA-Za-z_-]+$/u;
const finalCharacterOffset = -1;

export const backendApiKeyValidationMessage =
  'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.';

/**
 * Determines whether a value matches the backend API key token contract.
 *
 * @param {string} value The candidate API key.
 * @returns {boolean} True when the value is a valid token.
 */
export function isBackendApiKeyToken(value: string): boolean {
  return (
    value !== '' &&
    value[0] !== '-' &&
    value.at(finalCharacterOffset) !== '-' &&
    !value.includes('--') &&
    backendApiKeyTokenCharacterRegex.test(value)
  );
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
