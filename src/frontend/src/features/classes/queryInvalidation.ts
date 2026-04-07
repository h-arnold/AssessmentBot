import type { QueryClient } from '@tanstack/react-query';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import {
  refreshErrorMetadataSchema,
  requiredClassPartialsRefreshFailureOutcomeSchema,
  requiredClassPartialsRefreshSuccessOutcomeSchema,
  type RefreshErrorMetadata,
  type RequiredClassPartialsRefreshFailureOutcomeBase,
  type RequiredClassPartialsRefreshSuccessOutcomeBase,
} from './queryInvalidation.zod';

const refreshRateLimitedMessage = 'The classes are busy updating right now. Please try again shortly.';
const refreshInvalidRequestMessage = 'Unable to refresh the classes right now. Please review the selection and try again.';
const refreshGenericFailureMessage = 'The classes could not be refreshed right now. Please reload the page and try again.';

/**
 * Maps required-refresh failures to user-safe copy.
 *
 * @param {RefreshErrorMetadata} refreshError Refresh failure metadata.
 * @returns {string} User-safe refresh guidance.
 */
export function mapRequiredClassPartialsRefreshFailureToUserMessage(
  refreshError: RefreshErrorMetadata
): string {
  if (refreshError.code === 'RATE_LIMITED') {
    return refreshRateLimitedMessage;
  }

  if (refreshError.code === 'INVALID_REQUEST') {
    return refreshInvalidRequestMessage;
  }

  return refreshGenericFailureMessage;
}

export type RequiredClassPartialsRefreshOutcome<TResult> =
  | Readonly<{
      mutationResult: TResult;
    }> &
      RequiredClassPartialsRefreshSuccessOutcomeBase
  | Readonly<{
      mutationResult: TResult;
    }> &
      RequiredClassPartialsRefreshFailureOutcomeBase;

/**
 * Runs a successful mutation followed by a required active class-partials refresh.
 *
 * Mutation failures are rethrown immediately. Refresh failures are returned as a composite
 * outcome so callers can surface mutation success alongside refresh diagnostics.
 *
 * @template TResult
 * @param {Readonly<{
 *   mutate: () => Promise<TResult>;
 *   queryClient: QueryClient;
 * }>} options Mutation and query-client dependencies.
 * @returns {Promise<RequiredClassPartialsRefreshOutcome<TResult>>} Composite mutation/refresh outcome.
 */
export async function runMutationWithRequiredClassPartialsRefresh<TResult>(options: Readonly<{
  mutate: () => Promise<TResult>;
  queryClient: QueryClient;
}>): Promise<RequiredClassPartialsRefreshOutcome<TResult>> {
  const mutationResult = await options.mutate();

  try {
    await options.queryClient.refetchQueries({
      exact: true,
      queryKey: queryKeys.classPartials(),
      type: 'active',
    }, {
      throwOnError: true,
    });

    return buildRequiredClassPartialsRefreshSuccessOutcome(mutationResult);
  } catch (error: unknown) {
    return buildRequiredClassPartialsRefreshFailureOutcome(
      mutationResult,
      extractRefreshErrorMetadata(error)
    );
  }
}

/**
 * Builds the success branch of the required class-partials refresh contract.
 *
 * @template TResult
 * @param {TResult} mutationResult Successful mutation result.
 * @returns {RequiredClassPartialsRefreshOutcome<TResult>} Parsed success outcome.
 */
function buildRequiredClassPartialsRefreshSuccessOutcome<TResult>(
  mutationResult: TResult
): RequiredClassPartialsRefreshOutcome<TResult> {
  const outcome = requiredClassPartialsRefreshSuccessOutcomeSchema.parse({
    mutationStatus: 'success',
    refreshStatus: 'success',
  });

  return {
    ...outcome,
    mutationResult,
  };
}

/**
 * Builds the refresh-failure branch of the required class-partials refresh contract.
 *
 * @template TResult
 * @param {TResult} mutationResult Successful mutation result.
 * @param {RefreshErrorMetadata} refreshError Parsed refresh error metadata.
 * @returns {RequiredClassPartialsRefreshOutcome<TResult>} Parsed refresh-failure outcome.
 */
function buildRequiredClassPartialsRefreshFailureOutcome<TResult>(
  mutationResult: TResult,
  refreshError: RefreshErrorMetadata
): RequiredClassPartialsRefreshOutcome<TResult> {
  const outcome = requiredClassPartialsRefreshFailureOutcomeSchema.parse({
    mutationStatus: 'success',
    refreshError,
    refreshStatus: 'failed',
  });

  return {
    ...outcome,
    mutationResult,
    refreshError: outcome.refreshError,
  };
}

/**
 * Extracts transport-safe refresh metadata from a refresh failure.
 *
 * @param {unknown} error Refresh failure to inspect.
 * @returns {RefreshErrorMetadata} Parsed refresh error metadata.
 */
function extractRefreshErrorMetadata(error: unknown): RefreshErrorMetadata {
  if (isApiTransportErrorLike(error)) {
    return refreshErrorMetadataSchema.parse({
      code: error.code,
      requestId: error.requestId,
      retriable: error.retriable,
    });
  }

  return refreshErrorMetadataSchema.parse({});
}

/**
 * Detects transport-error metadata even when module resets produce a different class instance.
 *
 * @param {unknown} error Refresh failure to inspect.
 * @returns {boolean} True when the error carries API transport metadata.
 */
function isApiTransportErrorLike(
  error: unknown
): error is Pick<ApiTransportError, 'code' | 'requestId' | 'retriable'> {
  if (error instanceof ApiTransportError) {
    return true;
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as Partial<Pick<ApiTransportError, 'code' | 'requestId' | 'retriable'>>;

  return (
    typeof candidate.code === 'string'
    && typeof candidate.requestId === 'string'
    && (typeof candidate.retriable === 'boolean' || candidate.retriable === undefined)
  );
}
