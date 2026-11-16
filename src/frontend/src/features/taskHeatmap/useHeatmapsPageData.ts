/**
 * Orchestration hook for the standalone Heatmaps surface.
 *
 * @remarks
 * Mirrors `useClassPageData`'s pipeline — warm-up selector datasets, per-class
 * query on selection, synchronous averaging analysis over input-shaped
 * assignments, merged adapter projection, per-selected-assignment preview queries,
 * merged lookup/status assembly, discriminated surface state, and a refresh entry
 * point — WITHOUT importing `features/classPage/**` (permanent dependency rule).
 *
 * The heavy lifting is delegated to feature-local helpers (kept in separate modules
 * to honour the 500-LOC module-size gate
 * (per `docs/developer/frontend/frontend-architecture.md`)):
 *
 * - `heatmapsSurfaceState.ts` — pure surface-state / blocking-error derivation.
 * - `heatmapsPipeline.ts` — synchronous analyser + merged-adapter pipeline
 *   with boundary diagnostics.
 * - `assembleMergedPreviewData.ts` — merged preview lookup / status assembly.
 * - `selectionCascade.ts` — pure selection-cascade reducer.
 *
 * Nullability contract (parity with `useClassPageData`): `analyserResult`,
 * `mergedResult`, and `mergedPreview` are non-null only when
 * `surfaceState.status === 'ready'` AND a class with selections is present. The page
 * must branch on `surfaceState.status` before reading them.
 *
 * **Analyser input shaping.** `classes` is passed as the single selected `ClassFull`
 * with its `assignments` replaced by the *selected assignment IDs* (string[]), and
 * `filter.classIds` carries only the selected class. The analyser ignores
 * `filter.classIds` and its definition-key filters would wrongly include sibling
 * instances, so input shaping owns scoping (no `topicKeys` / `assignmentDefinitionKeys`
 * filters). The analyser call is wrapped in try/catch so any schema drift fails safe
 * as a blocking error rather than rendering silently.
 *
 * **Memoisation.** The analyser/adapter pipeline memo key includes the deferred
 * selection's assignment IDs and class ID as well as `classFull` and
 * `assignmentDefinitionPartials`. Both selection fields feed the analyser input, so
 * omitting either would reuse stale results when the selection changes without
 * `classFull` changing — this is the staleness-guard analogue to
 * `useClassPageData`'s `classId`-in-key note.
 *
 * **Deferred derivation.** The urgent `selection` drives the selector controls,
 * option lists and the per-assignment `useQueries` list so fetches start
 * immediately. A deferred copy of the whole selection (`useDeferredValue`) drives
 * `shouldRunHeatmapsPipeline`, `runHeatmapsPipeline`, merged-preview assembly, the
 * table's `heatmapResult` and (through `mergedResult`) the selection-summary cards.
 * The pipeline therefore stays on its committed result — with stable references —
 * while React recomputes at interruptible priority. The gate additionally requires
 * the loaded class to match the deferred selection's class, so a cached-class
 * switch during the lag cannot pair the new class with the previous class's
 * deferred assignment IDs.
 *
 * **Per-assignment preview queries.** Enabled only for urgently selected
 * assignments. They are driven through `useQueries` (a single hook call over the
 * selection array) so the dynamic list of queries never violates the React
 * rules-of-hooks invariant that `useQuery` must not be called inside a loop. The
 * deferred selection's preview inputs are paired to those results by
 * `assignmentId` (a Map), never by array index across two different selections.
 * When a deferred-selected assignment has no urgent-keyed result yet (for example
 * it was removed during the lag), the `buildPreviewInputsByAssignmentId` helper
 * (in `heatmapsPreviewQueries.ts`) synthesises a pending preview input — loading
 * status with an empty lookup — so assembly never sees a missing input.
 * `assembleMergedPreviewData`'s missing-input throw remains the fail-loud wiring
 * invariant.
 */

