/**
 * Legacy detached reassessment projection contract. These tests intentionally
 * target the pure facade seam; they do not restore through a controller/store.
 */
import { describe, expect, it } from 'vitest';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
} from './assignmentRehydrationCurrentSupport.js';

const AssignmentRehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
const { Assessment } = require('#backend/Models/Assessment.js');
const { StudentSubmission } = require('#backend/Models/StudentSubmission/index.js');
const { StudentSubmissionItem } = require('#backend/Models/StudentSubmission/index.js');

function legacyGraph() {
  const assignment = currentAssignmentJson();
  delete assignment.assessmentContractVersion;
  const students = assignment.submissions.map((submission, index) => ({
    studentId: `roster-${index}`,
    studentName: `Roster ${index}`,
  }));
  expect(assignment.assignmentDefinition).toBeTruthy();
  expect(assignment.submissions.length).toBeGreaterThan(0);
  expect(Object.keys(assignment.assignmentDefinition.tasks).length).toBeGreaterThan(0);
  return { assignment, students };
}

function project(graph, mode) {
  expect(AssignmentRehydration.projectReassessmentSubmissions).toEqual(expect.any(Function));
  return AssignmentRehydration.projectReassessmentSubmissions(
    graph.assignment,
    graph.students,
    mode
  );
}

function expectedReassessment() {
  return Assessment.createError('validation', 'REASSESSMENT_REQUIRED').toJSON();
}

