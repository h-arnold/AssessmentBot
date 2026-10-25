/** Unit 10: legacy projection identity and embedded-definition trust boundaries. */
import { describe, expect, it } from 'vitest';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
} from './assignmentRehydrationCurrentSupport.js';

const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');

function graph() {
  const assignment = currentAssignmentJson();
  delete assignment.assessmentContractVersion;
  return {
    assignment,
    students: assignment.submissions.map(({ studentId, studentName }) => ({
      studentId,
      studentName,
    })),
  };
}

function partial(g) {
  g.assignment = rawPartialEmbeddedSnapshot(g.assignment);
  delete g.assignment.assessmentContractVersion;
  return g;
}

function seam() {
  expect(Rehydration.projectReassessmentSubmissions).toEqual(expect.any(Function));
}

function invoke(g, mode) {
  return Rehydration.projectReassessmentSubmissions(g.assignment, g.students, mode);
}

function rejectsOwned(g, mode) {
  seam();
  expect(() => invoke(g, mode)).toThrow(
    /identity|student|assignment|course|definition|task|submission|trust/i
  );
}

describe('legacy projector identity and definition validation', () => {
  it.each([
    ['missing course', (g) => delete g.assignment.courseId],
    ['blank course', (g) => (g.assignment.courseId = '  ')],
    ['non-string course', (g) => (g.assignment.courseId = 12)],
    ['missing assignment', (g) => delete g.assignment.assignmentId],
    ['blank assignment', (g) => (g.assignment.assignmentId = '\t')],
    ['non-string assignment', (g) => (g.assignment.assignmentId = {})],
  ])('rejects %s root identity', (_label, corrupt) => {
    const g = graph();
    corrupt(g);
    expect(g.assignment.submissions.length).toBeGreaterThan(0);
    rejectsOwned(g, 'full');
  });

  it.each([
    ['conflicting parent assignment', (g) => (g.assignment.submissions[0].assignmentId = 'other')],
    ['missing student identity', (g) => delete g.assignment.submissions[0].studentId],
    ['blank student identity', (g) => (g.assignment.submissions[0].studentId = '  ')],
    ['non-string student identity', (g) => (g.assignment.submissions[0].studentId = 4)],
    [
      'duplicate student identity',
      (g) => (g.assignment.submissions[1].studentId = g.assignment.submissions[0].studentId),
    ],
  ])('rejects %s in stored history', (_label, corrupt) => {
    const g = graph();
    corrupt(g);
    expect(g.assignment.submissions.length).toBeGreaterThan(1);
    rejectsOwned(g, 'full');
  });

  it.each([
    ['absent embedded definition', (g) => delete g.assignment.assignmentDefinition],
    ['untrustworthy embedded definition', (g) => (g.assignment.assignmentDefinition = null)],
    [
      'key/id mismatch',
      (g) => {
        const first = Object.keys(g.assignment.assignmentDefinition.tasks)[0];
        g.assignment.assignmentDefinition.tasks[first].id = 'different-task';
      },
    ],
  ])('rejects %s even with empty history', (_label, corrupt) => {
    const g = graph();
    g.assignment.submissions = [];
    corrupt(g);
    expect(g.assignment.submissions).toEqual([]);
    rejectsOwned(g, 'full');
  });

  it.each([
    ['missing summary task id', (tasks) => delete tasks[0].taskId],
    ['duplicate summary task id', (tasks) => (tasks[1].taskId = tasks[0].taskId)],
  ])('rejects %s in a partial definition', (_label, corrupt) => {
    const g = partial(graph());
    corrupt(g.assignment.assignmentDefinition.tasks);
    expect(Array.isArray(g.assignment.assignmentDefinition.tasks)).toBe(true);
    expect(g.assignment.assignmentDefinition.tasks.length).toBeGreaterThan(1);
    rejectsOwned(g, 'partial');
  });

  it.each([
    ['missing roster identity', (g) => delete g.students[0].studentId],
    ['blank roster identity', (g) => (g.students[0].studentId = ' ')],
    ['duplicate roster identity', (g) => (g.students[1].studentId = g.students[0].studentId)],
  ])('rejects %s in a partial supplied roster', (_label, corrupt) => {
    const g = partial(graph());
    corrupt(g);
    expect(g.students.length).toBeGreaterThan(1);
    rejectsOwned(g, 'partial');
  });

  it('accepts legacy userId history, nullable names and unsupported opaque historical payloads', () => {
    const g = graph();
    const stored = g.assignment.submissions[0];
    stored.userId = stored.studentId;
    delete stored.studentId;
    stored.studentName = null;
    stored.items[Object.keys(stored.items)[0]].assessments = { ancient: { verdict: [null, 91] } };
    g.students.forEach((student) => (student.studentName = null));
    const rosterIds = g.students.map((student) => student.studentId);
    const partialGraph = partial(graph());
    partialGraph.students.push({ studentId: 'roster-only', studentName: null });
    const taskIds = partialGraph.assignment.assignmentDefinition.tasks
      .map((task) => task.taskId)
      .sort();
    seam();
    const full = invoke(g, 'full');
    expect(full.map((submission) => submission.studentId)).toContain(stored.userId);
    expect(full).not.toHaveLength(0);
    const projected = invoke(partialGraph, 'partial');
    expect(projected.map((submission) => submission.studentId).sort()).toEqual(
      partialGraph.students.map((student) => student.studentId).sort()
    );
    for (const submission of projected)
      expect(Object.keys(submission.items).sort()).toEqual(taskIds);
  });

  it('does not invent full-mode students for empty history and represents partial roster/task pairs', () => {
    const empty = graph();
    empty.assignment.submissions = [];
    const roster = partial(graph());
    roster.assignment.submissions = [];
    roster.students.push({ studentId: 'no-history', studentName: null });
    const ids = roster.students.map((student) => student.studentId).sort();
    const tasks = roster.assignment.assignmentDefinition.tasks.map((task) => task.taskId).sort();
    seam();
    expect(invoke(empty, 'full')).toEqual([]);
    const result = invoke(roster, 'partial');
    expect(result).toHaveLength(ids.length);
    expect(result.map((submission) => submission.studentId).sort()).toEqual(ids);
    for (const submission of result) expect(Object.keys(submission.items).sort()).toEqual(tasks);
  });
});
