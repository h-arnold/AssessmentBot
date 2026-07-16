/**
 * Data orchestrator hook for the Class page.
 *
 * @remarks
 * Wires together the per-class query (`getABClass`), the warm-up-backed
 * `assignmentDefinitionPartials` read, the synchronous
 * `DataAnalysisService.analyse(...)` call, and the
 * `classPageAdapter.adaptClassPageToViewModel(...)` call.  Produces a single
 * typed {@link ClassPageData} result that includes the raw inputs, the derived
 * analyser + adapter output, the structured error (if any), and the combined
 * surface state per `frontend-loading-and-width-standards.md` §2-§5.
 *
 * `analyserResult` and `adapterResult` are non-null only when
 * `surfaceState.status === 'ready'`.  When the surface state is `loading` or
 * `blocking`, both are `null` because the hook has not called (or has failed
 * to call) the analyser / adapter pipeline.  The page composition root must
 * branch on `surfaceState.status` before reading `adapterResult.recentAssignments`
 * or any other derived field.
 *
 * The `refetch` entry point captures `classId` at call time via a `useCallback`
 * dependent on `classFullQuery.refetch` and `adpQuery.refetch` to prevent stale-closure
 * bugs that would cause the retry button to refetch a class the user is no longer viewing.
 *
 * A fire-and-forget prefetch `useEffect` runs alongside the data-orchestration
 * logic.  When `surfaceState.status === 'ready'`, it sorts
 * `classFull.assignments` via the shared {@link compareAssignmentUpdatedAtDesc}
 * comparator, takes the top 3, and calls
 * `queryClient.prefetchQuery(getAssignmentQueryOptions(...))` for each.
 * Prefetch rejections are logged (not silently swallowed) but never affect the
 * page surface.  A `useRef<string | null>`
 * guard (`prefetchedClassIdReference`) persists across React StrictMode's
 * mount/unmount/remount cycle and prevents double-dispatch; `prefetchQuery`
 * idempotency provides a secondary safeguard against duplicate in-flight
 * requests. The guard resets on cross-class navigation (new `classId` differs
 * from the ref).
 *
 * @see SPEC_CLASS_PAGE.md — "useClassPageData — data orchestrator hook"
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { getABClassQueryOptions, getAssignmentQueryOptions } from '../../query/sharedQueries';
import { usePageDataset } from '../../hooks/usePageDataset';
import { DataAnalysisService } from '../../services/dataAnalysis/dataAnalysisService';
import { adaptClassPageToViewModel } from './classPageAdapter';
import { compareAssignmentUpdatedAtDesc } from './classPageModel';
import { logFrontendError } from '../../logging/frontendLogger';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';
import type { ClassPageError } from './useClassPageData.helpers';
import {
  computeQueryBlockingError,
  computeDatasetBlockingError,
  computeServiceError,
  computeIsLoading,
} from './useClassPageData.helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of recent assignments to prefetch per class. */
const MAX_PREFETCH_ASSIGNMENTS = 3;

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type { ClassPageError } from './useClassPageData.helpers';

/** Complete typed return value of {@link useClassPageData}. */
export type ClassPageData = Readonly<{
  /** Raw per-class query data (null when query is pending or errored). */
  classFull: ClassFull | null;

  /** The full `useQuery` result for the per-class query (for refetch, status, etc.). */
  classFullQuery: UseQueryResult<ClassFull | null, Error>;

  /** Raw warm-up-backed dataset (consumed internally for surface state). */
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null;

  /** Derived analyser result — non-null only when `surfaceState.status === 'ready'`. */
  analyserResult: AveragingResult | null;

  /** Derived adapter result — non-null only when `surfaceState.status === 'ready'`. */
  adapterResult: ClassPageAdapterResult | null;

  /** The structured error (null when no blocking condition applies). */
  error: ClassPageError | null;

  /** Combined surface state — a discriminated union (`loading` | `blocking` | `ready`). */
  surfaceState: ClassPageSurfaceState;

  /** Retry entry point — refetches both the per-class query and the assignmentDefinitionPartials dataset query. */
  refetch: () => void;
}>;

/**
 * Discriminated union for the class page's combined surface state.
 *
 * - `loading`: at least one input is still loading and no blocking condition
 *   has been detected.
 * - `blocking`: one of the error-precedence conditions applies.
 * - `ready`: all inputs are ready and the analyser and adapter have produced
 *   valid results.
 */
export type ClassPageSurfaceState =
  { status: 'loading' } | { status: 'blocking'; error: ClassPageError } | { status: 'ready' };

