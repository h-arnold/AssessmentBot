/**
 * Scenario plumbing for the legacy-assignment browser journeys.
 *
 * @remarks
 * Owns the rerun-capable scenario overrides, the Class page warm-up queue and
 * the shared navigation/locator helpers used by
 * `legacy-assignment-results.spec.ts`, so the spec keeps only the journeys
 * themselves. Queues reuse `shared/endToEndRuntimeMocks.ts` and the canonical
 * `medium` fixtures through `assessment-error-preview-journeys.ts`; no
 * competing mock or fixture is built here.
 *
 * @see docs/developer/frontend/frontend-playwright-e2e.md
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { type Locator, type Page } from '@playwright/test';
import type { ResponseItem, RuntimeScenario } from '../shared/endToEndRuntimeMocks';
import {
  canonicalAssignment,
  cellLabel,
  type ErrorPreviewOverrides,
  JOURNEY_TASK_ID,
  openEmbeddedHeatmap,
  openErrorClass,
  taskTitle,
  withLegacyAssignment,
  withLegacyClassAssignment,
} from './assessment-error-preview-journeys';

/** Assignment the legacy journeys open. */
export const LEGACY_ASSIGNMENT_ID = 'assignment-2-4';

/**
 * Current-version sibling opened beside the legacy assignment.
 *
 * @remarks
 * Recent Assignments only lists the three newest assignments, so the sibling
 * has to be one of them to have a card. `assignment-2-3` is the third of those
 * and its warmed full read is its own canonical record.
 */
export const SIBLING_ASSIGNMENT_ID = 'assignment-2-3';
/** Task of the sibling assignment the journey reads. */
const SIBLING_TASK_ID = 'task-3-0';

/** Student whose saved legacy submission carries the corrupt-item E. */
export const LEGACY_STUDENT_NAME = 'Taylor Yundt-Hermiston';
/** Student whose saved legacy submission is healthy across all criteria. */
export const HEALTHY_STUDENT_NAME = 'Bryon Medhurst';
/** Healthy legacy student whose source is a TEXT artefact. */
export const HEALTHY_TEXT_STUDENT_NAME = 'Ressie Harber';

/** Rendered task title of the opened legacy assignment. */
export const JOURNEY_TITLE = taskTitle(LEGACY_ASSIGNMENT_ID, JOURNEY_TASK_ID);
/** Rendered task title of the sibling assignment. */
export const SIBLING_TITLE = taskTitle(SIBLING_ASSIGNMENT_ID, SIBLING_TASK_ID);

/**
 * Entries served for `getABClass` when the journey also overrides
 * `getAssignment`.
 */
const CLASS_READ_QUEUE_LENGTH = 6;

/**
 * Extra `getAssignment` copies served after the warm-up slots so later
 * refetches on the same query key still resolve.
 */
const TRAILING_REFETCH_READS = 3;

/**
 * `getABClass` reads the removal journey consumes before its Refresh: the
 * class page load issues one class read, and opening the embedded heatmap and
 * the rerun modal issue none (measured with `getMethodCalls`).
 */
const PRE_REFRESH_CLASS_READS = 1;

/** `getABClass` reads the removal journey's Refresh consumes. */
const REFRESH_CLASS_READS = 1;

/**
 * Repeat one payload into a success queue.
 * @param {unknown} data - The payload to serve.
 * @returns {ResponseItem[]} The success entries.
 */
export function successQueue(data: unknown): ResponseItem[] {
  const entry: ResponseItem = { kind: 'success', data };
  return Array.from({ length: CLASS_READ_QUEUE_LENGTH }, () => ({ ...entry }));
}

/**
 * Build the `getAssignment` queue in the Class page's warm-up order.
 *
 * @remarks
 * `useClassPageAssignmentPrefetch` warms `assignment-2-5`, `assignment-2-4` and
 * `assignment-2-3`, so the queue serves those slots in that order. The opened
 * assignment's prefetch read fills the same query key the embedded heatmap
 * reads, so its payload must sit in slot 2. The `medium` corpus has no full
 * record for `assignment-2-5`, so slot 1 is answered with another valid
 * canonical record; no journey reads that cache entry's content.
 *
 * @param {ResponseItem} openedAssignment - The entry for the opened assignment.
 * @returns {ResponseItem[]} The ordered `getAssignment` queue.
 */
export function warmUpQueue(openedAssignment: ResponseItem): ResponseItem[] {
  const filler: ResponseItem = {
    kind: 'success',
    data: canonicalAssignment(SIBLING_ASSIGNMENT_ID),
  };
  return [
    filler,
    openedAssignment,
    filler,
    ...Array.from({ length: TRAILING_REFETCH_READS }, () => ({ ...openedAssignment })),
  ];
}

