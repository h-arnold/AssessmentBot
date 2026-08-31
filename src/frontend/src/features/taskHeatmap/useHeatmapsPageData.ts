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
 * to honour the 500-LOC split gate per `src/frontend/AGENTS.md` §3.3 and
 * `src/backend/AGENTS.md` §11):
 *
 * - `heatmapsSurfaceState.ts` — pure surface-state / blocking-error derivation.
 * - `heatmapsPipeline.ts` — pure analyser + merged-adapter pipeline.
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
 * **Memoisation.** The analyser/adapter pipeline memo key includes
 * `selectedAssignmentIds` (joined) as well as `classId`, `classFull`, and
 * `assignmentDefinitionPartials`. `classId` and `selectedAssignmentIds` both feed
 * the analyser input, so omitting either would reuse stale results when the
 * selection changes without `classFull` changing — this is the staleness-guard
 * analogue to `useClassPageData`'s `classId`-in-key note.
 *
 * **Per-assignment preview queries.** Enabled only for currently selected
 * assignments. They are driven through `useQueries` (a single hook call over the
 * selection array) so the dynamic list of queries never violates the React
 * rules-of-hooks invariant that `useQuery` must not be called inside a loop.
 */

import { useCallback, useMemo, useReducer } from 'react';
import { flushSync } from 'react-dom';
import {
  skipToken,
  useQueries,
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { getABClassQueryOptions, getAssignmentQueryOptions } from '../../query/sharedQueries';
import { queryKeys } from '../../query/queryKeys';
import { usePageDataset } from '../../hooks/usePageDataset';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassPartial } from '../../services/googleClassrooms/classPartialsService';
import type { MergedHeatmapResult } from '../../services/dataAnalysis/heatmapAdapter';
import {
  selectionCascadeReducer,
  INITIAL_SELECTION_STATE,
  type SelectionState,
} from './selectionCascade';
import {
  assembleMergedPreviewData,
  type AssignmentPreviewInput,
  type MergedPreviewAssemblyResult,
} from './assembleMergedPreviewData';
import { buildCellPreviewLookup, type CellPreviewLookup } from './buildCellPreviewLookup';
import { shouldRunHeatmapsPipeline, runHeatmapsPipeline } from './heatmapsPipeline';
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
  /** `true` while a manual refresh is in flight (accessible busy semantics). */
  isRefreshing: boolean;
  /** Manual refresh: re-runs class query + ADP dataset + enabled assignment queries. */
  refetch: () => void;
}>;

/** Fallback projected preview payload used when an index is out of range. */
const FALLBACK_ASSIGNMENT_QUERY: AssignmentPreviewResult = {
  assignmentId: '',
  data: null,
  isPending: false,
  isError: false,
};

/** Shared empty lookup used when an assignment has no usable preview payload. */
const EMPTY_LOOKUP: CellPreviewLookup = new Map();

/**
 * Minimal per-assignment query state consumed when assembling the merged preview.
 *
 * @remarks
 * This is the projected shape the `useQueries` `combine` callback returns for each
 * selected assignment. `useQueries` applies `replaceEqualDeep` structural sharing to
 * the combined result, so this payload is referentially stable when the underlying
 * query data and status are deep-equal — which is what lets the `mergedPreview` memo
 * key on it without a manual signature and without re-running on every render.
 */
export type AssignmentPreviewResult = Readonly<{
  /** The contributing assignment identifier. */
  assignmentId: string;
  /** Whether this assignment's full-read query is still pending. */
  isPending: boolean;
  /** Whether this assignment's full-read query errored. */
  isError: boolean;
  /** The full-read payload (null when absent). */
  data: AssignmentFull | null;
}>;

/**
 * Combined output of the per-selected-assignment `useQueries` `combine` callback.
 *
 * Exposes the minimal projected preview payloads (referentially stable) plus the raw
 * per-assignment `UseQueryResult`s needed for `refetch`/`isRefreshing` wiring.
 */
export type AssignmentPreviewCombined = Readonly<{
  /** Minimal projected preview payloads, one per selected assignment. */
  previewResults: ReadonlyArray<AssignmentPreviewResult>;
  /** Raw per-assignment query results (for refetch / busy derivation). */
  rawResults: ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>;
}>;

