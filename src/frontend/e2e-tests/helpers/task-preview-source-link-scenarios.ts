/**
 * Runtime scenario construction for the issue #19 Section 4 Playwright source-link
 * walkthroughs.
 *
 * @remarks
 * Queues reuse `shared/endToEndRuntimeMocks.ts` rather than a competing mock, and
 * every canonical `getAssignment` entry is owned here in the verified FIFO order.
 * The request stream was observed at argument level before these queues were
 * written: the embedded Class page warms `assignment-2-3`, `assignment-2-2` then
 * `assignment-2-1`, and the standalone builder requests one document per selected
 * assignment. No queue groups two responses per assignment in an order the app does
 * not actually request.
 *
 * Siblings: `task-preview-source-link-fixtures.ts` owns canonical record selection,
 * `task-preview-source-link-expectations.ts` derives URLs and cell selections, and
 * `task-preview-source-link-helpers.ts` owns locators, navigation, popup capture and
 * the theme and pointer helpers.
 */

import type { ResponseItem, RuntimeScenario } from '../shared/endToEndRuntimeMocks';
import {
  CANONICAL_CLASS,
  CANONICAL_CLASS_PARTIAL,
  CANONICAL_DEFINITION_PARTIALS,
  CANONICAL_SHEETS_ASSIGNMENT,
  CANONICAL_SLIDES_ASSIGNMENT,
  CANONICAL_YEAR_GROUPS,
} from './task-preview-source-link-fixtures';
import type { AssignmentFull } from '../../src/services/assignmentAssessment/assignmentAssessment.zod';

// ---------------------------------------------------------------------------
// Queue sizes
// ---------------------------------------------------------------------------

// Startup and reference-data queue sizes. Extra entries are never consumed;
// a missing entry fails the call, so these are sized generously.
const STARTUP_QUEUE_REPEATS = 4;
const REFERENCE_DATA_QUEUE_REPEATS = 10;
const DEFINITION_PARTIALS_QUEUE_REPEATS = 14;
const CLASS_QUEUE_REPEATS = 8;

/**
 * Entries answered for the journey assignment of an embedded journey.
 *
 * @remarks
 * A failure needs two entries because the heatmap's own query retries after the
 * Class page's warm-up prefetch rejected; readiness and deferral need one.
 */
const JOURNEY_FAILURE_RESPONSE_REPEATS = 2;
const JOURNEY_DEFAULT_RESPONSE_REPEATS = 2;

// ---------------------------------------------------------------------------
// Scenario construction
// ---------------------------------------------------------------------------

/**
 * Build one success response entry.
 *
 * @param {unknown} data - The response payload.
 * @returns {ResponseItem} The success entry.
 */
function success(data: unknown): ResponseItem {
  return { kind: 'success', data };
}

/**
 * Build a StrictMode-safe failure entry for the journey assignment.
 *
 * @returns {ResponseItem} The failure entry.
 */
function assignmentFailure(): ResponseItem {
  return {
    kind: 'failureEnvelope',
    code: 'INTERNAL_ERROR',
    message: 'Assignment load failed',
  };
}

/**
 * Repeat one response entry into a fresh array.
 *
 * @param {ResponseItem} entry - The response entry to repeat.
 * @param {number} count - The number of copies.
 * @returns {ResponseItem[]} The repeated entries.
 */
function repeat(entry: ResponseItem, count: number): ResponseItem[] {
  return Array.from({ length: count }, () => ({ ...entry }));
}

/** How the journey assignment of an embedded journey must answer. */
export type JourneyResponseKind = 'success' | 'deferredSuccess' | 'failure';

/** Per-queue customisation for an embedded Class-page journey. */
export interface EmbeddedAssignmentQueueOptions {
  /** Assignment served for the journey heatmap (default: canonical Slides). */
  journeyAssignment?: AssignmentFull;
  /** How the journey assignment answers (default: ready success). */
  journeyResponseKind?: JourneyResponseKind;
}

