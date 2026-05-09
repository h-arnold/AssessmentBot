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
export type ErrorCode = keyof typeof errorCodes;

/**
 * Message map for error codes to avoid switch complexity.
 * Groups similar error codes to share messages.
 */
const errorCodeToMessageMap = new Map<ErrorCode, string>([
  ['RATE_LIMITED', 'Too many requests. Please wait a moment and try again.'],
  ['INVALID_REQUEST', 'The request contains invalid data. Please check your inputs and try again.'],
  ['UNKNOWN_METHOD', 'An internal error occurred. Please try again or contact support if the issue persists.'],
  ['INTERNAL_ERROR', 'An internal error occurred. Please try again or contact support if the issue persists.'],
  ['VALIDATION_ERROR', 'Validation failed. Please review your inputs and try again.'],
  ['DUPLICATE_DETECTED', 'A definition with these details already exists. Please use a different combination.'],
  ['NETWORK_ERROR', 'Network error. Please check your connection and try again.'],
  ['UNAUTHORISED', 'You are not authorised to perform this action. Please check your permissions.'],
  ['NOT_FOUND', 'The requested resource was not found. Please refresh and try again.'],
  ['UNTRUSTED_DATA', 'Required reference data could not be trusted or loaded.'],
]);

/**
 * Returns a user-safe error message for a given error code.
 *
 * @param {ErrorCode} code - The error code to map.
 * @returns {string} User-safe error message.
 */
export function mapErrorCodeToUserMessage(code: ErrorCode): string {
  const message = errorCodeToMessageMap.get(code);
  if (message === undefined) {
    throw new Error(`Missing error mapping for code: ${code}`);
  }
  return message;
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
    hasCodeProperty(error) &&
    hasRequestIdProperty(error) &&
    typeof error.requestId === 'string'
  );
}

/**
 * Type guard for errors with a code property.
 *
 * @param {unknown} error - The value to check.
 * @returns {error is Error & { code: unknown }} True if error is an Error with a code property.
 */
function hasCodeProperty(error: unknown): error is Error & { code: unknown } {
  return error instanceof Error && 'code' in error;
}

/**
 * Type guard for errors with a requestId property.
 *
 * @param {unknown} error - The value to check.
 * @returns {error is Error & { requestId: unknown }} True if error is an Error with a requestId property.
 */
function hasRequestIdProperty(error: unknown): error is Error & { requestId: unknown } {
  return error instanceof Error && 'requestId' in error;
}

/**
 * Validates that a string is a valid ErrorCode.
 *
 * @param {string} code - The code to validate.
 * @returns {code is ErrorCode} True if the code is a valid ErrorCode.
 */
function isErrorCode(code: string): code is ErrorCode {
  return Object.hasOwn(errorCodes, code);
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
    return isErrorCode(error.code) ? error.code : null;
  }

  if (hasCodeProperty(error) && typeof error.code === 'string' && isErrorCode(error.code)) {
    return error.code;
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
