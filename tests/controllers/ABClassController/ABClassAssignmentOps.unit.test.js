import { describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  buildCompletedRun,
  captureRunWithDiagnostics,
  captureThrown,
  clone,
  findDiagnosticEntry,
  FIXTURE_ASSIGNMENT_ID,
  fullStore,
  HEAD_TASK_ID,
  persistedFullPayload,
  SIBLING_TASK_ID,
  writeEvents,
} from './abclassPersistenceTestHelpers.js';

const MODULE_PATH = '#backend/y_controllers/ABClassController/ABClassAssignmentOps.js';
const ABClassAssignmentOps = require(MODULE_PATH);
const ABClassPersistence = require('#backend/y_controllers/ABClassController/ABClassPersistence.js');
const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');

/**
 * One ABLogger.error entry must associate the original err by identity with the
 * exact failedPhase and fullWriteCommitted boolean. See the connected facade
 * suite for the complete matrix; these fields are internal log metadata.
 */
const PERSIST_FAILURE_PHASES = {
  fullAssignmentProjection: 'full-assignment-projection',
  embeddedPartialProjection: 'embedded-partial-projection',
  prospectiveClassProjection: 'prospective-class-projection',
  classPartialsProjection: 'class-partials-projection',
};

function expectPersistFailureDiagnostics(errorCalls, fault, failedPhase, fullWriteCommitted) {
  const entry = findDiagnosticEntry(errorCalls, fault);
  expect(
    entry,
    'expected an ABLogger.error entry associating the original fault (err) with failedPhase and fullWriteCommitted on the same entry'
  ).toBeDefined();
  expect(entry.err).toBe(fault);
  expect(entry.failedPhase).toBe(failedPhase);
  expect(entry.fullWriteCommitted).toBe(fullWriteCommitted);
}

const headItem = (assignment) => assignment.submissions[0].items[HEAD_TASK_ID];
const imageItem = (assignment) =>
  Object.values(assignment.submissions[0].items).find((item) => item.getType() === 'IMAGE');
const dropTaskItem = (assignment) => {
  delete assignment.submissions[0].items[SIBLING_TASK_ID];
};
const makePendingImage = (assignment) => {
  const item = imageItem(assignment);
  item.artifact.content = null;
  item.artifact.contentHash = null;
  item.artifact.metadata = { sourceUrl: 'https://docs.google.com/export' };
  return item;
};
const sharedArtefact = (assignment, taskId, role) =>
  assignment.assignmentDefinition.tasks[taskId].artifacts[role][0];
const unusableShared = (assignment, taskId, role) => {
  const artefact = sharedArtefact(assignment, taskId, role);
  artefact.content = null;
  artefact.contentHash = null;
  return artefact;
};

