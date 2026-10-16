import { describe, expect, it } from 'vitest';

function loadErrorType() {
  try {
    return require('#backend/Utils/ErrorTypes/ABClassMetadataValidationError.js');
  } catch {
    return null;
  }
}

describe('ABClassMetadataValidationError', () => {
  it('is available through the backend source path', () => {
    expect(loadErrorType()).not.toBeNull();
  });

  it('carries an actionable field path and defaults to non-request provenance', () => {
    const ErrorType = loadErrorType()?.ABClassMetadataValidationError;
    expect(typeof ErrorType).toBe('function');
    if (!ErrorType) return;

    const error = new ErrorType('Invalid score', 'metadata.classAverages.overall');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ABClassMetadataValidationError');
    expect(error.fieldPath).toBe('metadata.classAverages.overall');
    expect(error.inputSource).not.toBe('request');
    expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
  });
});