/**
 * Run the analyser step of the pipeline.
 *
 * Extracted to keep the pipeline `useMemo` callback under the complexity limit.
 *
 * @param {ClassFull | null} classFull - The class data (null skips analysis).
 * @param {AssignmentDefinitionPartialsResponse | null} assignmentDefinitionPartials - Reference data.
 * @param {string} classId - The class ID for the filter.
 * @returns {readonly [AveragingResult | null, Error | null]} The result and optional error.
 *
 * @remarks
 * An empty array from the analyser is treated as an analyser error (not a silent
 * null) to preserve the invariant that `adapterResult` is non-null when
 * `surfaceState.status === 'ready'`.  See CODE_REVIEW.md finding C1.
 */
function runAnalyserStep(
  classFull: ClassFull | null,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null,
  classId: string
): readonly [AveragingResult | null, Error | null] {
  if (classFull === null) {
    return [null, null];
  }

  try {
    const response = _analysisService.analyse(
      {
        filter: { classIds: [classId] },
        classes: [classFull],
        assignmentDefinitionPartials: assignmentDefinitionPartials!,
      },
      'averaging'
    );
    if (response.length === 0) {
      return [null, new Error('Analyser returned empty result')];
    }
    return [response[0] ?? null, null];
  } catch (error_: unknown) {
    logFrontendError('useClassPageData.runAnalyserStep', error_, { classId });
    return [null, error_ instanceof Error ? error_ : new Error(String(error_))];
  }
}

/**
 * Run the adapter step of the pipeline.
 *
 * Extracted to keep the pipeline `useMemo` callback under the complexity limit.
 * Only called when `classFull` is non-null (the pipeline guard ensures this).
 *
 * @param {AveragingResult | null} analyserResult - The analyser result (null skips adapter).
 * @param {ClassFull} classFull - The class data (non-null, guaranteed by caller).
 * @param {AssignmentDefinitionPartialsResponse | null} assignmentDefinitionPartials - The definition registry.
 * @returns {readonly [ClassPageAdapterResult | null, Error | null]} The adapter result and optional error.
 */
function runAdapterStep(
  analyserResult: AveragingResult | null,
  classFull: ClassFull,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null
): readonly [ClassPageAdapterResult | null, Error | null] {
  if (analyserResult === null || assignmentDefinitionPartials === null) {
    return [null, null];
  }

  try {
    const result = adaptClassPageToViewModel({
      analyserResult,
      classFull,
      assignmentDefinitionPartials,
    });
    return [result, null];
  } catch (error_: unknown) {
    logFrontendError('useClassPageData.runAdapterStep', error_);
    return [null, error_ instanceof Error ? error_ : new Error(String(error_))];
  }
}

// ---------------------------------------------------------------------------
// Module-level service instance
//
// Created once at module load time so the test mock's implementation is
// captured before `vi.resetAllMocks()` runs between tests.  The cached
// instance retains the mocked `analyse` function reference — `mockAnalyse`
// is reset between tests but remains callable, and each test configures
// the return value before calling `renderHook`.
//
// A factory function is used so that `vi.mock` patching of `DataAnalysisService`
// as a function (not a class constructor) works correctly in tests.  The
// factory pattern avoids a try/catch workaround that would be needed if
// `new DataAnalysisService()` appeared directly at module level.
// ---------------------------------------------------------------------------

/**
 * Create the module-level `DataAnalysisService` instance.
 *
 * A factory function is used so that `vi.mock` patching of `DataAnalysisService`
 * as a function (not a class constructor) works correctly in tests.
 *
 * @returns {DataAnalysisService} A new service instance.
 */
function createAnalysisService(): DataAnalysisService {
  return new DataAnalysisService();
}

const _analysisService: DataAnalysisService = createAnalysisService();

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Data orchestrator hook for the Class page.
 *
 * @param {string} classId - The class ID to fetch data for.
 * @returns {ClassPageData} Typed data result with surface state.
 */