/**
 * Build the embedded Class-page `getAssignment` queue in verified request order.
 *
 * @remarks
 * `useClassPageData` warms the three most recent assignments top-down by
 * `updatedAt`, and the queue is FIFO, so it must answer `assignment-2-3`,
 * `assignment-2-2`, then `assignment-2-1`. The heatmap the journey opens then
 * reuses the `assignment-2-1` entry from the React Query cache rather than
 * issuing a fourth call. Grouping two responses per assignment would misalign
 * that stream, so each request is answered once and only the journey slot is
 * repeated where a replay genuinely occurs.
 *
 * The `assignment-2-3` warm-up slot is answered with `null`, because that
 * assignment has no canonical full record (the fixture module asserts that
 * absence when it selects the canonical records). `getAssignment` accepts `null`
 * as its documented not-found result, the prefetch is fire-and-forget, and no
 * journey source is derived from that cache entry — so `null` is the truthful
 * answer, whereas serving another assignment under a rewritten id would not be.
 *
 * @param {EmbeddedAssignmentQueueOptions} [options] - Queue customisation.
 * @returns {ResponseItem[]} The embedded `getAssignment` queue.
 */
export function createEmbeddedAssignmentQueue(
  options: EmbeddedAssignmentQueueOptions = {}
): ResponseItem[] {
  const { journeyAssignment = CANONICAL_SLIDES_ASSIGNMENT, journeyResponseKind = 'success' } =
    options;

  const journeyEntries =
    journeyResponseKind === 'failure'
      ? repeat(assignmentFailure(), JOURNEY_FAILURE_RESPONSE_REPEATS)
      : repeat(
          { kind: journeyResponseKind, data: journeyAssignment },
          JOURNEY_DEFAULT_RESPONSE_REPEATS
        );

  return [success(null), success(CANONICAL_SHEETS_ASSIGNMENT), ...journeyEntries];
}

/** Per-queue customisation for a standalone merged Heatmaps journey. */
export interface MergedAssignmentQueueOptions {
  /** Assignment served for the first selected assignment (default: Slides). */
  slidesAssignment?: AssignmentFull;
  /** Assignment served for the second selected assignment (default: Sheets). */
  sheetsAssignment?: AssignmentFull;
}

/**
 * Build the standalone Heatmaps `getAssignment` queue in verified request order.
 *
 * @remarks
 * The merged builder requests one document per selected assignment, in
 * selection order, and React Query deduplicates the StrictMode replay, so the
 * queue carries exactly two entries — one per selected assignment.
 *
 * @param {MergedAssignmentQueueOptions} [options] - Queue customisation.
 * @returns {ResponseItem[]} The merged `getAssignment` queue.
 */
export function createMergedAssignmentQueue(
  options: MergedAssignmentQueueOptions = {}
): ResponseItem[] {
  const {
    slidesAssignment = CANONICAL_SLIDES_ASSIGNMENT,
    sheetsAssignment = CANONICAL_SHEETS_ASSIGNMENT,
  } = options;

  return [success(slidesAssignment), success(sheetsAssignment)];
}

/** Optional per-method queue overrides for a source-link scenario. */
export type SourceLinkScenarioOverrides = Readonly<{
  /** Replaces the default `getAssignment` queue. */
  getAssignment?: ReadonlyArray<ResponseItem>;
}>;

/**
 * Build the canonical source-link runtime scenario.
 *
 * @param {SourceLinkScenarioOverrides} [overrides] - Per-method queue overrides.
 * @returns {RuntimeScenario} The configured runtime scenario.
 */
export function createSourceLinkScenario(
  overrides: SourceLinkScenarioOverrides = {}
): RuntimeScenario {
  return {
    getAuthorisationStatus: repeat(success(true), STARTUP_QUEUE_REPEATS),
    getABClassPartials: repeat(success([CANONICAL_CLASS_PARTIAL]), REFERENCE_DATA_QUEUE_REPEATS),
    getABClass: repeat(success(CANONICAL_CLASS), CLASS_QUEUE_REPEATS),
    getCohorts: repeat(success([]), REFERENCE_DATA_QUEUE_REPEATS),
    getYearGroups: repeat(success(CANONICAL_YEAR_GROUPS), REFERENCE_DATA_QUEUE_REPEATS),
    getAssignmentTopics: repeat(success([]), REFERENCE_DATA_QUEUE_REPEATS),
    getAssignmentDefinitionPartials: repeat(
      success(CANONICAL_DEFINITION_PARTIALS),
      DEFINITION_PARTIALS_QUEUE_REPEATS
    ),
    getAssignment: createEmbeddedAssignmentQueue(),
    ...overrides,
  };
}
