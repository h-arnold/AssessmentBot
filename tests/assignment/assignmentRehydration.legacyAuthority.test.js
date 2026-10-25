/** Adversarial authority checks for legacy detached assignment projections. */
import { describe, expect, it, vi } from 'vitest';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
} from './assignmentRehydrationCurrentSupport.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';

const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
const Assessment = require('#backend/Models/Assessment.js').Assessment;
const ABClassAssignmentOps = require('#backend/y_controllers/ABClassController/ABClassAssignmentOps.js');
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

function legacyFull() {
  const assignment = currentAssignmentJson();
  delete assignment.assessmentContractVersion;
  return assignment;
}

function reassessment() {
  return Assessment.createError('validation', 'REASSESSMENT_REQUIRED').toJSON();
}

function invoke(assignment, students, mode) {
  expect(Rehydration.projectReassessmentSubmissions).toEqual(expect.any(Function));
  return Rehydration.projectReassessmentSubmissions(assignment, students, mode);
}

describe('legacy task snapshot and registry authority', () => {
  it('uses stored partial summaries and the loaded roster despite a newer registry definition', () => {
    const full = legacyFull();
    const partial = rawPartialEmbeddedSnapshot(full);
    delete partial.assessmentContractVersion;
    const storedTaskIds = partial.assignmentDefinition.tasks.map((task) => task.taskId).sort();
    const legacySubmissions = structuredClone(partial.submissions);
    const legacyMarker = structuredClone(partial.submissions[0]);
    const roster = [
      { studentId: 'loaded-roster-a', studentName: 'A' },
      { studentId: 'loaded-roster-b', studentName: 'B' },
    ];
    const getDefinitionByKey = vi.fn(() => structuredClone(full.assignmentDefinition));
    class MockDefinitionController {
      getDefinitionByKey(...args) {
        return getDefinitionByKey(...args);
      }
    }
    const assignment = Assignment.fromJSON(partial, 'partial');
    const classInput = {
      classId: 'class-read',
      className: null,
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: null,
      classOwner: null,
      teachers: [],
      students: roster,
      active: true,
      metadata: null,
      assignments: [assignment],
      serialiseOwner: (owner) => owner,
    };
    const mapper = new ABClassResponseMapper();
    const output = withTemporaryGlobals(
      { AssignmentDefinitionController: () => MockDefinitionController },
      () => mapper._toReadView(classInput)
    );
    const result = output.assignments[0].submissions;
    expect(result).toHaveLength(2);
    expect(result.map((submission) => submission.studentId).sort()).toEqual([
      'loaded-roster-a',
      'loaded-roster-b',
    ]);
    for (const submission of result) {
      expect(Object.keys(submission.items).sort()).toEqual(storedTaskIds);
      for (const item of Object.values(submission.items)) {
        expect(item.assessments).toEqual({
          completeness: reassessment(),
          accuracy: reassessment(),
          spag: reassessment(),
        });
        expect(item.feedback).toEqual({});
      }
    }
    expect(getDefinitionByKey).not.toHaveBeenCalled();
    expect(assignment.toJSON().submissions).toEqual(legacySubmissions);
    expect(assignment.toJSON().submissions[0]).toEqual(legacyMarker);
  });

  it('uses full embedded tasks and stored identities rather than roster or registry', () => {
    const full = legacyFull();
    full.students = [{ studentId: 'roster-only', studentName: 'Not stored' }];
    const storedSubmissions = structuredClone(full.submissions);
    const storedMarker = structuredClone(full.submissions[0]);
    const storedIds = full.submissions
      .map((submission) => submission.studentId ?? submission.userId)
      .sort();
    expect(full.submissions).toHaveLength(storedIds.length);
    const taskIds = Object.keys(full.assignmentDefinition.tasks).sort();
    const findOne = vi.fn(() => full);
    const getDefinitionByKey = vi.fn(() => {
      const definition = structuredClone(full.assignmentDefinition);
      const firstTaskId = Object.keys(definition.tasks)[0];
      definition.tasks = { [firstTaskId]: definition.tasks[firstTaskId] };
      return definition;
    });
    class MockDefinitionController {
      getDefinitionByKey(...args) {
        return getDefinitionByKey(...args);
      }
    }
    const ops = new ABClassAssignmentOps({
      dbManager: { getCollection: vi.fn(() => ({ findOne })) },
      validation: {},
      persistence: {},
    });
    const rehydrated = withTemporaryGlobals(
      {
        AssignmentDefinitionController: () => MockDefinitionController,
        ABLogger: () =>
          class {
            static getInstance() {
              return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
            }
          },
        Assignment: () => Assignment,
      },
      () => ops.readRehydrateAssignment(full.courseId, full.assignmentId)
    );
    expect(findOne).toHaveBeenCalledWith({
      courseId: full.courseId,
      assignmentId: full.assignmentId,
    });
    expect(getDefinitionByKey).not.toHaveBeenCalled();
    const result = rehydrated.toReadJSON().submissions;
    expect(result).toHaveLength(storedIds.length);
    expect(result.map((submission) => submission.studentId).sort()).toEqual(storedIds);
    for (const submission of result) {
      expect(Object.keys(submission.items).sort()).toEqual(taskIds);
      for (const item of Object.values(submission.items)) {
        expect(item.assessments).toEqual({
          completeness: reassessment(),
          accuracy: reassessment(),
          spag: reassessment(),
        });
      }
    }
    expect(result.map((submission) => submission.studentId)).not.toContain('roster-only');
    expect(rehydrated.toJSON().submissions).toEqual(storedSubmissions);
    expect(rehydrated.toJSON().submissions[0]).toEqual(storedMarker);
  });

  it('allows partial summaries and resolved full definition to have distinct task universes', () => {
    const partial = rawPartialEmbeddedSnapshot(legacyFull());
    delete partial.assessmentContractVersion;
    const summaryIds = partial.assignmentDefinition.tasks.map((task) => task.taskId).sort();
    partial.submissions = [structuredClone(legacyFull().submissions[0])];
    const roster = [{ studentId: 'roster-fallback', studentName: null }];
    const resolved = structuredClone(legacyFull().assignmentDefinition);
    const resolvedId = Object.keys(resolved.tasks)[0];
    resolved.tasks = { [resolvedId]: resolved.tasks[resolvedId] };
    const before = structuredClone(partial);
    const findOne = vi.fn(() => partial);
    const getDefinitionByKey = vi.fn(() => AssignmentDefinition.fromJSON(resolved));
    class MockDefinitionController {
      getDefinitionByKey(...args) {
        return getDefinitionByKey(...args);
      }
    }
    const ops = new ABClassAssignmentOps({
      dbManager: { getCollection: vi.fn(() => ({ findOne })) },
      validation: {},
      persistence: {},
    });
    const rehydrated = withTemporaryGlobals(
      {
        AssignmentDefinitionController: () => MockDefinitionController,
        ABLogger: { getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
        Assignment: () => Assignment,
      },
      () => ops.readRehydrateAssignment(partial.courseId, partial.assignmentId)
    );
    expect(getDefinitionByKey).toHaveBeenCalledWith(partial.assignmentDefinition.definitionKey, {
      form: 'full',
    });
    expect(findOne).toHaveBeenCalledWith({
      courseId: partial.courseId,
      assignmentId: partial.assignmentId,
    });
    expect(typeof rehydrated.toReadJSON).toBe('function');
    const fullRead = rehydrated.toReadJSON();
    const directFullResult = fullRead.submissions;
    const partialResult = invoke(partial, roster, 'partial');
    expect(Object.keys(partialResult[0].items).sort()).toEqual(summaryIds);
    expect(partialResult[0].studentId).toBe('roster-fallback');
    expect(partialResult[0].items).not.toHaveProperty('resolved-only');
    expect(Object.keys(directFullResult[0].items).sort()).toEqual([resolvedId]);
    expect(directFullResult[0].studentId).toBe(partial.submissions[0].studentId);
    expect(partial).toEqual(before);
  });

  it('keeps the full empty-history authority boundary positive', () => {
    const full = legacyFull();
    full.submissions = [];
    expect(full.submissions).toHaveLength(0);
    expect(invoke(full, [{ studentId: 'not-in-history' }], 'full')).toEqual([]);
  });
});