import { useCallback, useDeferredValue, useMemo, useReducer } from 'react';
import {
  useQueries,
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { getABClassQueryOptions, getAssignmentQueryOptions } from '@/query/sharedQueries';
import { queryKeys } from '@/query/queryKeys';
import { usePageDataset } from '@/hooks/usePageDataset';
import { toError } from '@/errors/normaliseUnknownError';
import { usePagePostAnalysisTasks } from '@/hooks/usePagePostAnalysisTasks';
import type { AveragingResult } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentFull } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentDefinitionPartialsResponse } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassPartial } from '@/services/googleClassrooms/classPartialsService';
import type { MergedHeatmapResult } from '@/services/dataAnalysis/heatmapAdapter.merged';
import {
  selectionCascadeReducer,
  INITIAL_SELECTION_STATE,
  type SelectionState,
} from './selectionCascade';
import {
  assembleMergedPreviewData,
  type MergedPreviewAssemblyResult,
} from './assembleMergedPreviewData';
import {
  buildDisabledQueryOptions,
  buildPreviewInputsByAssignmentId,
  type AssignmentPreviewCombined,
} from './heatmapsPreviewQueries';
import {
  shouldRunHeatmapsPipeline,
  runHeatmapsPipeline,
  logPipelineError,
} from './heatmapsPipeline';
import {
  computeHeatmapsSurfaceState,
  type HeatmapsPageError,
  type HeatmapsSurfaceState,
} from './heatmapsSurfaceState';

export type { HeatmapsPageError, HeatmapsSurfaceState } from './heatmapsSurfaceState';

/** Complete typed return value of {@link useHeatmapsPageData}. */
export type HeatmapsPageData = Readonly<{
  /** Current selection state (classId / topicKeys / assignmentIds). */
  selection: SelectionState;
  /** Warm-up class-partials dataset (selector options); null until ready. */
  classPartials: ClassPartial[] | null;
  /** Warm-up assignment-definition partials dataset; null until ready. */
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null;
  /** Raw per-class query data (null when no class selected / pending / errored). */
  classFull: ClassFull | null;
  /** The full `useQuery` result for the per-class query (for refetch, status). */
  classFullQuery: UseQueryResult<ClassFull | null, Error>;
  /** Derived analyser result — non-null only when `surfaceState.status === 'ready'`. */
  analyserResult: AveragingResult | null;
  /** Derived merged adapter result — non-null only when `surfaceState.status === 'ready'`. */
  mergedResult: MergedHeatmapResult | null;
  /** Merged preview lookup + status map — non-null only when `surfaceState.status === 'ready'`. */
  mergedPreview: MergedPreviewAssemblyResult | null;
  /** The structured error (null when not blocking). */
  error: HeatmapsPageError | null;
  /** Combined surface state — a discriminated union (`loading` | `blocking` | `ready`). */
  surfaceState: HeatmapsSurfaceState;
  /** Select (or clear) the class; atomically clears topics + assignments via the reducer. */
  selectClass: (classId: string | null) => void;
  /** Change the active topic set (clears invalid assignment selections). */
  changeTopics: (
    topicKeys: readonly string[],
    assignmentTopicKeys: ReadonlyMap<string, string>
  ) => void;
  /** Change the assignment selection. */
  changeAssignments: (assignmentIds: readonly string[]) => void;
  /** `true` while owned queries fetch or the deferred pipeline inputs lag the selection (accessible busy semantics). */
  isRefreshing: boolean;
  /** Manual refresh: re-runs class query + ADP dataset + enabled assignment queries. */
  refetch: () => void;
}>;

/**
 * Derive the global refresh-busy signal from the owned query families.
 *
 * @param {UseQueryResult<ClassFull | null, Error>} classFullQuery - The per-class query.
 * @param {UseQueryResult<AssignmentDefinitionPartialsResponse>} adpQuery - The ADP dataset query.
 * @param {ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>} assignmentQueryResults - Per-assignment queries.
 * @returns {boolean} `true` while any owned query is fetching.
 */
function isAnyHeatmapQueryFetching(
  classFullQuery: UseQueryResult<ClassFull | null, Error>,
  adpQuery: UseQueryResult<AssignmentDefinitionPartialsResponse>,
  assignmentQueryResults: ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>
): boolean {
  return (
    classFullQuery.isFetching ||
    adpQuery.isFetching ||
    assignmentQueryResults.some((query) => query.isFetching)
  );
}

/**
 * Report whether the deferred pipeline inputs still lag the urgent selection.
 *
 * @param {SelectionState} urgent - The urgent selection state.
 * @param {SelectionState} deferred - The deferred selection state.
 * @returns {boolean} `true` while the class or assignment inputs differ.
 */