describe('ABClassAssignmentOps sub-class', () => {
  it('is available in GREEN phase (module exists)', () => {
    expect(() => require(MODULE_PATH)).not.toThrow();
  });

  it('is exported as a class (GREEN phase)', () => {
    expect(typeof ABClassAssignmentOps).toBe('function');
  });

  it('constructs an instance with options (GREEN phase)', () => {
    const instance = new ABClassAssignmentOps({ dbManager: {}, validation: {}, persistence: {} });
    expect(instance).toBeInstanceOf(ABClassAssignmentOps);
  });

  it('wires the real validation and persistence preparation collaborators over the same hermetic stores', () => {
    const { ops, persistence, validation, db } = buildCompletedRun();
    expect(validation).toBeInstanceOf(ABClassValidation);
    expect(persistence).toBeInstanceOf(ABClassPersistence);
    expect(ops._validation).toBe(validation);
    expect(ops._persistence).toBe(persistence);
    expect(persistence._dbManager).toBe(db);
    expect(typeof persistence._prepareClassAndPartial).toBe('function');
    expect(typeof persistence._prepareClassPartial).toBe('function');
  });

  describe('methods (GREEN phase)', () => {
    const expectedMethods = [
      '_loadFullAssignmentDocument',
      '_validateAssignmentDocument',
      '_ensureFullDefinition',
      '_getFullAssignmentCollectionName',
      'persistAssignmentRun',
    ];

    expectedMethods.forEach((methodName) => {
      it(`has method ${methodName}`, () => {
        const instance = new ABClassAssignmentOps({
          dbManager: {},
          validation: {},
          persistence: {},
        });
        expect(typeof instance[methodName]).toBe('function');
      });
    });
  });

  describe('persistAssignmentRun partial guard', () => {
    it('should throw TypeError when assignmentDefinition.tasks is an array (partial)', () => {
      const instance = new ABClassAssignmentOps({ dbManager: {}, validation: {}, persistence: {} });

      const abClass = { classId: 'class-1' };
      const assignment = {
        courseId: 'c-1',
        assignmentId: 'a-1',
        assignmentDefinition: { tasks: [] },
      };

      expect(() => instance.persistAssignmentRun(abClass, assignment)).toThrow(TypeError);
    });

    it('should NOT throw partial-guard TypeError when assignmentDefinition.tasks is an object (full)', () => {
      const instance = new ABClassAssignmentOps({ dbManager: {}, validation: {}, persistence: {} });

      const abClass = { classId: 'class-1' };
      const assignment = {
        courseId: 'c-1',
        assignmentId: 'a-1',
        assignmentDefinition: { tasks: { t1: { taskTitle: 'X' } } },
      };

      let thrown;
      try {
        instance.persistAssignmentRun(abClass, assignment);
      } catch (err) {
        thrown = err;
      }

      // The guard should have passed; if an error is thrown further down the
      // method (due to missing mocks), it must not be the partial-guard TypeError
      if (thrown) {
        const isPartialGuardError =
          thrown instanceof TypeError && thrown.message.includes('partial assignmentDefinition');
        expect(isPartialGuardError).toBe(false);
      }
    });
  });
});

