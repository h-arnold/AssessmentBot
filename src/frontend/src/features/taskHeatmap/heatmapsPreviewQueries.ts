import {
  skipToken,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { AssignmentFull } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentPreviewInput } from './assembleMergedPreviewData';
import { buildCellPreviewLookup, type CellPreviewLookup } from './buildCellPreviewLookup';

/**
 * Shared empty lookup used when an assignment has no usable preview payload.
 *
 * `CellPreviewLookup` is a `ReadonlyMap`, so the compile-time type already
 * forbids mutation; this module-level `EMPTY_LOOKUP` is never written to by
 * production code, so `Object.freeze` is unnecessary. (Note the frozen
 * `NOT_ATTEMPTED_METRIC` precedent in `heatmapAdapter.ts` freezes a plain
 * object, where freeze genuinely protects the fields — unlike a Map, whose
 * `set`/`delete` internal slots ignore `Object.freeze`.) Keeping the shared
 * constant preserves referential stability for the no-preview branch.
 */
const EMPTY_LOOKUP: CellPreviewLookup = new Map();

/**
 * Build a disabled `UseQueryOptions` that never runs (uses `skipToken`).
 *
 * @param {QueryKey} queryKey - The stable query key for the disabled state.
 * @returns {UseQueryOptions<T, Error>} A query-options object pinned to `skipToken`.
 *
 * @remarks
 * Both the per-class and per-assignment query lists use this for their
 * no-selection / no-class disabled branch so the only `skipToken` widening lives
 * in one place.
 */
export function buildDisabledQueryOptions<T>(queryKey: QueryKey): UseQueryOptions<T, Error> {
  return {
    queryKey,
    queryFn: skipToken,
  } satisfies UseQueryOptions<T, Error>;
}

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
type AssignmentPreviewResult = Readonly<{
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
 * The enriched `AssignmentFull` lookup is built whenever `data` is present; the
 * transport contract validates its required embedded `assignmentDefinition`
 * fields before this data reaches the hook.
 */
export function buildPreviewInput(
  assignmentId: string,
  queryResult: AssignmentPreviewResult
): AssignmentPreviewInput {
  const data = queryResult.data;
  const lookup: CellPreviewLookup = data == null ? EMPTY_LOOKUP : buildCellPreviewLookup(data);
  return {
    assignmentId,
    lookup,
    isLoading: queryResult.isPending,
    hasError: queryResult.isError,
  };
}