function hasPipelineInputLag(urgent: SelectionState, deferred: SelectionState): boolean {
  if (
    urgent.classId !== deferred.classId ||
    urgent.assignmentIds.length !== deferred.assignmentIds.length
  ) {
    return true;
  }
  return urgent.assignmentIds.some(
    (assignmentId, index) => assignmentId !== deferred.assignmentIds[index]
  );
}

/**
 * Derive the global refresh-busy signal from the owned query families and the
 * deferral lag.
 *
 * @param {UseQueryResult<ClassFull | null, Error>} classFullQuery - The per-class query.
 * @param {UseQueryResult<AssignmentDefinitionPartialsResponse>} adpQuery - The ADP dataset query.
 * @param {ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>} assignmentQueryResults - Per-assignment queries.
 * @param {SelectionState} urgent - The urgent selection state.
 * @param {SelectionState} deferred - The deferred selection state.
 * @returns {boolean} `true` while any owned query is fetching or the pipeline inputs lag.
 */
function isHeatmapsRefreshing(
  classFullQuery: UseQueryResult<ClassFull | null, Error>,
  adpQuery: UseQueryResult<AssignmentDefinitionPartialsResponse>,
  assignmentQueryResults: ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>,
  urgent: SelectionState,
  deferred: SelectionState
): boolean {
  return (
    isAnyHeatmapQueryFetching(classFullQuery, adpQuery, assignmentQueryResults) ||
    hasPipelineInputLag(urgent, deferred)
  );
}

/**
 * Data orchestrator hook for the standalone Heatmaps surface.
 *
 * @returns {HeatmapsPageData} Typed data result with surface state and selection actions.
 */
