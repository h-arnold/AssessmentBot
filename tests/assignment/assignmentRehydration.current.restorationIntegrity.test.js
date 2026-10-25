/**
 * Current-format assignment rehydration: restoration identity and failure propagation.
 *
 * Regression coverage originating in the Section 2 Red phase: each identified
 * item is restored exactly once, corrupted raw data is converted to placeholders
 * without constructing and discarding the raw item first, and injected
 * construction/wiring faults propagate instead of being converted to
 * placeholders, dropped or retried. Identity failures on the owned dataset
 * (unknown task keys, untrustworthy student or root identity) fail loudly. These
 * behaviours are implemented in `02_AssignmentRehydration.js`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
const { Assessment } = require('#backend/Models/Assessment.js');
const {
  StudentSubmission,
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/index.js');
import {
  DOCUMENT_SUBMISSION_INDEX,
  HEAD_TASK_ID,
  KNOWN_TASK_IDS,
  SIBLING_TASK_ID,
  currentAssignmentJson,
  corruptedRecord,
  corruptRecordAssessments,
  expectCorruptRecordPlaceholder,
  focusDocumentSubmission,
  restoreAssignment,
} from './assignmentRehydrationCurrentSupport.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('current-format rehydration restoration identity and propagation', () => {
  it('restores the single identified item exactly once on a healthy record', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    const rawItems = structuredClone(record.submissions[0].items);
    const spy = vi.spyOn(StudentSubmissionItem, 'fromJSON');
    const restored = restoreAssignment(record);
    // One call per identified raw healthy item, not an aggregate count alone.
    const callsByTask = Object.fromEntries(
      KNOWN_TASK_IDS.map((taskId) => [
        taskId,
        spy.mock.calls.filter((call) => call[0].taskId === taskId).length,
      ])
    );
    expect(callsByTask).toEqual(Object.fromEntries(KNOWN_TASK_IDS.map((taskId) => [taskId, 1])));
    for (const [taskId, rawItem] of Object.entries(rawItems)) {
      expect(spy.mock.calls.find((call) => call[0].taskId === taskId)[0]).toEqual(rawItem);
      expect(restored.submissions[0].items[taskId].taskId).toBe(taskId);
    }
  });

  it('restores each healthy item exactly once when a sibling item is raw-invalid', () => {
    const record = corruptedRecord(
      DOCUMENT_SUBMISSION_INDEX,
      HEAD_TASK_ID,
      (item) => delete item.artifact.contentHash
    );
    const rawSibling = structuredClone(record.submissions[0].items[SIBLING_TASK_ID]);
    focusDocumentSubmission(record);
    const spy = vi.spyOn(StudentSubmissionItem, 'fromJSON');
    const restored = restoreAssignment(record);
    const healthyCalls = spy.mock.calls.filter((call) => call[0].taskId === SIBLING_TASK_ID);
    expect(healthyCalls).toHaveLength(1);
    expect(healthyCalls[0][0]).toEqual(rawSibling);
    expect(restored.submissions[0].items[SIBLING_TASK_ID].taskId).toBe(SIBLING_TASK_ID);
  });

  it('places the placeholder without constructing the raw invalid item first', () => {
    const record = corruptedRecord(
      DOCUMENT_SUBMISSION_INDEX,
      HEAD_TASK_ID,
      (item) => delete item.artifact.contentHash
    );
    focusDocumentSubmission(record);
    const spy = vi.spyOn(StudentSubmissionItem, 'fromJSON');
    const restored = restoreAssignment(record);
    expectCorruptRecordPlaceholder(restored.submissions[0].items[HEAD_TASK_ID]);
    const invalidItemCalls = spy.mock.calls.filter((call) => call[0].taskId === HEAD_TASK_ID);
    expect(invalidItemCalls).toHaveLength(0);
  });

  it('propagates injected item construction faults instead of conversion or retry', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    const sentinel = new Error('injected item wiring fault');
    const spy = vi.spyOn(StudentSubmissionItem, 'fromJSON').mockImplementation(() => {
      throw sentinel;
    });
    expect(() => restoreAssignment(record)).toThrow(sentinel);
    // A fault is terminal: exactly one invocation, no retry loop.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('propagates injected whole-submission construction faults', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    const sentinel = new Error('injected submission wiring fault');
    const spy = vi.spyOn(StudentSubmission, 'fromJSON').mockImplementation(() => {
      throw sentinel;
    });
    expect(() => restoreAssignment(record)).toThrow(sentinel);
    // A fault is terminal: exactly one invocation, no retry loop.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fails the owned dataset loudly on an unknown stored task key', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    const unknownItem = structuredClone(record.submissions[0].items[HEAD_TASK_ID]);
    unknownItem.taskId = 'task-9-9';
    record.submissions[0].items['task-9-9'] = unknownItem;
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('fails the owned dataset loudly on a blank trusted student identity', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    record.submissions[0].studentId = '   ';
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('fails the owned dataset loudly on a missing trusted student identity', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    delete record.submissions[0].studentId;
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('fails the owned dataset loudly when a submission names a different assignment', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    record.submissions[0].assignmentId = 'assignment-0-9';
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('fails the owned dataset loudly on an untrustworthy root identity', () => {
    const record = currentAssignmentJson();
    record.courseId = '';
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('fails the owned dataset loudly when the embedded definition is absent', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    delete record.assignmentDefinition;
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('fails the owned dataset loudly when the embedded task universe loses a known task', () => {
    const record = currentAssignmentJson();
    focusDocumentSubmission(record);
    delete record.assignmentDefinition.tasks[HEAD_TASK_ID];
    expect(() => restoreAssignment(record)).toThrow();
  });

  it('materialises stale corrupt-item coverage once, not per retry', () => {
    const record = corruptedRecord(
      DOCUMENT_SUBMISSION_INDEX,
      HEAD_TASK_ID,
      (item) => delete item.artifact.contentHash
    );
    focusDocumentSubmission(record);
    const expectedAssessments = corruptRecordAssessments();
    const createErrorSpy = vi.spyOn(Assessment, 'createError');
    const restored = restoreAssignment(record);
    const placeholder = restored.submissions[0].items[HEAD_TASK_ID];
    expect(placeholder).toBeDefined();
    expect(placeholder.assessments).toEqual(expectedAssessments);
    // Materialisation runs once for the identified item, never once per retry,
    // and every placeholder entry comes from the exact catalogue cause.
    expect(createErrorSpy).toHaveBeenCalledTimes(1);
    expect(createErrorSpy).toHaveBeenCalledWith('validation', 'CORRUPT_RECORD');
    expect(Object.keys(restored.submissions[0].items).length).toBe(KNOWN_TASK_IDS.length);
  });
});