/**
 * Build a per-assignment preview input from its projected query state.
 *
 * @param {string} assignmentId - The assignment identifier.
 * @param {AssignmentPreviewResult} queryResult - The projected assignment query state.
 * @returns {AssignmentPreviewInput} The preview input (lookup built defensively).
 *
 * @remarks
 * The enriched `AssignmentFull` lookup is built only when the embedded
 * `assignmentDefinition` is present. A missing `assignmentDefinition` means no usable
 * preview payload for this assignment, so we degrade to an empty lookup (the popover
 * simply shows no preview) rather than throwing and blanking the whole merged surface.
 */
function buildPreviewInput(
  assignmentId: string,
  queryResult: AssignmentPreviewResult
): AssignmentPreviewInput {
  const data = queryResult.data;
  let lookup: CellPreviewLookup = EMPTY_LOOKUP;
  if (data != null && (data as AssignmentFull).assignmentDefinition != null) {
    lookup = buildCellPreviewLookup(data as AssignmentFull);
  }
  return {
    assignmentId,
    lookup,
    isLoading: queryResult.isPending,
    hasError: queryResult.isError,
  };
}

/**
 * Derive the global refresh-busy signal from the owned query families.
 *
 * @param {UseQueryResult<ClassFull | null, Error>} classFullQuery - The per-class query.
 * @param {UseQueryResult<AssignmentDefinitionPartialsResponse>} adpQuery - The ADP dataset query.
 * @param {ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>} assignmentQueryResults - Per-assignment queries.
 * @returns {boolean} `true` while any owned query is fetching.
 */
