const asciiDigitZeroCodePoint = 48;
const asciiDigitNineCodePoint = 57;
const asciiUppercaseLetterACodePoint = 65;
const asciiUppercaseLetterZCodePoint = 90;
const asciiLowercaseLetterACodePoint = 97;
const asciiLowercaseLetterZCodePoint = 122;
const minimumDriveFolderIdLength = 10;
const maskedApiKeyPrefix = '****';
const maskedApiKeyWithSuffixLength = 8;

export const backendApiKeyValidationMessage =
  'API Key must be a valid string of alphanumeric characters and hyphens, without leading/trailing hyphens or consecutive hyphens.';

/**
 * Determines whether a character is ASCII alphanumeric.
 *
 * @param {string} character The character to inspect.
 * @returns {boolean} True when the character is alphanumeric.
 */
export function isAlphaNumericCharacter(character: string): boolean {
  const characterCode = character.codePointAt(0);

  return (
    characterCode !== undefined &&
    ((characterCode >= asciiDigitZeroCodePoint && characterCode <= asciiDigitNineCodePoint) ||
      (characterCode >= asciiUppercaseLetterACodePoint &&
        characterCode <= asciiUppercaseLetterZCodePoint) ||
      (characterCode >= asciiLowercaseLetterACodePoint &&
        characterCode <= asciiLowercaseLetterZCodePoint))
  );
}

/**
 * Determines whether a value matches the backend API key token contract.
 *
 * @param {string} value The candidate API key.
 * @returns {boolean} True when the value is a valid token.
 */
export function isBackendApiKeyToken(value: string): boolean {
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
  if (value.length < minimumDriveFolderIdLength) {
    return false;
  }

  for (const character of value) {
    if (!isAlphaNumericCharacter(character) && character !== '_' && character !== '-') {
      return false;
    }
  }

  return true;
}
