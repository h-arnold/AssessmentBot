/**
 * Canonical-record fixture primitives shared by the frontend unit fixtures.
 *
 * The task-preview and assignment-schema fixtures both select realistic
 * records from the committed synthetic `small` profile and then freeze,
 * guard and narrow them. Those primitives live here, once, rather than in
 * each domain fixture module.
 *
 * @remarks
 * Record loading stays at the call site, and it is deliberately NOT shared:
 * the unit layer imports the committed views as raw text (`?raw`) and parses
 * them, while the Playwright E2E layer imports the same JSON directly. That
 * raw-vs-direct split is a real constraint of the two runners (see
 * `e2e-tests/helpers/task-preview-source-link-fixtures.ts`), so only the
 * primitives — never the transport read — are consolidated here.
 */

import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';

/**
 * Deep-freeze a selected canonical record so any in-place mutation fails
 * loudly instead of leaking across suites.
 *
 * @template T - Type of the value being frozen.
 * @param {T} value - The record to freeze.
 * @returns {T} The same record, with every reachable object frozen.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  for (const propertyValue of Object.values(value)) {
    deepFreeze(propertyValue);
  }
  return Object.freeze(value);
}

/**
 * Read one record from a parsed transport view, failing loudly when absent.
 *
 * @param {Record<string, unknown>} view - Parsed transport view keyed by record ID.
 * @param {string} recordId - ID of the record to select.
 * @param {string} viewName - View name quoted in the failure message.
 * @returns {unknown} The selected raw record.
 */
export function requireRecord(
  view: Record<string, unknown>,
  recordId: string,
  viewName: string
): unknown {
  const record = view[recordId];
  if (record == null) {
    throw new Error(
      `canonicalFixturePrimitives: record "${recordId}" is absent from the small synthetic ${viewName} view.`
    );
  }
  return record;
}

/** Submission record carried by a canonical `AssignmentFull` payload. */
export type CanonicalSubmission = AssignmentFull['submissions'][number];

/** Submission item carried by a canonical submission. */
export type CanonicalSubmissionItem = CanonicalSubmission['items'][string];

/**
 * Read the TEXT body of a submission item's artifact, failing loudly
 * otherwise.
 *
 * @param {CanonicalSubmissionItem} item - The submission item to read.
 * @param {string} owner - Owner label quoted in the failure message.
 * @returns {string} The TEXT artifact body.
 */
export function requireTextArtifactContent(item: CanonicalSubmissionItem, owner: string): string {
  if (item.artifact.type !== 'TEXT' || typeof item.artifact.content !== 'string') {
    throw new Error(
      `canonicalFixturePrimitives: ${owner} / ${item.taskId} does not carry a TEXT body the preview suites expect.`
    );
  }
  return item.artifact.content;
}
