/** Unit 7: independent contract checks for legacy reassessment placeholders. */
import { describe, expect, it } from 'vitest';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
} from './assignmentRehydrationCurrentSupport.js';

const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
const { Assessment } = require('#backend/Models/Assessment.js');
const { StudentSubmission } = require('#backend/Models/StudentSubmission/index.js');
const { StudentSubmissionItem } = require('#backend/Models/StudentSubmission/index.js');
const BaseTaskArtifact = require('#backend/Models/Artifacts/0_BaseTaskArtifact.js');

function legacyInput() {
  const assignment = currentAssignmentJson();
  delete assignment.assessmentContractVersion;
  assignment.referenceDocumentId = 'reference-source-must-not-be-used';
  assignment.templateDocumentId = 'template-source-must-not-be-used';
  for (const submission of assignment.submissions) delete submission.documentId;
  return {
    assignment,
    students: assignment.submissions.map(({ studentId, studentName }) => ({
      studentId,
      studentName,
    })),
  };
}

function assertProjectorExists() {
  expect(Rehydration.projectReassessmentSubmissions).toEqual(expect.any(Function));
}

function call(input, mode) {
  return Rehydration.projectReassessmentSubmissions(input.assignment, input.students, mode);
}

function expectedError() {
  return Assessment.createError('validation', 'REASSESSMENT_REQUIRED').toJSON();
}

function tasksOf(input, mode) {
  if (mode === 'full') return Object.values(input.assignment.assignmentDefinition.tasks);
  return input.assignment.assignmentDefinition.tasks;
}

function itemId(item) {
  return item.id;
}

function expectedItemId(taskId, artifactUid) {
  return `ssi_${Utils.generateHash(`${taskId}::${artifactUid}`).slice(0, 16)}`;
}

function expectProjection(input, mode, submissions, expectedStudentIds) {
  const tasks = tasksOf(input, mode);
  const taskIds = tasks.map((task) => task.taskId ?? task.id);
  expect(submissions).toHaveLength(expectedStudentIds.length);
  expect(submissions.map((submission) => submission.studentId).sort()).toEqual(
    [...expectedStudentIds].sort()
  );
  for (const submission of submissions) {
    expect(submission).toBeInstanceOf(StudentSubmission);
    expect(submission.assignmentId).toBe(input.assignment.assignmentId);
    expect(Object.keys(submission.items).sort()).toEqual([...taskIds].sort());
    for (const task of tasks) {
      const taskId = task.taskId ?? task.id;
      const item = submission.items[taskId];
      expect(item).toBeInstanceOf(StudentSubmissionItem);
      expect(item.taskId).toBe(taskId);
      expect(itemId(item)).toBe(expectedItemId(taskId, item.artifact.getUid()));
      expect(item.artifact).toBeInstanceOf(BaseTaskArtifact);
      expect(item.artifact.taskId).toBe(taskId);
      expect(item.artifact.role).toBe('submission');
      expect(item.artifact.getType()).toBe('base');
      expect(item.artifact.content).toBeNull();
      expect(item.artifact.contentHash).toBeNull();
      expect(item.artifact.metadata).toEqual({});
      expect(item.artifact.pageId).toBeNull();
      expect(item.artifact.documentId).toBeNull();
      expect(Object.keys(item.assessments).sort()).toEqual(['accuracy', 'completeness', 'spag']);
      for (const criterion of ['completeness', 'accuracy', 'spag'])
        expect(item.assessments[criterion]).toEqual(expectedError());
      expect(item.feedback).toEqual({});
    }
  }
}

function partialInput() {
  const input = legacyInput();
  input.assignment = rawPartialEmbeddedSnapshot(input.assignment);
  delete input.assignment.assessmentContractVersion;
  return input;
}

