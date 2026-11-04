import { fail } from './invariantGuards.js';
import { requireItemRecord } from './validationRecordGuards.js';
import { assertAssessmentMap } from './assessmentEntryGuards.js';
import { assertItemArtefactSource } from './artefactSourceGuards.js';

/**
 * Submission coverage and per-item state orchestration for the persistence,
 * full-transport, and class-partial validators.
 *
 * @remarks
 * This module binds the criterion-entry and artefact-source guards to whole
 * submissions: item keys must respect the declared tasks, document-bearing
 * submissions must cover every declared known task, and each item is checked
 * against the representation-correct canonical contract.
 */

/**
 * Asserts one submission's item keys cover the declared tasks in the
 * representation-correct way: null-document submissions may only carry
 * declared null placeholders (or none); document-bearing submissions must
 * cover every declared known task, and every item's task identity must match
 * its declared map key.
 *
 * @param {object} options Submission inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.submission Submission record.
 * @param {Set<string>} options.taskIds Declared task IDs.
 * @param {string} options.location Failure-message context.
 * @returns {void}
 */
function assertSubmissionItemKeys({ submission, taskIds, location }) {
  const label = `${location} submission for student "${submission.studentId}"`;
  for (const [itemKey, itemRaw] of Object.entries(submission.items)) {
    const item = requireItemRecord(itemRaw, `${label} item "${itemKey}"`);
    if (item.taskId !== itemKey) {
      fail(
        `${label} item "${itemKey}" declared for a tasks map key carries task identity "${String(
          item.taskId
        )}" that does not match its declared task key; an item's taskId must equal its declared item key.`
      );
    }
    if (!taskIds.has(itemKey)) {
      fail(
        `${label} item "${itemKey}" carries task "${String(itemRaw?.taskId ?? itemKey)}" not declared by definition tasks.`
      );
    }
  }
}

/**
 * Asserts a document-bearing submission's items cover every declared task.
 *
 * @param {object} options Submission inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.submission Submission record.
 * @param {Set<string>} options.taskIds Declared task IDs.
 * @param {string} options.location Failure-message context.
 * @returns {void}
 */
function assertDocumentCoverage({ submission, taskIds, location }) {
  const label = `${location} submission for student "${submission.studentId}"`;
  for (const declaredTaskId of taskIds) {
    if (!(declaredTaskId in submission.items)) {
      fail(
        `${label} is missing known task "${declaredTaskId}"; every declared task must appear in a document-bearing submission.`
      );
    }
  }
}

const CURRENT_ASSESSMENT_CONTRACT_VERSION = 1;

/**
 * Describes an assessment marker raw value for the failure diagnostic.
 *
 * @param {unknown} marker Raw marker value.
 * @returns {string} Human-readable marker description.
 */
function describeMarker(marker) {
  if (marker === undefined) return 'undefined (marker omitted)';
  return JSON.stringify(marker);
}

/**
 * Asserts one assignment record carries the canonical current-format marker
 * (`assessmentContractVersion` 1). Legacy, missing, and deviating markers stay
 * permitted as raw projection values; the owning validators only certify the
 * current graph.
 *
 * @param {object} options Marker inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.assignment Assignment record under test.
 * @param {string} options.location Failure-message context.
 * @returns {void}
 */
export function assertCurrentAssessmentContractVersion({ assignment, location }) {
  const marker = assignment.assessmentContractVersion;
  if (marker !== CURRENT_ASSESSMENT_CONTRACT_VERSION) {
    fail(
      `${location} assignment "${String(
        assignment.assignmentId
      )}" carries assessmentContractVersion ${describeMarker(
        marker
      )}; the canonical current graph requires assessmentContractVersion ${CURRENT_ASSESSMENT_CONTRACT_VERSION}.`
    );
  }
}

/**
 * Asserts one submission's items against the canonical contract for its
 * representation.
 *
 * @param {object} options Submission inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.submission Submission record.
 * @param {string} options.location Failure-message context.
 * @param {boolean} options.nullParent True when the parent submission has no document.
 * @param {'full'|'partial'} options.representation Representation under test.
 * @returns {void}
 */
function assertSubmissionItems({ submission, location, nullParent, representation }) {
  const label = `${location} submission for student "${submission.studentId}"`;
  for (const itemRaw of Object.values(submission.items)) {
    const item = requireItemRecord(itemRaw, `${label} item`);
    assertAssessmentMap({ item, location: label, nullParent, representation });
    assertItemArtefactSource({ item, location: label, nullParent, representation });
  }
}

/**
 * Asserts one submission's items against the canonical contract for its
 * representation.
 *
 * @param {object} options Submission inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.submission Submission record.
 * @param {Set<string>} options.taskIds Declared task IDs.
 * @param {string} options.location Failure-message context.
 * @param {'full'|'partial'} options.representation Representation under test.
 * @returns {void}
 */
export function assertSubmissionState({ submission, taskIds, location, representation }) {
  requireItemRecord(submission.items, `${location} submission items`);
  const nullParent = submission.documentId === null;
  assertSubmissionItemKeys({ submission, taskIds, location });
  if (!nullParent) {
    assertDocumentCoverage({ submission, taskIds, location });
  }
  assertSubmissionItems({ submission, location, nullParent, representation });
}