export function useHeatmapsPageData(): HeatmapsPageData {
  // -----------------------------------------------------------------------
  // 0. Selection state (reducer-owned, no auto-selections)
  // -----------------------------------------------------------------------

  const [selection, dispatch] = useReducer(selectionCascadeReducer, INITIAL_SELECTION_STATE);

  // Selection actions dispatch directly. React 18+ automatic batching already
  // covers both event-handler and programmatic callers, so an unconditional
  // `flushSync` is unnecessary and would risk act-boundary warnings in tests.
  // The reducer update is flushed by React's batching before the next render,
  // keeping the surface consistent for all callers.
  const selectClass = useCallback((classId: string | null): void => {
    dispatch({ type: 'selectClass', classId });
  }, []);

  const changeTopics = useCallback(
    (topicKeys: readonly string[], assignmentTopicKeys: ReadonlyMap<string, string>): void => {
      dispatch({ type: 'changeTopics', topicKeys, assignmentTopicKeys });
    },
    []
  );

  const changeAssignments = useCallback((assignmentIds: readonly string[]): void => {
    dispatch({ type: 'changeAssignments', assignmentIds });
  }, []);

  const { classId, assignmentIds: selectedAssignmentIds } = selection;

  // The urgent value drives the controls, option lists and per-assignment fetches.
  // This deferred copy drives every expensive derivation (see the module JSDoc).
  const deferredSelection: SelectionState = useDeferredValue(selection);
  const { classId: deferredClassId, assignmentIds: deferredAssignmentIds } = deferredSelection;

  // -----------------------------------------------------------------------
  // 1. Warm-up selector datasets (fail-closed semantics)
  // -----------------------------------------------------------------------

  const { query: classPartialsQuery } = usePageDataset<ClassPartial[]>('classPartials');
  const { query: adpQuery, datasetState: adpDatasetState } =
    usePageDataset<AssignmentDefinitionPartialsResponse>('assignmentDefinitionPartials');

  const classPartials = (classPartialsQuery.data ?? null) as ClassPartial[] | null;
  const assignmentDefinitionPartials = (adpQuery.data ??
    null) as AssignmentDefinitionPartialsResponse | null;

  // -----------------------------------------------------------------------
  // 2. Per-class query — view-entry fetch via getABClass, only when a class is selected
  // -----------------------------------------------------------------------

  const classQueryOptions: UseQueryOptions<ClassFull | null, Error> =
    classId === null
      ? buildDisabledQueryOptions<ClassFull | null>(queryKeys.abClass('__none__'))
      : (getABClassQueryOptions(classId) as unknown as UseQueryOptions<ClassFull | null, Error>);
  const classFullQuery: UseQueryResult<ClassFull | null, Error> = useQuery<ClassFull | null, Error>(
    classQueryOptions
  );
  const classFull: ClassFull | null = classFullQuery.data ?? null;

  // -----------------------------------------------------------------------
  // 3. Pipeline guard — dataset trust check BEFORE running analyser/adapter
  // -----------------------------------------------------------------------

  const shouldRunPipeline: boolean = useMemo<boolean>(
    () =>
      shouldRunHeatmapsPipeline(classFull, deferredAssignmentIds, adpDatasetState, deferredClassId),
    [classFull, deferredAssignmentIds, adpDatasetState, deferredClassId]
  );

  // -----------------------------------------------------------------------
  // 4-5. Analyser + merged-adapter pipeline (synchronous, memoised)
  // -----------------------------------------------------------------------

  const [analyserResult, analyserError, mergedResult, adapterError] = useMemo<
    readonly [AveragingResult | null, Error | null, MergedHeatmapResult | null, Error | null]
  >(() => {
    return shouldRunPipeline
      ? runHeatmapsPipeline(
          classFull,
          assignmentDefinitionPartials,
          deferredClassId,
          deferredAssignmentIds
        )
      : [null, null, null, null];
  }, [
    shouldRunPipeline,
    classFull,
    assignmentDefinitionPartials,
    deferredClassId,
    deferredAssignmentIds,
  ]);

  // -----------------------------------------------------------------------
  // 6. Per-selected-assignment preview queries (enablement keyed to the urgent selection)
  // -----------------------------------------------------------------------

  // Per-selected-assignment preview queries. They are driven through `useQueries` (a single hook
  // call over the urgent selection array) so fetches start immediately and the dynamic list never
  // violates the React rules-of-hooks invariant that `useQuery` must not be called inside a loop.
  //
  // The `combine` callback projects each per-assignment `UseQueryResult` into the minimal
  // `AssignmentPreviewResult` payload the merged-preview assembly actually consumes. React Query
  // applies `replaceEqualDeep` structural sharing to the combined value, so
  // `assignmentPreviewCombined` is referentially stable when the underlying query data and status
  // are deep-equal — the merged-preview memo keys on it (plus `mergedResult` and the deferred
  // assignment IDs) without a manual per-render signature, and only rebuilds the expensive
  // merged-lookup Map when a per-assignment payload or status genuinely changes. The raw
  // `UseQueryResult`s are also surfaced (under `rawResults`) for `refetch` / busy derivation.
  const assignmentPreviewCombined: AssignmentPreviewCombined = useQueries({
    queries: selectedAssignmentIds.map(
      (assignmentId: string): UseQueryOptions<AssignmentFull | null, Error> => {
        const options: UseQueryOptions<AssignmentFull | null, Error> =
          classId === null
            ? buildDisabledQueryOptions<AssignmentFull | null>(
                getAssignmentQueryOptions('__none__', assignmentId).queryKey
              )
            : (getAssignmentQueryOptions(
                classFull?.classId ?? classId,
                assignmentId
              ) as unknown as UseQueryOptions<AssignmentFull | null, Error>);
        return options;
      }
    ),
    combine: (
      results: ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>
    ): AssignmentPreviewCombined => {
      return {
        previewResults: results.map((result, index: number) => {
          return {
            assignmentId: selectedAssignmentIds[index],
            isPending: result.isPending,
            isError: result.status === 'error',
            data: result.data ?? null,
          };
        }),
        rawResults: results,
      };
    },
  });

  // -----------------------------------------------------------------------
  // 7. Merged preview lookup + status assembly
  // -----------------------------------------------------------------------

  // Assemble the merged preview lookup + status map from the deferred selection,
  // pairing each deferred assignment with its urgent-keyed result by ID. A deferred
  // assignment with no urgent result is synthesised as pending by
  // `buildPreviewInputsByAssignmentId`, so assembly's missing-input throw stays a
  // wiring-regression invariant rather than a removal-during-lag failure.
  // `buildCellPreviewLookup` fails fast (throws) when an `AssignmentFull` is missing
  // `assignmentDefinition`; that throw is caught here, logged, and surfaced as the
  // feature's `adapterError` branch rather than escaping to the app-level error
  // boundary. `buildCellPreviewLookup`'s throw is intentionally preserved (fail-fast
  // discipline); only the boundary catches.
  const { mergedPreview, assemblyError } = useMemo<{
    mergedPreview: MergedPreviewAssemblyResult | null;
    assemblyError: Error | null;
  }>(() => {
    if (mergedResult === null) {
      return { mergedPreview: null, assemblyError: null };
    }
    try {
      const inputs = buildPreviewInputsByAssignmentId(
        deferredAssignmentIds,
        assignmentPreviewCombined.previewResults
      );
      return {
        mergedPreview: assembleMergedPreviewData(inputs, mergedResult.taskColumns),
        assemblyError: null,
      };
    } catch (error: unknown) {
      logPipelineError('useHeatmapsPageData.assembleMergedPreviewData', error, {
        classId: deferredClassId,
      });
      return { mergedPreview: null, assemblyError: toError(error) };
    }
  }, [mergedResult, deferredAssignmentIds, assignmentPreviewCombined, deferredClassId]);

  // -----------------------------------------------------------------------
  // 8. Surface state — error precedence, then loading, then ready
  // -----------------------------------------------------------------------

  // The assembly invariant throw is surfaced as the feature's `adapterError` blocking
  // branch, taking precedence over any empty analyser error when both are absent.
  const effectiveAdapterError: Error | null = assemblyError ?? adapterError;

  const surfaceState: HeatmapsSurfaceState = useMemo<HeatmapsSurfaceState>(() => {
    return computeHeatmapsSurfaceState(
      classId,
      classFull,
      classFullQuery.isSuccess,
      classFullQuery.isError,
      classFullQuery.error,
      classFullQuery.isPending,
      adpDatasetState,
      analyserError,
      effectiveAdapterError
    );
  }, [
    classId,
    classFull,
    classFullQuery.isSuccess,
    classFullQuery.isError,
    classFullQuery.error,
    classFullQuery.isPending,
    adpDatasetState,
    analyserError,
    effectiveAdapterError,
  ]);

  const error: HeatmapsPageError | null =
    surfaceState.status === 'blocking' ? surfaceState.error : null;

  // The post-analysis binding consumes the deferred pipeline values so its work
  // trails the selection by the deferral lag and coalesces under rapid changes.
  usePagePostAnalysisTasks(
    surfaceState.status,
    classFull,
    assignmentDefinitionPartials,
    analyserResult,
    deferredClassId
  );

  // -----------------------------------------------------------------------
  // 9. Refresh — re-run class query, ADP dataset, and enabled assignment queries
  // -----------------------------------------------------------------------

  // Busy also covers the deferral lag itself: the pipeline's inputs are the deferred
  // `(classId, assignmentIds)`, so a recompute with no in-flight fetch still counts
  // as a refresh. Topic-only changes do not feed the pipeline and so do not flash.
  const isRefreshing: boolean = isHeatmapsRefreshing(
    classFullQuery,
    adpQuery,
    assignmentPreviewCombined.rawResults,
    selection,
    deferredSelection
  );

  // Retry handler: unconditionally re-runs all three owned query families. This is
  // an intentional simplicity/precision trade-off — retrying all families is always
  // sufficient to recover the failed input, and scoping the refetch to only the
  // failed family was considered but rejected as not worth the added state-mapping
  // complexity (the failed input is always included by the broader retry).
  const refetch = useCallback((): void => {
    classFullQuery.refetch();
    adpQuery.refetch();
    assignmentPreviewCombined.rawResults.forEach(
      (query: UseQueryResult<AssignmentFull | null, Error>) => query.refetch()
    );
  }, [classFullQuery, adpQuery, assignmentPreviewCombined]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    selection,
    classPartials,
    assignmentDefinitionPartials,
    classFull,
    classFullQuery,
    analyserResult,
    mergedResult,
    mergedPreview,
    error,
    surfaceState,
    selectClass,
    changeTopics,
    changeAssignments,
    isRefreshing,
    refetch,
  };
}