describe('legacy reassessment placeholder shape and deterministic identities', () => {
  it('projects the exact full stored-identity/task matrix', () => {
    assertProjectorExists();
    const input = legacyInput();
    const expectedStudents = input.assignment.submissions.map((s) => s.studentId ?? s.userId);
    expect(expectedStudents.every(Boolean)).toBe(true);
    const tasks = Object.values(input.assignment.assignmentDefinition.tasks);
    expect(tasks.length).toBeGreaterThan(0);
    const result = call(input, 'full');
    expectProjection(input, 'full', result, expectedStudents);
  });

  it('projects partial summaries for precisely the loaded roster and preserves legacy marker absence', () => {
    assertProjectorExists();
    const input = partialInput();
    input.students.push({ studentId: 'loaded-roster-only', studentName: null });
    const roster = input.students.map((student) => student.studentId);
    const taskIds = input.assignment.assignmentDefinition.tasks.map((task) => task.taskId);
    expect(taskIds.length).toBeGreaterThan(0);
    expect(Object.hasOwn(input.assignment, 'assessmentContractVersion')).toBe(false);
    const result = call(input, 'partial');
    expectProjection(input, 'partial', result, roster);
    expect(
      result
        .map((submission) => [submission.studentId, submission.studentName])
        .sort(([a], [b]) => a.localeCompare(b))
    ).toEqual(
      input.students
        .map((student) => [student.studentId, student.studentName])
        .sort(([a], [b]) => a.localeCompare(b))
    );
    expect(Object.hasOwn(input.assignment, 'assessmentContractVersion')).toBe(false);
    expect(input.assignment.assessmentContractVersion).toBeUndefined();
  });

  it('retains nullable student names and trusted historical source identifiers only', () => {
    assertProjectorExists();
    const input = legacyInput();
    const historical = input.assignment.submissions[0];
    const student = input.students.find((entry) => entry.studentId === historical.studentId);
    historical.studentName = null;
    student.studentName = null;
    historical.documentId = 'historical-document';
    historical.pageId = 'historical-page';
    const result = call(input, 'full');
    const projected = result.find((submission) => submission.studentId === historical.studentId);
    expect(projected.studentName).toBeNull();
    const task = Object.keys(projected.items)[0];
    expect(projected.documentId).toBe('historical-document');
    expect(projected.items[task].artifact.documentId).toBe('historical-document');
    expect(projected.items[task].artifact.pageId).toBe('historical-page');
    for (const bad of [undefined, null, '../unsafe']) {
      historical.documentId = bad;
      const unsafe = call(input, 'full').find(
        (submission) => submission.studentId === historical.studentId
      );
      const unsafeItem = unsafe.items[task];
      expect(unsafe.documentId).toBeNull();
      expect(unsafeItem.artifact.documentId).toBeNull();
      expect(unsafeItem.artifact.pageId).toBeNull();
      expect(unsafeItem.artifact.metadata).toEqual({});
      expect(unsafeItem.artifact.role).toBe('submission');
      expect(unsafeItem.artifact.getType()).toBe('base');
    }
  });

  it('derives stable relationships and changes identities across student, task and assignment', () => {
    assertProjectorExists();
    const input = legacyInput();
    const first = call(input, 'full');
    const again = call(input, 'full');
    expect(first).toHaveLength(again.length);
    const identities = (records) =>
      records.flatMap((submission) =>
        Object.entries(submission.items).map(([task, item]) => ({
          student: submission.studentId,
          task,
          assignment: submission.assignmentId,
          uid: item.artifact.getUid(),
          id: itemId(item),
        }))
      );
    expect(identities(first)).toEqual(identities(again));
    const ids = identities(first);
    expect(new Set(ids.map((entry) => entry.uid)).size).toBe(ids.length);
    expect(new Set(ids.map((entry) => entry.id)).size).toBe(ids.length);
    expect(
      new Set(ids.map((entry) => `${entry.assignment}:${entry.student}:${entry.task}`)).size
    ).toBe(ids.length);
    input.assignment.assignmentId = 'different-assignment';
    for (const submission of input.assignment.submissions)
      submission.assignmentId = input.assignment.assignmentId;
    const changed = call(input, 'full');
    expect(changed[0].assignmentId).toBe('different-assignment');
    const changedTask = Object.keys(changed[0].items)[0];
    const changedItem = changed[0].items[changedTask];
    expect(changedItem.artifact.getUid()).not.toBe(ids[0].uid);
    expect(itemId(changedItem)).toBe(expectedItemId(changedTask, changedItem.artifact.getUid()));
    expect(itemId(changedItem)).not.toBe(ids[0].id);
  });
});