export function useClassPageData(classId: string): ClassPageData {
  // -----------------------------------------------------------------------
  // 1. Per-class query — view-entry fetch via getABClass
  // -----------------------------------------------------------------------

  const classFullQuery: UseQueryResult<ClassFull | null, Error> = useQuery(
    getABClassQueryOptions(classId)
  );
  const classFull: ClassFull | null = classFullQuery.data ?? null;

  // -----------------------------------------------------------------------
  // 2. Warm-up-backed assignmentDefinitionPartials dataset
  // -----------------------------------------------------------------------

  const { query: adpQuery, datasetState } = usePageDataset<AssignmentDefinitionPartialsResponse>(
    'assignmentDefinitionPartials'
  );
  const assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null =
    adpQuery.data ?? null;

  // Destructure primitives for stable memo dependency references
  const { isDatasetFailed, isDatasetReady, isDatasetTrustworthy } = datasetState;

  // -----------------------------------------------------------------------
  // 3. Pipeline guard — dataset trust check BEFORE running analyser/adapter.
  //
  // Per the spec's nullability contract, analyserResult and adapterResult are
  // non-null only when surfaceState.status === 'ready'.  This guard ensures
  // the pipeline does NOT run when the dataset is untrustworthy or has failed,
  // even if assignmentDefinitionPartials has query data available.
  // -----------------------------------------------------------------------

  const shouldRunPipeline: boolean = useMemo<boolean>(() => {
    if (!classFull || !assignmentDefinitionPartials) return false;

    // Don't run on untrustworthy or failed data
    if (isDatasetFailed) return false;
    if (isDatasetReady && !isDatasetTrustworthy) return false;

    return true;
  }, [
    classFull,
    assignmentDefinitionPartials,
    isDatasetFailed,
    isDatasetReady,
    isDatasetTrustworthy,
  ]);

  // -----------------------------------------------------------------------
  // 4-5. Analyser and adapter pipeline
  //
  // Both steps are computed together so that analyserResult/adapterResult are
  // both null when any step fails.  Per the spec, these results are non-null
  // only when surfaceState.status === 'ready'.
  //
  // @remarks — The memoisation key includes `classId` (not just
  // `[classFull, assignmentDefinitionPartials]` as the behavioural spec
  // suggests) because `classId` is used inside `runAnalyserStep` to populate
  // `AnalysisFilter.classIds`.  Omitting `classId` from the key would mean
  // the analyser might reuse stale results when `classId` changes without
  // `classFull` or `assignmentDefinitionPartials` changing.
  // -----------------------------------------------------------------------

  const [analyserResult, analyserError, adapterResult, adapterError] = useMemo<
    readonly [AveragingResult | null, Error | null, ClassPageAdapterResult | null, Error | null]
  >((): readonly [
    AveragingResult | null,
    Error | null,
    ClassPageAdapterResult | null,
    Error | null,
  ] => {
    // Pipeline guard — return nulls when dataset conditions are not met
    if (!shouldRunPipeline) {
      return [null, null, null, null];
    }

    const [aResult, aError] = runAnalyserStep(classFull, assignmentDefinitionPartials, classId);

    if (aError !== null) {
      return [null, aError, null, null];
    }

    const [adResult, adError] = runAdapterStep(
      aResult,
      classFull as ClassFull,
      assignmentDefinitionPartials
    );

    if (adError !== null) {
      return [null, null, null, adError];
    }

    return [aResult, null, adResult, null];
  }, [shouldRunPipeline, classFull, assignmentDefinitionPartials, classId]);

  // -----------------------------------------------------------------------
  // 6. Surface state — error precedence, then loading, then ready
  // -----------------------------------------------------------------------

  const surfaceState: ClassPageSurfaceState = useMemo<ClassPageSurfaceState>(() => {
    // Error precedence (top to bottom, first applicable wins):

    // 1-2. Per-class query errors (classNotFound, classQueryError)
    const queryError = computeQueryBlockingError(
      classFull,
      classFullQuery.isSuccess,
      classFullQuery.isError,
      classFullQuery.error
    );
    if (queryError !== null) {
      return { status: 'blocking', error: queryError };
    }

    // 3-4. Dataset errors (failed, untrustworthy)
    const datasetError = computeDatasetBlockingError(
      isDatasetFailed,
      isDatasetReady,
      isDatasetTrustworthy
    );
    if (datasetError !== null) {
      return { status: 'blocking', error: datasetError };
    }

    // 5-6. Service-layer errors (adapterError, analyserError)
    const serviceError = computeServiceError(adapterError, analyserError);
    if (serviceError !== null) {
      return { status: 'blocking', error: serviceError };
    }

    // Loading check — if no blocking condition applies, check if any inputs
    // are still loading (including the pipeline itself)
    if (
      computeIsLoading(classFullQuery.isPending, isDatasetReady, isDatasetFailed, adapterResult)
    ) {
      return { status: 'loading' };
    }

    // Ready — all inputs are ready and analyser + adapter succeeded
    return { status: 'ready' };
  }, [
    classFull,
    classFullQuery.isSuccess,
    classFullQuery.isError,
    classFullQuery.error,
    classFullQuery.isPending,
    isDatasetFailed,
    isDatasetReady,
    isDatasetTrustworthy,
    analyserError,
    adapterError,
    adapterResult,
  ]);

  // Derive the structured error from the surface state (null when not blocking)
  const error: ClassPageError | null =
    surfaceState.status === 'blocking' ? surfaceState.error : null;

  // -----------------------------------------------------------------------
  // 8. Prefetch effect — fire-and-forget top-3 assignment warm-up.
  //
  // Fires once when `surfaceState.status === 'ready'` and `classFull` is
  // non-null.  Sorts `classFull.assignments` using the shared comparator,
  // takes the first 3 (or fewer), and calls `queryClient.prefetchQuery`
  // for each.  A `useRef` guard ensures exactly one dispatch per classId;
  // navigating to a different class resets the guard (the new `classId`
  // differs from the ref).  This is intentionally fire-and-forget:
  // prefetch rejections are logged but never affect the page surface.
  // -----------------------------------------------------------------------

  const queryClient = useQueryClient();
  const prefetchedClassIdReference = useRef<string | null>(null);

  useEffect(() => {
    if (surfaceState.status !== 'ready' || classFull === null) {
      return;
    }

    if (prefetchedClassIdReference.current === classId) {
      return;
    }

    // Defensive guard: every assignment must have a non-null updatedAt before the sort.
    // The adapter's validateUpdatedAt throws before surfaceState can become 'ready',
    // so this invariant always holds; throwing here fails fast if violated.
    for (const a of classFull.assignments) {
      if (!a.updatedAt) {
        throw new Error(
          `Cannot prefetch: assignment ${a.assignmentId} has null or falsy updatedAt`
        );
      }
    }

    // Set the guard only after the invariant check succeeds, so a thrown violation
    // (or a rejected prefetch) does not permanently disable prefetch for this classId.
    prefetchedClassIdReference.current = classId;

    const sorted = (classFull.assignments as Array<{ assignmentId: string; updatedAt: string }>)
      .toSorted(compareAssignmentUpdatedAtDesc)
      .slice(0, MAX_PREFETCH_ASSIGNMENTS);

    for (const assignment of sorted) {
      void queryClient
        .prefetchQuery(getAssignmentQueryOptions(classFull.classId, assignment.assignmentId))
        .catch((error) => {
          logFrontendError('useClassPageData.prefetch', error, {
            courseId: classFull.classId,
            assignmentId: assignment.assignmentId,
          });
        });
    }
    // The ref guard prevents re-dispatch when classFull reference changes; the effect
    // fires when surfaceState.status transitions to 'ready' or classId changes.
  }, [surfaceState.status, classId, classFull, queryClient]);

  // -----------------------------------------------------------------------
  // 9. Refetch — stable callback via destructured refetch dependencies.
  //    React Query guarantees the refetch function is stable for the same
  //    query key.  When classId changes, the query key changes and a new
  //    refetch function is created — preventing stale-closure bugs.
  // -----------------------------------------------------------------------

  const { refetch: queryRefetch } = classFullQuery;
  const { refetch: adpRefetch } = adpQuery;

  /**
   * Stable callback that triggers a refetch of both the per-class query
   * and the `assignmentDefinitionPartials` dataset query.
   *
   * @remarks
   * The `ERROR_CONFIG_MAP` in `ClassPageContent.tsx` marks
   * `assignmentDefinitionPartialsFailed` and
   * `assignmentDefinitionPartialsUntrustworthy` as `retryable: true`.
   * Refetching only the class query would leave dataset errors persisting,
   * making the Retry button appear broken.  This dual-refetch contract
   * resolves both query-level and dataset-level errors in a single action.
   *
   * Avoids stale-closure bugs by depending on `queryRefetch` (destructured
   * from `classFullQuery`) and `adpRefetch` (destructured from the dataset
   * query) rather than capturing `classId` directly.  React Query guarantees
   * the `refetch` function is stable for the same query key.  When `classId`
   * changes, React Query creates a new query with a new key, producing new
   * refetch functions — preventing the retry button from refetching a class
   * the user is no longer viewing.
   */
  const refetch: () => void = useCallback((): void => {
    queryRefetch();
    adpRefetch();
  }, [queryRefetch, adpRefetch]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    classFull,
    classFullQuery,
    assignmentDefinitionPartials,
    analyserResult,
    adapterResult,
    error,
    surfaceState,
    refetch,
  };
}
