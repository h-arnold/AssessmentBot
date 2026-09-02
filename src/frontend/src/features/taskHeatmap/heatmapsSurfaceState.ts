/**
 * Surface-state and blocking-error derivation for the standalone Heatmaps hook.
 *
 * @remarks
 * Pure, deterministic helpers that derive the discriminated {@link HeatmapsSurfaceState}
 * from the resolved per-class query, the assignment-definition-partials dataset state,
 * and the service-layer (analyser/adapter) errors.
 *
 * Error precedence mirrors `useClassPageData`: per-class query errors → dataset
 * failures → service errors. When no class is selected, the surface is `ready` once
 * the selector datasets are usable (selector-only readiness); the disabled class query
 * is inert, so it never forces a `loading` state on its own.
 *
 * These helpers are extracted from `useHeatmapsPageData.ts` to keep that module under the
 * 500-LOC module-size gate, and to isolate the pure
 * surface-state derivation (per `src/frontend/AGENTS.md` §3.3 folder conventions).
 */

import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { computeDatasetBlockingReason, type PageDatasetState } from '../../hooks/usePageDataset';
import { toError } from '../../errors/normaliseUnknownError';

/**
 * Structured error for the Heatmaps surface, per the Class Page error taxonomy
 * (query errors → dataset failures → service errors).
 */
export type HeatmapsPageError =
  | { readonly type: 'classNotFound' }
  | { readonly type: 'classQueryError'; readonly cause: Error }
  | { readonly type: 'assignmentDefinitionPartialsFailed' }
  | { readonly type: 'assignmentDefinitionPartialsUntrustworthy' }
  | { readonly type: 'analyserError'; readonly cause: Error }
  | { readonly type: 'adapterError'; readonly cause: Error };

/**
 * Discriminated union for the Heatmaps combined surface state.
 *
 * - `loading`: at least one input is still loading and no blocking condition applies.
 * - `blocking`: one of the error-precedence conditions applies.
 * - `ready`: warm-up datasets are selector-ready with no class, OR class selected and the
 *   analyser + merged adapter produced valid results. Derived results are non-null only here.
 */
export type HeatmapsSurfaceState =
  | { readonly status: 'loading' }
  | { readonly status: 'blocking'; readonly error: HeatmapsPageError }
  | { readonly status: 'ready' };

/**
 * Derive a blocking error from the per-class query result.
 *
 * @param {ClassFull | null} classFull - The class query data.
 * @param {boolean} isSuccess - Whether the query succeeded.
 * @param {boolean} isError - Whether the query errored.
 * @param {Error | null} error - The query error.
 * @returns {HeatmapsPageError | null} A blocking error, or `null`.
 */
export function computeQueryBlockingError(
  classFull: ClassFull | null,
  isSuccess: boolean,
  isError: boolean,
  error: Error | null
): HeatmapsPageError | null {
  if (classFull === null && isSuccess) {
    return { type: 'classNotFound' };
  }
  if (isError) {
    return {
      type: 'classQueryError',
      cause: toError(error),
    };
  }
  return null;
}

/**
 * Derive a blocking error from the assignment-definition-partials dataset state.
 *
 * Delegates the precedence decision to the shared {@link computeDatasetBlockingReason}
 * (kept in `hooks/usePageDataset` so classPage and heatmaps cannot drift), then maps
 * the neutral reason onto the heatmaps error union:
 * - `failed` / `queryError` → `assignmentDefinitionPartialsFailed`
 * - `untrustworthy` → `assignmentDefinitionPartialsUntrustworthy`
 * - `none` → `null`
 *
 * @param {PageDatasetState} datasetState - The ADP dataset state.
 * @returns {HeatmapsPageError | null} A blocking error, or `null`.
 */
export function computeDatasetBlockingError(
  datasetState: PageDatasetState
): HeatmapsPageError | null {
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
 * Derive a blocking error from the service-layer (adapter / analyser) errors.
 *
 * @param {Error | null} adapterError - The adapter error.
 * @param {Error | null} analyserError - The analyser error.
 * @returns {HeatmapsPageError | null} A blocking error, or `null`.
 */
export function computeServiceError(
  adapterError: Error | null,
  analyserError: Error | null
): HeatmapsPageError | null {
  if (adapterError !== null) {
    return { type: 'adapterError', cause: adapterError };
  }
  if (analyserError !== null) {
    return { type: 'analyserError', cause: analyserError };
  }
  return null;
}

/**
 * Derive the combined surface state from the resolved inputs.
 *
 * Error precedence (first applicable wins): per-class query errors, then dataset
 * failures, then service-layer errors. When no blocking condition applies and the
 * class query is still pending, the surface is `loading`; otherwise `ready`. When
 * no class is selected, the surface is `ready` once the selector datasets are usable
 * (selector-only readiness) — the disabled class query is inert.
 *
 * @param {string | null} classId - The selected class ID.
 * @param {ClassFull | null} classFull - The class query data.
 * @param {boolean} classIsSuccess - Whether the class query succeeded.
 * @param {boolean} classIsError - Whether the class query errored.
 * @param {Error | null} classError - The class query error.
 * @param {boolean} classIsPending - Whether the class query is pending.
 * @param {PageDatasetState} adpDatasetState - The ADP dataset state.
 * @param {Error | null} analyserError - The analyser error.
 * @param {Error | null} adapterError - The adapter error.
 * @returns {HeatmapsSurfaceState} The combined surface state.
 */
export function computeHeatmapsSurfaceState(
  classId: string | null,
  classFull: ClassFull | null,
  classIsSuccess: boolean,
  classIsError: boolean,
  classError: Error | null,
  classIsPending: boolean,
  adpDatasetState: PageDatasetState,
  analyserError: Error | null,
  adapterError: Error | null
): HeatmapsSurfaceState {
  if (classId === null) {
    const datasetError = computeDatasetBlockingError(adpDatasetState);
    return datasetError === null
      ? { status: 'ready' }
      : { status: 'blocking', error: datasetError };
  }

  const queryError = computeQueryBlockingError(classFull, classIsSuccess, classIsError, classError);
  if (queryError !== null) {
    return { status: 'blocking', error: queryError };
  }

  const datasetError = computeDatasetBlockingError(adpDatasetState);
  if (datasetError !== null) {
    return { status: 'blocking', error: datasetError };
  }

  const serviceError = computeServiceError(adapterError, analyserError);
  if (serviceError !== null) {
    return { status: 'blocking', error: serviceError };
  }

  if (classIsPending) {
    return { status: 'loading' };
  }

  return { status: 'ready' };
}
