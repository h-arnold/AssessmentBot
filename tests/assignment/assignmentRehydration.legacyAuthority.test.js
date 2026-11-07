/**
 * Stored task-snapshot and registry authority on the wire read paths.
 *
 * A legacy read must use the task snapshot stored with the assignment and the
 * submissions stored with it: class reads never consult the definition registry
 * and never expand the stored submissions with roster students, while a full
 * read resolves an embedded partial definition exactly once through the
 * registry. The retired projector instead rebuilt every roster/task pair from
 * the loaded roster; these cases pin the replacement authority boundary.
 */
import { describe, expect, it, vi } from 'vitest';
import { classView } from './assignmentLegacyReadPreparationSupport.js';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
} from './assignmentRehydrationCurrentSupport.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');
const ABClassAssignmentOps = require('#backend/y_controllers/ABClassController/ABClassAssignmentOps.js');

/** Registry controller mock whose lookup records calls and returns `definition`. */
function mockRegistry(definition) {
  const getDefinitionByKey = vi.fn(() => definition);
  class MockDefinitionController {
    getDefinitionByKey(...args) {
      return getDefinitionByKey(...args);
    }
  }
  return { getDefinitionByKey, MockDefinitionController };
}

describe('legacy class read authority', () => {
  it('prepares stored submissions from stored summaries without registry or roster use', () => {
    const partial = rawPartialEmbeddedSnapshot(currentAssignmentJson());
    Reflect.deleteProperty(partial, 'assessmentContractVersion');
    const storedTaskIds = partial.assignmentDefinition.tasks.map((task) => task.taskId).sort();
    const storedSubmissions = structuredClone(partial.submissions);
    const roster = [
      { studentId: 'loaded-roster-a', studentName: 'A' },
      { studentId: 'loaded-roster-b', studentName: 'B' },
    ];
    const registry = mockRegistry(null);
    const assignment = Assignment.fromJSON(structuredClone(partial), 'partial');

    const output = withTemporaryGlobals(
      { AssignmentDefinitionController: () => registry.MockDefinitionController },
      () => new ABClassResponseMapper()._toReadView(classView(assignment, roster))
    );
    const result = output.assignments[0].submissions;

    // Stored submissions only: the roster never expands the read result.
    expect(result.map((submission) => submission.studentId).sort()).toEqual(
      storedSubmissions.map((submission) => submission.studentId).sort()
    );
    for (const submission of result) {
      expect(Object.keys(submission.items).sort()).toEqual(storedTaskIds);
    }
    const scores = result.flatMap((submission) =>
      Object.values(submission.items).flatMap((item) => Object.values(item.assessments))
    );
    expect(scores.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
    expect(registry.getDefinitionByKey).not.toHaveBeenCalled();
    // The stored body is untouched by the read.
    expect(assignment.toJSON().submissions).toEqual(storedSubmissions);
  });

  it('keeps empty stored history positive on both read paths without inventing students', () => {
    const record = currentAssignmentJson();
    Reflect.deleteProperty(record, 'assessmentContractVersion');
    record.submissions = [];
    const restored = Assignment.fromJSON(structuredClone(record));
    expect(restored.toReadJSON().submissions).toEqual([]);

    const partial = rawPartialEmbeddedSnapshot(structuredClone(record));
    const assignment = Assignment.fromJSON(structuredClone(partial), 'partial');
    const view = new ABClassResponseMapper()._toReadView(
      classView(assignment, [{ studentId: 'roster-only', studentName: null }])
    ).assignments[0];
    expect(view.submissions).toEqual([]);
  });
});

describe('legacy full read authority', () => {
  it('prepares stored identities against the embedded full definition without registry use', () => {
    const full = currentAssignmentJson();
    Reflect.deleteProperty(full, 'assessmentContractVersion');
    full.students = [{ studentId: 'roster-only', studentName: 'Not stored' }];
    const storedSubmissions = structuredClone(full.submissions);
    const storedIds = full.submissions.map((submission) => submission.studentId).sort();
    const taskIds = Object.keys(full.assignmentDefinition.tasks).sort();
    const findOne = vi.fn(() => structuredClone(full));
    // A registry lookup returning a reduced definition must never be consulted:
    // the stored full definition is the authority for the full read.
    const registry = mockRegistry({ tasks: {} });
    const ops = new ABClassAssignmentOps({
      dbManager: { getCollection: vi.fn(() => ({ findOne })) },
      validation: {},
      persistence: {},
    });
    const rehydrated = withTemporaryGlobals(
      {
        AssignmentDefinitionController: () => registry.MockDefinitionController,
        ABLogger: { getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
        Assignment: () => Assignment,
      },
      () => ops.readRehydrateAssignment(full.courseId, full.assignmentId)
    );

    expect(findOne).toHaveBeenCalledWith({
      courseId: full.courseId,
      assignmentId: full.assignmentId,
    });
    expect(registry.getDefinitionByKey).not.toHaveBeenCalled();
    const read = rehydrated.toReadJSON();
    expect(read.assessmentContractVersion).toBe('legacy');
    expect(read.submissions.map((submission) => submission.studentId).sort()).toEqual(storedIds);
    expect(read.submissions.map((submission) => submission.studentId)).not.toContain('roster-only');
    for (const submission of read.submissions) {
      expect(Object.keys(submission.items).sort()).toEqual(taskIds);
    }
    expect(rehydrated.toJSON().submissions).toEqual(storedSubmissions);
  });

  it('allows the class-read summaries and the resolved full definition to differ', () => {
    const full = currentAssignmentJson();
    const partial = rawPartialEmbeddedSnapshot(full);
    Reflect.deleteProperty(partial, 'assessmentContractVersion');
    // The stored class summary carries a stale single-task subset; the full read
    // resolves the complete keyed definition through the registry instead.
    const fullTaskIds = Object.keys(full.assignmentDefinition.tasks).sort();
    partial.assignmentDefinition.tasks = partial.assignmentDefinition.tasks.slice(0, 1);
    const summaryId = partial.assignmentDefinition.tasks[0].taskId;
    partial.submissions = partial.submissions.slice(0, 1);
    for (const taskId of Object.keys(partial.submissions[0].items)) {
      if (taskId !== summaryId) Reflect.deleteProperty(partial.submissions[0].items, taskId);
    }
    const definitionKey = partial.assignmentDefinition.definitionKey;
    const before = structuredClone(partial);
    const findOne = vi.fn(() => structuredClone(partial));
    const registry = mockRegistry(
      AssignmentDefinition.fromJSON(structuredClone(full.assignmentDefinition))
    );
    const ops = new ABClassAssignmentOps({
      dbManager: { getCollection: vi.fn(() => ({ findOne })) },
      validation: {},
      persistence: {},
    });
    const rehydrated = withTemporaryGlobals(
      {
        AssignmentDefinitionController: () => registry.MockDefinitionController,
        ABLogger: { getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
        Assignment: () => Assignment,
      },
      () => ops.readRehydrateAssignment(partial.courseId, partial.assignmentId)
    );

    expect(registry.getDefinitionByKey).toHaveBeenCalledWith(definitionKey, { form: 'full' });
    const fullRead = rehydrated.toReadJSON();
    expect(fullRead.assessmentContractVersion).toBe('legacy');
    expect(Object.keys(fullRead.submissions[0].items).sort()).toEqual(fullTaskIds);

    // The class read of the same stored record keeps the stored summary task list.
    const assignment = Assignment.fromJSON(structuredClone(partial), 'partial');
    const view = new ABClassResponseMapper()._toReadView(
      classView(assignment, [{ studentId: assignment.submissions[0].studentId }])
    ).assignments[0];
    expect(view).not.toHaveProperty('assignmentDefinition');
    expect(view.assignmentDefinitionKey).toBe(definitionKey);
    expect(Object.keys(view.submissions[0].items).sort()).toEqual([summaryId]);
    expect(partial).toEqual(before);
  });
});