describe('persistAssignmentRun completion gate', () => {
  // Every probe restores the healthy canonical run first and then corrupts the
  // in-memory model, so each row is an isolated post-restoration invalid state.
  // The pattern pairs pin the contextual rejection reason — the owning task
  // plus its invalidity class (missing criterion, known-task coverage, unusable
  // hash, unusable shared content, result corruption) — so a wiring fault such
  // as a missing collaborator method can never satisfy a rejection row.
  const taskPattern = (taskId) => new RegExp(taskId, 'i');
  const gateProbes = [
    [
      'an in-flight item with an empty assessment map',
      (a) => (headItem(a).assessments = {}),
      [
        taskPattern(HEAD_TASK_ID),
        /criterion|criteria|assessment|result|terminal|incomplete|empty/i,
      ],
    ],
    [
      'an incomplete criterion map missing accuracy',
      (a) => delete headItem(a).assessments.accuracy,
      [taskPattern(HEAD_TASK_ID), /accuracy/i],
    ],
    [
      'an extra criterion key',
      (a) => (headItem(a).assessments.extra = { score: 3, reasoning: 'noise' }),
      [taskPattern(HEAD_TASK_ID), /extra|unexpected|unknown|criterion|criteria/i],
    ],
    [
      'an unusable shared reference artefact',
      (a) => unusableShared(a, HEAD_TASK_ID, 'reference'),
      [taskPattern(HEAD_TASK_ID), /reference|shared|content|hash/i],
    ],
    [
      'an unusable shared template artefact',
      (a) => unusableShared(a, SIBLING_TASK_ID, 'template'),
      [taskPattern(SIBLING_TASK_ID), /template|shared|content|hash/i],
    ],
    [
      'an empty required reference artefact array',
      (a) => (a.assignmentDefinition.tasks[HEAD_TASK_ID].artifacts.reference = []),
      [taskPattern(HEAD_TASK_ID), /reference/i],
    ],
    [
      'an empty required template artefact array',
      (a) => (a.assignmentDefinition.tasks[SIBLING_TASK_ID].artifacts.template = []),
      [taskPattern(SIBLING_TASK_ID), /template/i],
    ],
    [
      'a matched pending IMAGE with null content beside a source URL',
      makePendingImage,
      [taskPattern(SIBLING_TASK_ID), /image|pending|hydrat|content/i],
    ],
    [
      'a document-bearing submission missing a known task item',
      dropTaskItem,
      [taskPattern(SIBLING_TASK_ID), /task|missing|coverage|incomplete|known/i],
    ],
    [
      'shared reference content with a null hash',
      (a) => (sharedArtefact(a, HEAD_TASK_ID, 'reference').contentHash = null),
      [taskPattern(HEAD_TASK_ID), /hash/i],
    ],
    [
      'shared template content with an empty hash',
      (a) => (sharedArtefact(a, SIBLING_TASK_ID, 'template').contentHash = ''),
      [taskPattern(SIBLING_TASK_ID), /hash/i],
    ],
    [
      'present student TEXT content with a missing hash',
      (a) => delete headItem(a).artifact.contentHash,
      [taskPattern(HEAD_TASK_ID), /hash/i],
    ],
    [
      'hydrated student IMAGE content with a null hash',
      (a) => (imageItem(a).artifact.contentHash = null),
      [taskPattern(SIBLING_TASK_ID), /hash/i],
    ],
    [
      'a terminal map with an out-of-range numeric score',
      (a) => (headItem(a).assessments.completeness = { score: 6, reasoning: 'x' }),
      [taskPattern(HEAD_TASK_ID), /completeness|score|range|criterion|criteria/i],
    ],
    [
      'a terminal map with a non-finite numeric score',
      (a) => (headItem(a).assessments.accuracy = { score: NaN, reasoning: 'x' }),
      [taskPattern(HEAD_TASK_ID), /accuracy|score|finite|number|criterion|criteria/i],
    ],
    [
      'a terminal map with blank E reasoning',
      (a) =>
        (headItem(a).assessments.completeness = {
          score: 'E',
          reasoning: '   ',
          error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
        }),
      [taskPattern(HEAD_TASK_ID), /reasoning/i],
    ],
    [
      'a terminal map with a malformed E cause',
      (a) =>
        (headItem(a).assessments.accuracy = {
          score: 'E',
          reasoning: 'x',
          error: { stage: 'bogus-stage', code: 'NOT_A_CODE' },
        }),
      [taskPattern(HEAD_TASK_ID), /stage|code|cause|error|invalid/i],
    ],
    [
      'a terminal map with error metadata on a non-E result',
      (a) =>
        (headItem(a).assessments.spag = {
          score: 3,
          reasoning: 'noise',
          error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
        }),
      [taskPattern(HEAD_TASK_ID), /error|unexpected|criterion|criteria|invalid/i],
    ],
  ];

  it.each(gateProbes)(
    'rejects %s before any collection mutation with a contextual reason',
    (_label, mutate, patterns) => {
      const { assignment, abClass, ops, db } = buildCompletedRun();
      mutate(assignment);
      const thrown = captureThrown(() => ops.persistAssignmentRun(abClass, assignment));
      expect(thrown).toBeInstanceOf(Error);
      for (const pattern of patterns) expect(thrown.message).toMatch(pattern);
      expect(writeEvents(db)).toEqual([]);
    }
  );
});

