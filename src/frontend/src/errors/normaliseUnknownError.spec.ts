import { describe, expect, it } from 'vitest';
import { normaliseUnknownError } from './normaliseUnknownError';

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

