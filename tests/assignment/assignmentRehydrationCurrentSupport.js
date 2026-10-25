/**
 * Shared fixture and assertion helpers for current-format assignment rehydration tests.
 *
 * The fixture is the committed canonical synthetic `small` profile's full
 * `assignmentsByKey` view entry. Each loader call clones the frozen view, stamps
 * the current assessment contract marker, and canonicalises item assessment maps
 * (completing the cut-over maps and representing null-document items as the
 * canonical acquisition placeholders) through the synthetic validation family
 * helper. No registry or controller materialisation is involved; the record's
 * own embedded keyed `assignmentDefinition` snapshot is the task universe.
 */

import { expect } from 'vitest';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
import { Assessment } from '#backend/Models/Assessment.js';
import { canonicalisePersistence } from '../synthetic-analysis/syntheticAssessmentValidationSupport.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';

/** The three assessment criteria in canonical order. */
export const CRITERIA = ['completeness', 'accuracy', 'spag'];

/** Canonical assignment (with populated submissions) used by every current-format case. */
export const CURRENT_ASSIGNMENT_ID = 'assignment-0-1';
/** The two embedded definition task keys shared by every canonical submission. */
export const KNOWN_TASK_IDS = ['task-1-0', 'task-1-1'];
export const HEAD_TASK_ID = 'task-1-0';
export const SIBLING_TASK_ID = 'task-1-1';
export const DOCUMENT_SUBMISSION_INDEX = 0;
export const NULL_DOCUMENT_SUBMISSION_INDEX = 2;

/**
 * Loads a fresh canonical current-format assignment record.
 *
 * @returns {Record<string, unknown>} Cloned, marker-stamped embedded-definition record.
 */
export function currentAssignmentJson() {
  const view = loadSyntheticAnalysisProfile('small', 'assignmentsByKey');
  const record = structuredClone(view[CURRENT_ASSIGNMENT_ID]);
  canonicalisePersistence({ assignments: [record] });
  if (!record.assignmentDefinition || record.assessmentContractVersion !== 1) {
    throw new Error('Current-format fixture could not be composed from the canonical view.');
  }
  return record;
}

/**
 * Clones the fixture, focuses restoration on the document-bearing submission.
 *
 * @param {Record<string, unknown>} record Current-format fixture record (mutated in focus).
 */
export function focusDocumentSubmission(record) {
  record.submissions = [record.submissions[DOCUMENT_SUBMISSION_INDEX]];
}

/** Serialised JSON of one stored item, for intact-sibling comparisons. */
export function storedItemJson(record, submissionIndex, taskId) {
  return structuredClone(record.submissions[submissionIndex].items[taskId]);
}

/**
 * Clones the fixture and corrupts one item of a submission via `mutator(itemJson)`.
 *
 * @param {number} submissionIndex Target submission index in the canonical record.
 * @param {string} taskId Item key to corrupt.
 * @param {(item: Record<string, unknown>) => void} mutator Applied mutation.
 * @returns {Record<string, unknown>} Corrupted current-format record.
 */
export function corruptedRecord(submissionIndex, taskId, mutator) {
  const record = currentAssignmentJson();
  mutator(record.submissions[submissionIndex].items[taskId]);
  return record;
}

/** Exact validation/CORRUPT_RECORD catalogue entry (fresh detached copy each call). */
export function corruptRecordEntry() {
  return Assessment.createError('validation', 'CORRUPT_RECORD').toJSON();
}

/** Full assessment map where all three criteria carry one entry shape (detached copies). */
export function assessmentEntriesAll(entryFactory) {
  return Object.fromEntries(
    CRITERIA.map((criterion, index) => [criterion, entryFactory(criterion, index)])
  );
}

/**
 * Composes a raw current-format partial embedded snapshot from a full record,
 * without invoking the restoration owner. The embedded definition becomes the
 * lightweight task-summary array, artefact bodies/hashes are explicitly
 * redacted, numeric reasoning is stripped (E-with-cause entries keep theirs),
 * and the current marker is stamped.
 *
 * @param {Record<string, unknown>} fullRecord Current full record (cloned, not mutated).
 * @returns {Record<string, unknown>} Raw partial embedded record.
 */
export function rawPartialEmbeddedSnapshot(fullRecord) {
  const record = structuredClone(fullRecord);
  const definition = structuredClone(record.assignmentDefinition);
  definition.tasks = Object.values(definition.tasks).map((task) => ({
    taskId: task.taskId ?? task.id,
    taskWeighting: task.taskWeighting,
    taskTitle: task.taskTitle,
  }));
  record.assignmentDefinition = definition;
  for (const key of ['tasks', 'referenceDocumentId', 'templateDocumentId']) delete record[key];
  record.assessmentContractVersion = 1;
  for (const submission of record.submissions) {
    for (const item of Object.values(submission.items)) {
      item.artifact.content = null;
      item.artifact.contentHash = null;
      for (const entry of Object.values(item.assessments)) {
        if (!(entry.score === 'E' && entry.error)) delete entry.reasoning;
      }
    }
  }
  return record;
}

/** All three criteria as the exact validation/CORRUPT_RECORD catalogue copies. */
export function corruptRecordAssessments() {
  return assessmentEntriesAll(corruptRecordEntry);
}

/** All three criteria as canonical acquisition/SOURCE_UNREADABLE catalogue copies. */
export function acquisitionAssessments() {
  return assessmentEntriesAll(() =>
    Assessment.createError('acquisition', 'SOURCE_UNREADABLE').toJSON()
  );
}

/**
 * Asserts the item is the materialised corrupt-record placeholder: every criterion
 * is the exact catalogue copy and stored feedback is cleared.
 *
 * @param {{assessments: Record<string, unknown>, feedback: unknown}} item Restored item.
 */
export function expectCorruptRecordPlaceholder(item) {
  expect(item, 'identified item must be materialised, never dropped').toBeDefined();
  expect(item.assessments).toEqual(corruptRecordAssessments());
  expect(item.feedback).toEqual({});
}

/**
 * Asserts the identified sibling item survived restoration byte-for-byte against
 * its previously captured stored JSON.
 *
 * @param {{items: Record<string, unknown>}} restoredSubmission Restored submission.
 * @param {unknown} beforeItemJson Stored JSON captured before restoration.
 */
export function expectSiblingIntact(restoredSubmission, beforeItemJson) {
  expect(restoredSubmission.items[SIBLING_TASK_ID].toJSON()).toEqual(beforeItemJson);
}

/** Convenience export so suites drive the real restoration surface in one place. */
export function restoreAssignment(record, mode) {
  return mode ? Assignment.fromJSON(record, mode) : Assignment.fromJSON(record);
}
