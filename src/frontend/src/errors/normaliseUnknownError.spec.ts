import { describe, expect, it } from 'vitest';
import { normaliseUnknownError, toUserFacingErrorMessage } from './normaliseUnknownError';

describe('normaliseUnknownError', () => {
  it('returns message and stack for Error instances', () => {
    const error = new Error('Something failed.');
    const normalised = normaliseUnknownError(error);

    expect(normalised.errorMessage).toBe('Something failed.');
    expect(normalised.stack).toBe(error.stack);
  });

  it('returns stringified value for non-Error values', () => {
    const normalised = normaliseUnknownError('Failure string');

    expect(normalised).toEqual({
      errorMessage: 'Failure string',
    });
  });
});

describe('toUserFacingErrorMessage', () => {
  it('returns Error.message for Error instances', () => {
    expect(toUserFacingErrorMessage(new Error('User-facing message'))).toBe('User-facing message');
  });

  it('returns stringified fallback for unknown thrown values', () => {
    expect(toUserFacingErrorMessage({ detail: 42 })).toBe('[object Object]');
  });
});
