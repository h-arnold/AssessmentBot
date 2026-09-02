/**
 * Pure helper functions for {@link useClassPageData}.
 *
 * Extracted from `useClassPageData.ts` to keep that file under the 500-line
 * threshold.  These are pure functions with no React dependencies, safe to
 * extract into a sibling module.
 *
 * @see useClassPageData
 */

import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { computeDatasetBlockingReason, type PageDatasetState } from '../../hooks/usePageDataset';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * Structured error type for the class page.
 *
 * Error precedence (top to bottom, first applicable wins):
 * 1. `classNotFound` — per-class query returned `null`
 * 2. `classQueryError` — per-class query errored
 * 3. `assignmentDefinitionPartialsFailed` — warm-up dataset failed
 * 4. `assignmentDefinitionPartialsUntrustworthy` — warm-up dataset
 *    untrustworthy but marked ready
 * 5. `adapterError` — adapter threw (typically a `classFull` structural defect)
 * 6. `analyserError` — analyser threw (typically a computation error)
 */
export type ClassPageError = Readonly<
  | { type: 'classNotFound' }
  | { type: 'classQueryError'; cause: Error }
  | { type: 'analyserError'; cause: Error }
  | { type: 'adapterError'; cause: Error }
  | { type: 'assignmentDefinitionPartialsFailed' }
  | { type: 'assignmentDefinitionPartialsUntrustworthy' }
>;

// ---------------------------------------------------------------------------
// Pure helper functions (complexity kept ≤ 7 per lint rule)
// ---------------------------------------------------------------------------

/**
 * Check per-class query for blocking errors (classNotFound, classQueryError).
 *
 * @param {ClassFull | null} classFull - The class full data (or null).
 * @param {boolean} isSuccess - Whether the query succeeded.
 * @param {boolean} isError - Whether the query errored.
 * @param {Error | null} queryError - The query error object.
 * @returns {ClassPageError | null} A blocking error, or null if none.
 */
export function computeQueryBlockingError(
  classFull: ClassFull | null,
  isSuccess: boolean,
  isError: boolean,
  queryError: Error | null
): ClassPageError | null {
  if (isSuccess && classFull === null) {
    return { type: 'classNotFound' };
  }

  if (isError) {
    const error = queryError instanceof Error ? queryError : new Error(String(queryError));
    return { type: 'classQueryError', cause: error };
  }

  return null;
}

/**
 * Check dataset state for blocking errors (failed, queryError, or untrustworthy).
 *
 * Delegates the precedence decision to the shared {@link computeDatasetBlockingReason}
 * (kept in `hooks/usePageDataset` so classPage and heatmaps cannot drift), then maps
 * the neutral reason onto the class-page error union:
 * - `failed` / `queryError` → `assignmentDefinitionPartialsFailed`
 * - `untrustworthy` → `assignmentDefinitionPartialsUntrustworthy`
 * - `none` → `null`
 *
 * @param {PageDatasetState} datasetState - The warm-up dataset state.
 * @returns {ClassPageError | null} A blocking error, or null if none.
 */
export function computeDatasetBlockingError(datasetState: PageDatasetState): ClassPageError | null {
  const reason = computeDatasetBlockingReason(datasetState);

  switch (reason.kind) {
    case 'failed':
    case 'queryError': {
      return { type: 'assignmentDefinitionPartialsFailed' };
    }
    case 'untrustworthy': {
      return { type: 'assignmentDefinitionPartialsUntrustworthy' };
    }
    case 'none': {
      return null;
    }
  }
}

/**
 * Check service-layer errors (adapterError precedes analyserError per spec).
 *
 * @param {Error | null} adapterError - The adapter error.
 * @param {Error | null} analyserError - The analyser error.
 * @returns {ClassPageError | null} A blocking error, or null if none.
 */
export function computeServiceError(
  adapterError: Error | null,
  analyserError: Error | null
): ClassPageError | null {
  if (adapterError !== null) {
    return { type: 'adapterError', cause: adapterError };
  }

  if (analyserError !== null) {
    return { type: 'analyserError', cause: analyserError };
  }

  return null;
}

/**
 * Check whether any input is still loading (including the pipeline itself).
 *
 * @param {boolean} isPending - Whether the per-class query is pending.
 * @param {boolean} isDatasetReady - Whether the warm-up dataset is ready.
 * @param {boolean} isDatasetFailed - Whether the warm-up dataset has failed.
 * @param {ClassPageAdapterResult | null} adapterResult - The adapter result (null when pipeline hasn't run).
 * @returns {boolean} True if any loading condition applies.
 */
export function computeIsLoading(
  isPending: boolean,
  isDatasetReady: boolean,
  isDatasetFailed: boolean,
  adapterResult: ClassPageAdapterResult | null
): boolean {
  if (isPending) return true;
  if (!isDatasetReady && !isDatasetFailed) return true;
  if (adapterResult === null) return true;
  return false;
}
