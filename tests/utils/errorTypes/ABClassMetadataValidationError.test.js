import { describe, expect, it } from 'vitest';
const {
  ABClassMetadataValidationError,
} = require('#backend/Utils/ErrorTypes/ABClassMetadataValidationError.js');

describe('ABClassMetadataValidationError', () => {
  it('is available through the backend source path', () => {
    expect(ABClassMetadataValidationError).toBeTypeOf('function');
  });

  it('carries an actionable field path and defaults to non-request provenance', () => {
    const ErrorType = ABClassMetadataValidationError;
    expect(typeof ErrorType).toBe('function');

    const error = new ErrorType('Invalid score', 'metadata.classAverages.overall');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ABClassMetadataValidationError');
    expect(error.fieldPath).toBe('metadata.classAverages.overall');
    expect(error.inputSource).not.toBe('request');
    expect(error).not.toBeInstanceOf(globalThis.ApiValidationError);
  });
});