describe('persistAssignmentRun completed-run persistence', () => {
  it('persists a healthy canonical run with terminal numeric, N and acquisition-error items', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    expect(() => ops.persistAssignmentRun(abClass, assignment)).not.toThrow();
    const payload = persistedFullPayload(db, assignment);
    expect(payload.submissions).toHaveLength(6);
    expect(payload.submissions[5].items[SIBLING_TASK_ID].assessments.spag.score).toBe(5);
    expect(payload.submissions[0].items[HEAD_TASK_ID].assessments.spag.score).toBe('N');
    const placeholder = payload.submissions[2].items[HEAD_TASK_ID];
    expect(placeholder.artifact.content).toBeNull();
    expect(Object.values(placeholder.assessments).map(({ score }) => score)).toEqual([
      'E',
      'E',
      'E',
    ]);
  });

  it('persists an atomic extraction image error beside hydrated siblings', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    const item = imageItem(assignment);
    item.setError('extraction', 'IMAGE_HYDRATION_FAILED');
    item.artifact.content = null;
    item.artifact.contentHash = null;
    expect(() => ops.persistAssignmentRun(abClass, assignment)).not.toThrow();
    const stored = persistedFullPayload(db, assignment).submissions[0].items[item.taskId];
    for (const entry of Object.values(stored.assessments)) {
      expect(entry.error).toEqual({ stage: 'extraction', code: 'IMAGE_HYDRATION_FAILED' });
    }
    expect(stored.artifact.content).toBeNull();
  });

  it('persists a genuine no-submission with a null document and empty item map', () => {
    const record = clone(loadBackendModelInputs('small').assignmentsByKey[FIXTURE_ASSIGNMENT_ID]);
    record.submissions[0].documentId = null;
    record.submissions[0].items = {};
    const { assignment, abClass, ops, db } = buildCompletedRun(record);
    expect(() => ops.persistAssignmentRun(abClass, assignment)).not.toThrow();
    const payload = persistedFullPayload(db, assignment);
    expect(payload.submissions[0].documentId).toBeNull();
    expect(payload.submissions[0].items).toEqual({});
  });

  it('persists blank student content with a usable hash beside terminal marks', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    const item = headItem(assignment);
    item.artifact.content = '';
    item.artifact.contentHash = 'hash-of-blank-content';
    expect(() => ops.persistAssignmentRun(abClass, assignment)).not.toThrow();
    const stored = persistedFullPayload(db, assignment).submissions[0].items[item.taskId];
    expect(stored.artifact.content).toBe('');
    expect(stored.artifact.contentHash).toBe('hash-of-blank-content');
  });

  it('stamps assessmentContractVersion 1 on the full record and the embedded partial of a completed run', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    delete assignment.assessmentContractVersion;
    ops.persistAssignmentRun(abClass, assignment);
    expect(persistedFullPayload(db, assignment).assessmentContractVersion).toBe(1);
    const embedded = abClass.assignments.find(
      (entry) => entry.assignmentId === assignment.assignmentId
    );
    expect(embedded.toPartialJSON().assessmentContractVersion).toBe(1);
  });
});

describe('persistAssignmentRun prepared projections', () => {
  it('prepares all four projections before the first collection mutation', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    const spies = [
      vi.spyOn(assignment, 'toJSON'),
      vi.spyOn(assignment, 'toPartialJSON'),
      vi.spyOn(abClass, 'toJSON'),
      vi.spyOn(abClass, 'toPartialJSON'),
    ];
    ops.persistAssignmentRun(abClass, assignment);
    const calls = Object.values(fullStore(db, assignment)).flatMap(
      (mock) => mock.mock.invocationCallOrder
    );
    const firstStoreCall = Math.min(...calls);
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.invocationCallOrder[0]).toBeLessThan(firstStoreCall);
    }
  });

  it('yields zero collection mutations when the embedded partial projection fails', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    const fault = new Error('partial projection failed');
    const phase = PERSIST_FAILURE_PHASES.embeddedPartialProjection;
    vi.spyOn(assignment, 'toPartialJSON').mockImplementation(() => {
      throw fault;
    });
    const { thrown, errorCalls } = captureRunWithDiagnostics(() =>
      ops.persistAssignmentRun(abClass, assignment)
    );
    expect(thrown).toBe(fault);
    expect(writeEvents(db)).toEqual([]);
    expectPersistFailureDiagnostics(errorCalls, fault, phase, false);
  });

  it('yields zero collection mutations when the prospective class projection fails', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    const fault = new Error('class projection failed');
    const phase = PERSIST_FAILURE_PHASES.prospectiveClassProjection;
    vi.spyOn(abClass, 'toJSON').mockImplementation(() => {
      throw fault;
    });
    const { thrown, errorCalls } = captureRunWithDiagnostics(() =>
      ops.persistAssignmentRun(abClass, assignment)
    );
    expect(thrown).toBe(fault);
    expect(writeEvents(db)).toEqual([]);
    expectPersistFailureDiagnostics(errorCalls, fault, phase, false);
  });
});

describe('persistAssignmentRun write order', () => {
  it('writes the full assignment store in one find-then-mutate-then-save sequence', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    ops.persistAssignmentRun(abClass, assignment);
    const name = `assign_full_${assignment.courseId}_${assignment.assignmentId}`;
    expect(db.events).toEqual([`${name}.findOne`, `${name}.insertOne`, `${name}.save`]);
  });
});
