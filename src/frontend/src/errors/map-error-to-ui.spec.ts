import { describe, expect, it } from 'vitest';
import { ApiTransportError } from './apiTransportError';
import {
  errorCodes,
  extractErrorCode,
  extractRequestId,
  mapErrorCodeToUserMessage,
  mapErrorToUserMessage,
} from './map-error-to-ui';

describe('mapErrorCodeToUserMessage', () => {
  it.each([
    [errorCodes.RATE_LIMITED, 'Too many requests. Please wait a moment and try again.'],
    [
      errorCodes.INVALID_REQUEST,
      'The request contains invalid data. Please check your inputs and try again.',
    ],
    [
      errorCodes.UNKNOWN_METHOD,
      'An internal error occurred. Please try again or contact support if the issue persists.',
    ],
    [
      errorCodes.INTERNAL_ERROR,
      'An internal error occurred. Please try again or contact support if the issue persists.',
    ],
    [errorCodes.VALIDATION_ERROR, 'Validation failed. Please review your inputs and try again.'],
    [
      errorCodes.DUPLICATE_DETECTED,
      'A definition with these details already exists. Please use a different combination.',
    ],
    [errorCodes.NETWORK_ERROR, 'Network error. Please check your connection and try again.'],
    [
      errorCodes.UNAUTHORISED,
      'You are not authorised to perform this action. Please check your permissions.',
    ],
    [errorCodes.NOT_FOUND, 'The requested resource was not found. Please refresh and try again.'],
    [errorCodes.UNTRUSTED_DATA, 'Required reference data could not be trusted or loaded.'],
    [errorCodes.IN_USE, 'This item is currently in use and cannot be deleted.'],
    [
      errorCodes.DEFINITION_STALE,
      'This assessment definition is out of date. Please review the linked documents and try again.',
    ],
  ] as const)('maps %s to a stable user-safe message', (code, expectedMessage) => {
    expect(mapErrorCodeToUserMessage(code)).toBe(expectedMessage);
  });

  it('throws when asked to map an unmapped code', () => {
    expect(() => mapErrorCodeToUserMessage('UNMAPPED_CODE' as keyof typeof errorCodes)).toThrow(
      'Missing error mapping for code: UNMAPPED_CODE'
    );
  });

  it('maps FORBIDDEN to the access-denied message', () => {
    expect(mapErrorCodeToUserMessage('FORBIDDEN' as never)).toBe(
      'You do not have permission to access this application. Please contact your administrator.'
    );
  });

  it('declares IN_USE and DEFINITION_STALE as recognised transport error codes', () => {
    expect(errorCodes.IN_USE).toBe('IN_USE');
    expect(errorCodes.DEFINITION_STALE).toBe('DEFINITION_STALE');
  });

  it('maps IN_USE and DEFINITION_STALE to non-generic, distinct user-safe messages', () => {
    const inUseMessage = mapErrorCodeToUserMessage(errorCodes.IN_USE);
    const staleDefinitionMessage = mapErrorCodeToUserMessage(errorCodes.DEFINITION_STALE);

    expect(inUseMessage).not.toBe('An error occurred. Please try again.');
    expect(staleDefinitionMessage).not.toBe('An error occurred. Please try again.');
    expect(inUseMessage).not.toBe(staleDefinitionMessage);
  });
});

describe('extractErrorCode', () => {
  it('returns a valid code from an ApiTransportError instance', () => {
    const error = new ApiTransportError({
      requestId: 'req-123',
      error: {
        code: errorCodes.RATE_LIMITED,
        message: 'Too many requests.',
      },
    });

    expect(extractErrorCode(error)).toBe(errorCodes.RATE_LIMITED);
  });

  it('returns FORBIDDEN from an ApiTransportError instance', () => {
    const error = new ApiTransportError({
      requestId: 'req-forbidden',
      error: { code: 'FORBIDDEN', message: 'Access denied.', retriable: false },
    });

    expect(extractErrorCode(error)).toBe('FORBIDDEN');
  });

  it('returns a valid code from a plain Error with a code property', () => {
    const error = new Error('Validation failed.') as Error & { code: string };
    error.code = errorCodes.VALIDATION_ERROR;

    expect(extractErrorCode(error)).toBe(errorCodes.VALIDATION_ERROR);
  });

  it('returns null for an Error with an unknown code', () => {
    const error = new Error('Unknown code.') as Error & { code: string };
    error.code = 'SOME_UNKNOWN_CODE';

    expect(extractErrorCode(error)).toBeNull();
  });

  it.each([null, undefined, 'nope', 'forty-two', { code: errorCodes.RATE_LIMITED }])(
    'returns null for non-Error input %s',
    (value) => {
      expect(extractErrorCode(value)).toBeNull();
    }
  );
});

describe('extractRequestId', () => {
  it('returns requestId from an ApiTransportError instance', () => {
    const error = new ApiTransportError({
      requestId: 'req-456',
      error: {
        code: errorCodes.INTERNAL_ERROR,
        message: 'Internal error.',
      },
    });

    expect(extractRequestId(error)).toBe('req-456');
  });

  it.each([
    new Error('Missing requestId.'),
    Object.assign(new Error('Missing code.'), { requestId: 'req-789' }),
    null,
    undefined,
    { requestId: 'req-000' },
  ])('returns null otherwise for %s', (value) => {
    expect(extractRequestId(value)).toBeNull();
  });
});

describe('mapErrorToUserMessage', () => {
  it('returns the mapped message when the code is known', () => {
    const error = new ApiTransportError({
      requestId: 'req-999',
      error: {
        code: errorCodes.NOT_FOUND,
        message: 'Resource missing.',
      },
    });

    expect(mapErrorToUserMessage(error)).toBe(
      'The requested resource was not found. Please refresh and try again.'
    );
  });

  it('returns the generic fallback for an Error without a recognised code', () => {
    const error = new Error('Leaked implementation detail.');

    expect(mapErrorToUserMessage(error)).toBe('An error occurred. Please try again.');
  });

  it('returns the generic fallback for a non-Error unknown value', () => {
    expect(mapErrorToUserMessage({ reason: 'unexpected' })).toBe(
      'An error occurred. Please try again.'
    );
  });
});
