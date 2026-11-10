/**
 * Pure helper functions for {@link useClassPageData}.
 *
 * Extracted from `useClassPageData.ts` to keep that file under the 500-line
 * threshold.  These are pure functions with no React dependencies, safe to
 * extract into a sibling module.
 *
 * @see useClassPageData
 */

import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { computeDatasetBlockingReason, type PageDatasetState } from '@/hooks/usePageDataset';
import {
  BASELINE_ROSTER_MINIMUM,
  collectRosterAttemptCandidates,
  isAttemptBaselineEligible,
} from '@/services/dataAnalysis/analysers/attemptBaselineSelection';
import type { AveragingResult } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * Availability of the attempt-baseline analysis mode on the Class page
 * (attempt-baseline specification decision 6).
 *
 * - `ready`: both eligibility conditions hold — the control is enabled.
 * - `awaiting-data`: no usable attempt evidence yet (no successful analysis
 *   result in this mount, a result without `perStudentTaskMetrics`, or no
 *   class roster). Never produced by an eligibility failure.
 * - `ineligible`: the class cannot use baseline mode; `reason` names the
 *   unmet condition.
 *
 * `reason` is the display copy feeding the mode control's tooltip and its
 * sr-only description node; it is populated for both disabled statuses and
 * `null` only for `ready`.
 */
export type BaselineAvailability = Readonly<{
  status: 'ready' | 'awaiting-data' | 'ineligible';
  reason: string | null;
}>;

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
export function isClassPageLoading(
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

// ---------------------------------------------------------------------------
// Attempt-baseline availability (specification decision 6)
// ---------------------------------------------------------------------------

/** Neutral copy for the awaiting-data availability state. */
const AWAITING_DATA_REASON = 'Waiting for class data';

/** Ineligibility copy when the roster is below the three-student minimum. */
const ROSTER_REASON = 'Baseline mode needs at least 3 students in this class';

/** Ineligibility copy when fewer than two students attempted work. */
const ENGAGED_STUDENTS_REASON = 'Baseline mode needs at least 2 students who attempted some work';

/**
 * Resolve the Class page's attempt-baseline availability from the current
 * render state (decision 6).
 *
 * @param {AveragingResult | null} analyserResult - The current render's
 *   analyser result (null unless the pipeline succeeded this render).
 * @param {AveragingResult | null} retainedAnalyserResult - The last
 *   successful analyser result retained across renders (previous-render
 *   pattern); supplies attempt evidence only when `analyserResult` is null.
 * @param {ClassFull | null} classFull - The current class roster.
 * @returns {BaselineAvailability} The availability status and display reason.
 *
 * @remarks
 * Availability resolves to `'awaiting-data'` whenever either input is absent —
 * including a shape-legal result whose optional `perStudentTaskMetrics` field
 * is missing — because absence never produces `'ineligible'`. Eligibility is
 * composed from the shared attempt predicate and eligibility helper over the
 * evidence's `perStudentTaskMetrics` and the current roster.
 */
export function resolveBaselineAvailability(
  analyserResult: AveragingResult | null,
  retainedAnalyserResult: AveragingResult | null,
  classFull: ClassFull | null
): BaselineAvailability {
  // The current render's successful result always wins; the retained state
  // supplies attempt evidence only when the current render's result is null.
  const evidence = analyserResult ?? retainedAnalyserResult;
  if (classFull === null || evidence?.perStudentTaskMetrics === undefined) {
    return { status: 'awaiting-data', reason: AWAITING_DATA_REASON };
  }

  const rosterStudentIds = classFull.students.map((student) => student.id);
  const candidateStudentIds = collectRosterAttemptCandidates(
    evidence.perStudentTaskMetrics,
    rosterStudentIds
  );

  if (!isAttemptBaselineEligible(rosterStudentIds.length, candidateStudentIds.length)) {
    // Eligibility fails only on the two conditions below; when the roster
    // condition holds, the engaged-students condition is the unmet one.
    const reason =
      rosterStudentIds.length < BASELINE_ROSTER_MINIMUM ? ROSTER_REASON : ENGAGED_STUDENTS_REASON;
    return { status: 'ineligible', reason };
  }

  return { status: 'ready', reason: null };
}
