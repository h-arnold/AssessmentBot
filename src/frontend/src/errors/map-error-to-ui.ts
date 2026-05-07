import type { ApiTransportError } from './apiTransportError';

/**
 * Error code constants for frontend error mapping.
 */
export const errorCodes = {
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNKNOWN_METHOD: 'UNKNOWN_METHOD',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_DETECTED: 'DUPLICATE_DETECTED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORISED: 'UNAUTHORISED',
  NOT_FOUND: 'NOT_FOUND',
  UNTRUSTED_DATA: 'UNTRUSTED_DATA',
} as const;

/**
 * Error code type for type safety.
 */
export type ErrorCode = keyof typeof errorCodes | string;

/**
 * Message map for error codes to avoid switch complexity.
 * Groups similar error codes to share messages.
 */
const errorCodeToMessageMap: Record<ErrorCode, string> = {
  [errorCodes.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [errorCodes.INVALID_REQUEST]: 'The request contains invalid data. Please check your inputs and try again.',
  [errorCodes.UNKNOWN_METHOD]: 'An internal error occurred. Please try again or contact support if the issue persists.',
  [errorCodes.INTERNAL_ERROR]: 'An internal error occurred. Please try again or contact support if the issue persists.',
  [errorCodes.VALIDATION_ERROR]: 'Validation failed. Please review your inputs and try again.',
  [errorCodes.DUPLICATE_DETECTED]: 'A definition with these details already exists. Please use a different combination.',
  [errorCodes.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [errorCodes.UNAUTHORISED]: 'You are not authorised to perform this action. Please check your permissions.',
  [errorCodes.NOT_FOUND]: 'The requested resource was not found. Please refresh and try again.',
  [errorCodes.UNTRUSTED_DATA]: 'Required reference data could not be trusted or loaded.',
} as const;

/**
 * Returns a user-safe error message for a given error code.
 *
 * @param {ErrorCode} code - The error code to map.
 * @returns {string} User-safe error message.
 */
export function mapErrorCodeToUserMessage(code: ErrorCode): string {
  const message = errorCodeToMessageMap[code as keyof typeof errorCodeToMessageMap];
  return message ?? 'An error occurred. Please try again.';
}

/**
 * Checks if a value is an ApiTransportError (type guard for runtime checks).
 *
 * @param {unknown} error - The value to check.
 * @returns {error is ApiTransportError} True if the value is an ApiTransportError.
 */
function isApiTransportError(error: unknown): error is ApiTransportError {
  return (
    error instanceof Error &&
    'code' in error &&
    'requestId' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Extracts error code from an error object.
 * Handles ApiTransportError, plain Error with code property, or unknown errors.
 *
 * @param {unknown} error - The error to extract code from.
 * @returns {ErrorCode | null} The extracted error code or null if not available.
 */
export function extractErrorCode(error: unknown): ErrorCode | null {
  if (isApiTransportError(error)) {
    return error.code as ErrorCode;
  }

  if (error instanceof Error && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') {
      return code as ErrorCode;
    }
  }

  return null;
}

/**
 * Extracts requestId from an error object.
 *
 * @param {unknown} error - The error to extract requestId from.
 * @returns {string | null} The extracted requestId or null if not available.
 */
export function extractRequestId(error: unknown): string | null {
  if (isApiTransportError(error)) {
    return error.requestId;
  }

  return null;
}

/**
 * Maps an error to a user-safe message.
 * Extracts error code and maps it to appropriate user-facing text.
 *
 * @param {unknown} error - The error to map.
 * @returns {string} User-safe error message.
 */
export function mapErrorToUserMessage(error: unknown): string {
  const code = extractErrorCode(error);
  if (code) {
    return mapErrorCodeToUserMessage(code);
  }

  // Fallback for errors without a code
  if (error instanceof Error) {
    // Don't expose internal error messages directly
    // Use a generic message to avoid leaking implementation details
    return 'An error occurred. Please try again.';
  }

  return 'An error occurred. Please try again.';
}
