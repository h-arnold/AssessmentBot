import { describe, expect, it } from 'vitest';
import {
  backendApiKeyValidationMessage,
  isBackendApiKeyToken,
  isMaskedBackendApiKeyValue,
  isDriveFolderId,
} from './backendConfigurationValidation';

const validApiKey = 'abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1';

describe('isBackendApiKeyToken', () => {
  it('accepts a key with an alphanumeric prefix, underscore, and 32 base64url characters', () => {
    expect(isBackendApiKeyToken(validApiKey)).toBe(true);
  });

  it('accepts a custom alphanumeric prefix', () => {
    expect(isBackendApiKeyToken('custom_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1')).toBe(true);
  });

  it('accepts base64url characters including multiple hyphens and underscores in the token', () => {
    expect(isBackendApiKeyToken('abt_a-b_c-d_e-f_g-h_i-j_k-l_m-n_o_pq')).toBe(true);
  });

  it('rejects a blank value', () => {
    expect(isBackendApiKeyToken('')).toBe(false);
  });

  it('rejects a token shorter than 32 characters', () => {
    expect(isBackendApiKeyToken('abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF')).toBe(false);
  });

  it('rejects a token longer than 32 characters', () => {
    expect(isBackendApiKeyToken('abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1extra')).toBe(false);
  });

  it('rejects a key without an underscore prefix separator', () => {
    expect(isBackendApiKeyToken('abt7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1')).toBe(false);
  });

  it('rejects a key with a non-alphanumeric prefix', () => {
    expect(isBackendApiKeyToken('-abt_7pC98PCoGJOcjN-qz6rNlSzKkgySJF-1')).toBe(false);
  });

  it('rejects a key containing invalid characters in the token', () => {
    expect(isBackendApiKeyToken('abt_7pC98PCoGJOcjN+qz6rNlSzKkgySJF-1')).toBe(false);
  });

  it('accepts a key with surrounding whitespace after trimming', () => {
    expect(isBackendApiKeyToken('  ' + validApiKey + '  ')).toBe(true);
  });
});

describe('backendApiKeyValidationMessage', () => {
  it('describes the expected prefix and 32 base64url character contract', () => {
    expect(backendApiKeyValidationMessage).toMatch(/32 base64url characters/);
  });
});

describe('isMaskedBackendApiKeyValue', () => {
  it('accepts an empty value', () => {
    expect(isMaskedBackendApiKeyValue('')).toBe(true);
  });

  it('accepts the bare mask prefix', () => {
    expect(isMaskedBackendApiKeyValue('****')).toBe(true);
  });

  it('accepts a masked value with the visible suffix', () => {
    expect(isMaskedBackendApiKeyValue('****cdef')).toBe(true);
  });

  it('rejects an unmasked raw key', () => {
    expect(isMaskedBackendApiKeyValue(validApiKey)).toBe(false);
  });

  it('rejects a masked value shorter than the expected suffix length', () => {
    expect(isMaskedBackendApiKeyValue('****ab')).toBe(false);
  });
});

describe('isDriveFolderId', () => {
  it('accepts a valid Drive folder ID (10+ alphanumeric chars)', () => {
    expect(isDriveFolderId('folder12345')).toBe(true);
  });

  it('rejects a value shorter than the minimum length', () => {
    expect(isDriveFolderId('short')).toBe(false);
  });

  it('rejects a value containing illegal characters', () => {
    expect(isDriveFolderId('bad id!')).toBe(false);
  });
});