function deriveIsRefreshing(
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
 * Data orchestrator hook for the standalone Heatmaps surface.
 *
 * @returns {HeatmapsPageData} Typed data result with surface state and selection actions.
 */
export function useHeatmapsPageData(): HeatmapsPageData {
  // -----------------------------------------------------------------------
  // 0. Selection state (reducer-owned, no auto-selections)
  // -----------------------------------------------------------------------

  const [selection, dispatch] = useReducer(selectionCascadeReducer, INITIAL_SELECTION_STATE);

  // Selection actions wrap the reducer dispatch in `flushSync` so the selection
  // state is applied synchronously. This keeps the surface consistent for
  // programmatic/hook-driven callers (and avoids React's deferred-update behaviour
  // outside an event-handler act boundary) — in the browser, user events already
  // flush, so this is a no-op cost there but guarantees immediate consistency.
  const selectClass = useCallback((classId: string | null): void => {
    flushSync(() => {
      dispatch({ type: 'selectClass', classId });
    });
  }, []);

  const changeTopics = useCallback(
    (topicKeys: readonly string[], assignmentTopicKeys: ReadonlyMap<string, string>): void => {
      flushSync(() => {
        dispatch({ type: 'changeTopics', topicKeys, assignmentTopicKeys });
      });
    },
    []
  );

  const changeAssignments = useCallback((assignmentIds: readonly string[]): void => {
    flushSync(() => {
      dispatch({ type: 'changeAssignments', assignmentIds });
    });
  }, []);

  const { classId, assignmentIds: selectedAssignmentIds } = selection;

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
      ? ({
          queryKey: queryKeys.abClass('__none__'),
          queryFn: skipToken,
        } as unknown as UseQueryOptions<ClassFull | null, Error>)
      : (getABClassQueryOptions(classId) as unknown as UseQueryOptions<ClassFull | null, Error>);
  const classFullQuery: UseQueryResult<ClassFull | null, Error> = useQuery<ClassFull | null, Error>(
    classQueryOptions
  );
  const classFull: ClassFull | null = classFullQuery.data ?? null;

  // -----------------------------------------------------------------------
  // 3. Pipeline guard — dataset trust check BEFORE running analyser/adapter
  // -----------------------------------------------------------------------

  const shouldRunPipeline: boolean = useMemo<boolean>(
    () => shouldRunHeatmapsPipeline(classFull, selectedAssignmentIds, adpDatasetState),
    [classFull, selectedAssignmentIds, adpDatasetState]
  );

  // -----------------------------------------------------------------------
  // 4-5. Analyser + merged-adapter pipeline (synchronous, memoised)
  // -----------------------------------------------------------------------

  const [analyserResult, analyserError, mergedResult, adapterError] = useMemo<
    readonly [AveragingResult | null, Error | null, MergedHeatmapResult | null, Error | null]
  >(
    () =>
      shouldRunPipeline
        ? runHeatmapsPipeline(
            classFull,
            assignmentDefinitionPartials,
            classId,
            selectedAssignmentIds
          )
        : [null, null, null, null],
    [shouldRunPipeline, classFull, assignmentDefinitionPartials, classId, selectedAssignmentIds]
  );

  // -----------------------------------------------------------------------
  // 6. Per-selected-assignment preview queries (enablement keyed to selection)
  // -----------------------------------------------------------------------

  // Per-selected-assignment preview queries. They are driven through `useQueries` (a single hook
  // call over the selection array) so the dynamic list of queries never violates the React
  // rules-of-hooks invariant that `useQuery` must not be called inside a loop.
  //
  // The `combine` callback projects each per-assignment `UseQueryResult` into the minimal
  // `AssignmentPreviewResult` payload the merged-preview assembly actually consumes. React Query
  // applies `replaceEqualDeep` structural sharing to the combined value, so
  // `assignmentPreviewCombined` is referentially stable when the underlying query data and status
  // are deep-equal — the merged-preview memo keys on it (plus `mergedResult` and
  // `selectedAssignmentIds`) without a manual per-render signature, and only rebuilds the
  // expensive merged-lookup Map when a per-assignment payload or status genuinely changes. The raw
  // `UseQueryResult`s are also surfaced (under `rawResults`) for `refetch` / busy derivation.
  const assignmentPreviewCombined: AssignmentPreviewCombined = useQueries({
    queries: selectedAssignmentIds.map(
      (assignmentId: string): UseQueryOptions<AssignmentFull | null, Error> => {
        const options: UseQueryOptions<AssignmentFull | null, Error> =
          classId === null
            ? ({
                ...getAssignmentQueryOptions('__none__', assignmentId),
                queryFn: skipToken,
              } as unknown as UseQueryOptions<AssignmentFull | null, Error>)
            : (getAssignmentQueryOptions(
                classFull?.classId ?? classId,
                assignmentId
              ) as unknown as UseQueryOptions<AssignmentFull | null, Error>);
        return options;
      }
    ),
    combine: (
      results: ReadonlyArray<UseQueryResult<AssignmentFull | null, Error>>
    ): AssignmentPreviewCombined => ({
      previewResults: results.map((result, index: number) => ({
        assignmentId: selectedAssignmentIds[index] ?? '',
        isPending: result.isPending,
        isError: result.isError,
        data: result.data ?? null,
      })),
      rawResults: results,
    }),
  });

  // -----------------------------------------------------------------------
  // 7. Merged preview lookup + status assembly
  // -----------------------------------------------------------------------

  const mergedPreview: MergedPreviewAssemblyResult | null =
    useMemo<MergedPreviewAssemblyResult | null>(() => {
      if (mergedResult === null) {
        return null;
      }
      const inputs = selectedAssignmentIds.map((assignmentId: string, index: number) =>
        buildPreviewInput(
          assignmentId,
          assignmentPreviewCombined.previewResults[index] ?? FALLBACK_ASSIGNMENT_QUERY
        )
      );
      return assembleMergedPreviewData(inputs, mergedResult.taskColumns);
    }, [mergedResult, selectedAssignmentIds, assignmentPreviewCombined]);

  // -----------------------------------------------------------------------
  // 8. Surface state — error precedence, then loading, then ready
  // -----------------------------------------------------------------------

  const surfaceState: HeatmapsSurfaceState = useMemo<HeatmapsSurfaceState>(
    () =>
      computeHeatmapsSurfaceState(
        classId,
        classFull,
        classFullQuery.isSuccess,
        classFullQuery.isError,
        classFullQuery.error,
        classFullQuery.isPending,
        adpDatasetState,
        analyserError,
        adapterError
      ),
    [
      classId,
      classFull,
      classFullQuery.isSuccess,
      classFullQuery.isError,
      classFullQuery.error,
      classFullQuery.isPending,
      adpDatasetState,
      analyserError,
      adapterError,
    ]
  );

  const error: HeatmapsPageError | null =
    surfaceState.status === 'blocking' ? surfaceState.error : null;

  // -----------------------------------------------------------------------
  // 9. Refresh — re-run class query, ADP dataset, and enabled assignment queries
  // -----------------------------------------------------------------------

  const isRefreshing: boolean = deriveIsRefreshing(
    classFullQuery,
    adpQuery,
    assignmentPreviewCombined.rawResults
  );

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