/**
 * Build the rerun journeys' class snapshot for one assignment marker.
 *
 * @remarks
 * The rerun flow refuses to start unless the class snapshot's assignment
 * carries its persisted definition key. The canonical class snapshot already
 * carries the selected assignment's `assignmentDefinitionKey`, and it resolves
 * to the definition partial whose task titles match the saved submissions, so
 * the heatmap renders identically. Only the selected assignment's marker
 * changes.
 *
 * @param {'legacy' | 1} assessmentContractVersion - Marker for the selected assignment.
 * @returns {Record<string, unknown>} The class wire payload for the rerun journeys.
 */
function rerunClassSnapshot(assessmentContractVersion: 'legacy' | 1): Record<string, unknown> {
  const draft = withLegacyClassAssignment(LEGACY_ASSIGNMENT_ID) as Record<string, unknown> & {
    assignments: Array<Record<string, unknown>>;
  };
  const target = draft.assignments.find((row) => row.assignmentId === LEGACY_ASSIGNMENT_ID);
  if (target === undefined) {
    throw new Error(`legacy-assignment-results: ${LEGACY_ASSIGNMENT_ID} is not in the class.`);
  }
  target.assessmentContractVersion = assessmentContractVersion;
  return draft;
}

/**
 * Build the Classroom listing queue the rerun modal fetches.
 *
 * @remarks
 * Opening the rerun modal fetches the Classroom listing before the
 * effect-driven start can run, and React StrictMode replays that fetch, so the
 * queue carries two identical entries for the one modal session. The listing
 * must contain the rerun assignment, or the flow blocks the start.
 *
 * @returns {ResponseItem[]} The `getGoogleClassroomAssignments` queue.
 */
function rerunClassroomQueue(): ResponseItem[] {
  const listing = [
    {
      assignmentId: LEGACY_ASSIGNMENT_ID,
      title: canonicalAssignment(LEGACY_ASSIGNMENT_ID).assignmentName,
      creationTime: null,
      topicId: null,
      topicName: null,
    },
  ];
  return [
    { kind: 'success', data: listing },
    { kind: 'success', data: listing },
  ];
}

/**
 * Build the removal journey's `getABClass` queue.
 *
 * @remarks
 * The initial load consumes the legacy reads; the post-rerun Refresh consumes
 * the marker-1 snapshot, which is what removes the tag.
 *
 * @returns {ResponseItem[]} The ordered `getABClass` queue.
 */
export function rerunClassQueue(): ResponseItem[] {
  const legacyRead: ResponseItem = { kind: 'success', data: rerunClassSnapshot('legacy') };
  const refreshedRead: ResponseItem = { kind: 'success', data: rerunClassSnapshot(1) };
  return [
    ...Array.from({ length: PRE_REFRESH_CLASS_READS }, () => ({ ...legacyRead })),
    ...Array.from({ length: REFRESH_CLASS_READS }, () => ({ ...refreshedRead })),
  ];
}

/**
 * Build the journey overrides for the legacy class snapshot and full read.
 *
 * @param {ResponseItem[]} [startAssessmentRun] - Optional rerun queue.
 * @param {ResponseItem[]} [classReads] - Optional replacement `getABClass` queue.
 * @returns {ErrorPreviewOverrides & Pick<RuntimeScenario, 'startAssessmentRun' | 'getGoogleClassroomAssignments'>} The `openErrorClass` overrides.
 */
export function legacyOverrides(
  startAssessmentRun?: ResponseItem[],
  classReads?: ResponseItem[]
): ErrorPreviewOverrides &
  Pick<RuntimeScenario, 'startAssessmentRun' | 'getGoogleClassroomAssignments'> {
  return {
    getABClass: classReads ?? successQueue(withLegacyClassAssignment(LEGACY_ASSIGNMENT_ID)),
    getAssignment: warmUpQueue({
      kind: 'success' as const,
      data: withLegacyAssignment(LEGACY_ASSIGNMENT_ID),
    }),
    ...(startAssessmentRun !== undefined && {
      getGoogleClassroomAssignments: rerunClassroomQueue(),
      startAssessmentRun,
    }),
  };
}

/**
 * Open the legacy assignment's embedded heatmap.
 * @param {Page} page - The Playwright page.
 * @param {ResponseItem[]} [startAssessmentRun] - Optional rerun queue.
 * @param {ResponseItem[]} [classReads] - Optional replacement `getABClass` queue.
 * @returns {Promise<void>} Resolves once the heatmap table is visible.
 */
export async function openLegacyHeatmap(
  page: Page,
  startAssessmentRun?: ResponseItem[],
  classReads?: ResponseItem[]
): Promise<void> {
  await openErrorClass(page, legacyOverrides(startAssessmentRun, classReads));
  await openEmbeddedHeatmap(page, LEGACY_ASSIGNMENT_ID);
}

/**
 * Locate the healthy legacy completeness cell.
 * @param {Page} page - The Playwright page.
 * @returns {Locator} The metric cell trigger.
 */
export function healthyCell(page: Page): Locator {
  return page.getByRole('button', {
    name: cellLabel(HEALTHY_STUDENT_NAME, JOURNEY_TITLE, 'completeness', '3'),
  });
}