describe('legacy detached reassessment projection', () => {
  it('projects the full stored-identity task universe without inventing roster students', () => {
    const graph = legacyGraph();
    const expectedStudents = graph.assignment.submissions.map(
      (submission) => submission.studentId ?? submission.userId
    );
    expect(expectedStudents.every(Boolean)).toBe(true);
    const result = project(graph, 'full');
    expect(result.map((submission) => submission.studentId).sort()).toEqual(
      expectedStudents.sort()
    );
    for (const submission of result) {
      expect(Object.keys(submission.items).sort()).toEqual(
        Object.keys(graph.assignment.assignmentDefinition.tasks).sort()
      );
    }
  });

  it('projects partial task summaries only for the supplied roster identities', () => {
    const graph = legacyGraph();
    const partial = rawPartialEmbeddedSnapshot(graph.assignment);
    partial.assignmentDefinition.tasks = Object.values(partial.assignmentDefinition.tasks);
    delete partial.assessmentContractVersion;
    graph.assignment = partial;
    const expected = graph.students.map((student) => student.studentId).sort();
    expect(Array.isArray(graph.assignment.assignmentDefinition.tasks)).toBe(true);
    expect(Object.hasOwn(graph.assignment, 'assessmentContractVersion')).toBe(false);
    expect(graph.assignment.assessmentContractVersion).toBeUndefined();
    const result = project(graph, 'partial');
    expect(result.map((submission) => submission.studentId).sort()).toEqual(expected);
    const expectedTaskIds = graph.assignment.assignmentDefinition.tasks
      .map((task) => task.taskId)
      .sort();
    expect(result).toHaveLength(graph.students.length);
    for (const submission of result) {
      expect(Object.keys(submission.items).sort()).toEqual(expectedTaskIds);
      for (const item of Object.values(submission.items)) {
        expect(Object.keys(item.assessments).sort()).toEqual(['accuracy', 'completeness', 'spag']);
        for (const value of Object.values(item.assessments))
          expect(value).toEqual(expectedReassessment());
        expect(item.feedback).toEqual({});
      }
    }
    expect(
      result.every(
        (submission) =>
          !graph.assignment.submissions.some(
            (stored) => (stored.studentId ?? stored.userId) === submission.studentId
          )
      )
    ).toBe(true);
  });

  it.each(['missing', 'null', 'unsupported'])(
    'reassesses historical marks with %s marker and detached canonical error entries',
    (marker) => {
      const graph = legacyGraph();
      if (marker === 'null') graph.assignment.assessmentContractVersion = null;
      if (marker === 'unsupported') graph.assignment.assessmentContractVersion = 88;
      for (const submission of graph.assignment.submissions) {
        for (const item of Object.values(submission.items)) {
          item.assessments = { completeness: { score: 5, reasoning: 'old mark' } };
          item.feedback = { old: 'content' };
        }
      }
      const result = project(graph, 'full');
      for (const submission of result)
        for (const item of Object.values(submission.items)) {
          expect(Object.keys(item.assessments).sort()).toEqual([
            'accuracy',
            'completeness',
            'spag',
          ]);
          for (const value of Object.values(item.assessments))
            expect(value).toEqual(expectedReassessment());
          expect(item.feedback).toEqual({});
        }
    }
  );

  it('materialises model artefacts and stable identifiers without borrowing unsafe source IDs', () => {
    const graph = legacyGraph();
    graph.assignment.submissions[0].documentId = '../unsafe';
    const result = project(graph, 'full');
    expect(result[0]).toBeInstanceOf(StudentSubmission);
    for (const item of Object.values(result[0].items)) {
      expect(item).toBeInstanceOf(StudentSubmissionItem);
      expect(item.artifact.content).toBeNull();
      expect(item.artifact.contentHash).toBeNull();
      expect(item.feedback).toEqual({});
    }
  });

  it('preserves valid timestamps and produces deterministic detached snapshots', () => {
    const graph = legacyGraph();
    const before = structuredClone(graph.assignment);
    const first = project(graph, 'full');
    expect(graph.assignment).toEqual(before);
    const snapshot = JSON.stringify(first);
    const second = project(graph, 'full');
    expect(JSON.stringify(second)).toBe(snapshot);
    first[0].studentName = 'mutated projection';
    expect(graph.assignment).toEqual(before);
    expect(project(graph, 'full')[0].studentName).not.toBe('mutated projection');
  });

  it('projects a valid graph without throwing', () => {
    const graph = legacyGraph();
    expect(() => project(graph, 'full')).not.toThrow();
  });

  it.each(['missing', 'null', 'unsupported'])(
    'projects partial legacy summaries with a %s marker and canonical reassessment tasks',
    (marker) => {
      const graph = legacyGraph();
      const partial = rawPartialEmbeddedSnapshot(graph.assignment);
      partial.assignmentDefinition.tasks = Object.values(partial.assignmentDefinition.tasks);
      delete partial.assessmentContractVersion;
      if (marker === 'null') partial.assessmentContractVersion = null;
      if (marker === 'unsupported') partial.assessmentContractVersion = 88;
      graph.assignment = partial;

      if (marker === 'missing') {
        expect(Object.hasOwn(partial, 'assessmentContractVersion')).toBe(false);
      } else {
        expect(Object.hasOwn(partial, 'assessmentContractVersion')).toBe(true);
        expect(partial.assessmentContractVersion).toBe(marker === 'null' ? null : 88);
      }
      expect(Array.isArray(partial.assignmentDefinition.tasks)).toBe(true);
      const taskIds = partial.assignmentDefinition.tasks.map((task) => task.taskId).sort();
      expect(taskIds.length).toBeGreaterThan(0);
      const result = project(graph, 'partial');
      expect(result).toHaveLength(graph.students.length);
      expect(result.map((submission) => submission.studentId).sort()).toEqual(
        graph.students.map((student) => student.studentId).sort()
      );
      for (const submission of result) {
        expect(Object.keys(submission.items).sort()).toEqual(taskIds);
        for (const item of Object.values(submission.items)) {
          expect(Object.keys(item.assessments).sort()).toEqual([
            'accuracy',
            'completeness',
            'spag',
          ]);
          for (const value of Object.values(item.assessments))
            expect(value).toEqual(expectedReassessment());
          expect(item.feedback).toEqual({});
        }
      }
    }
  );

  it('rejects an invalid projection mode with an owned mode error', () => {
    const graph = legacyGraph();
    expect(AssignmentRehydration.projectReassessmentSubmissions).toEqual(expect.any(Function));
    expect(() =>
      AssignmentRehydration.projectReassessmentSubmissions(
        graph.assignment,
        graph.students,
        'unknown'
      )
    ).toThrow(/mode/i);
  });

  it('rejects untrustworthy required graph identity with an owned data error', () => {
    const graph = legacyGraph();
    expect(AssignmentRehydration.projectReassessmentSubmissions).toEqual(expect.any(Function));
    graph.assignment.submissions[0].studentId = null;
    graph.assignment.submissions[0].userId = null;
    expect(() =>
      AssignmentRehydration.projectReassessmentSubmissions(graph.assignment, graph.students, 'full')
    ).toThrow(/student|identity|submission/i);
  });
});
