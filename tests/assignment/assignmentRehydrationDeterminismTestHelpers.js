/**
 * Shared determinism assertions for current-format assignment rehydration tests.
 *
 * Both the CURRENT companions and findings suites restore the same record twice
 * and prove the two serialisations are identical and use the stored assignment
 * timestamps. The duplicated tail lives here so the two suites share one
 * implementation.
 */

import { expect } from 'vitest';
import { restoreAssignment } from './assignmentRehydrationCurrentSupport.js';

/**
 * Restores the record twice, asserts the two serialisations are identical and
 * that the first submission's `createdAt` falls back to the assignment's stored
 * `createdAt`.
 *
 * @param {Record<string, unknown>} record Raw current-format assignment record.
 * @param {string} [expectedUpdatedAtSource] Field on the record the restored
 *   `updatedAt` must equal; omit to skip the `updatedAt` assertion.
 */
export function expectDeterministicRestore(record, expectedUpdatedAtSource) {
  const first = restoreAssignment(record).toJSON();
  const second = restoreAssignment(record).toJSON();
  expect(first).toEqual(second);
  expect(first.submissions[0].createdAt).toBe(record.createdAt);
  if (expectedUpdatedAtSource) {
    expect(first.submissions[0].updatedAt).toBe(record[expectedUpdatedAtSource]);
  }
}

/**
 * Asserts the polymorphic assignment exposes the expected document type and the
 * course-derived assignment, reference and template identities.
 *
 * @param {object} assignment Restored or created assignment instance.
 * @param {string} docType Expected assignment document type.
 * @param {string} courseId Course ID the other identities derive from.
 */
export function expectAssignmentProperties(assignment, docType, courseId) {
  expect(assignment).toBeDefined();
  expect(assignment.assignmentDefinition).toBeDefined();
  expect(assignment.assignmentDefinition.documentType).toBe(docType);
  expect(assignment.courseId).toBe(courseId);
  expect(assignment.assignmentId).toBe(courseId.replace('c', 'a'));
  expect(assignment.assignmentDefinition.referenceDocumentId).toBe(courseId.replace('c', 'ref'));
  expect(assignment.assignmentDefinition.templateDocumentId).toBe(courseId.replace('c', 'tpl'));
}
