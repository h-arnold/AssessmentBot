import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { ABClass } from '#backend/Models/ABClass.js';
import { clone, mockDb, TEACHER_GLOBAL } from './abclassPersistenceTestHelpers.js';

const MODULE_PATH = '#backend/y_controllers/ABClassController/ABClassPersistence.js';
const ABClassPersistence = require(MODULE_PATH);
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassAssignmentOps = require('#backend/y_controllers/ABClassController/ABClassAssignmentOps.js');
const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');

describe('ABClassPersistence sub-class', () => {
  it('is available in GREEN phase (module exists)', () => {
    expect(() => require(MODULE_PATH)).not.toThrow();
  });

  it('is exported as a class (GREEN phase)', () => {
    expect(typeof ABClassPersistence).toBe('function');
  });

  it('constructs an instance with options (GREEN phase)', () => {
    const instance = new ABClassPersistence({
      dbManager: {},
      validation: {},
    });
    expect(instance).toBeInstanceOf(ABClassPersistence);
  });

  describe('methods (GREEN phase)', () => {
    const expectedMethods = ['persistClassAndPartial', '_upsertClassPartial'];

    expectedMethods.forEach((methodName) => {
      it(`has method ${methodName}`, () => {
        const instance = new ABClassPersistence({
          dbManager: {},
          validation: {},
        });
        expect(typeof instance[methodName]).toBe('function');
      });
    });
  });
});

describe('ABClassPersistence prepared graph capture, consumption and independence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Canonical small class-1 has non-null metadata; assignment-1-1 supplies
  // assessment E entries and the numeric task-2-0 item at the index below.
  const FOUR_GRAPH_CLASS_ID = 'class-1';
  const FOUR_GRAPH_ASSIGNMENT_ID = 'assignment-1-1';
  const FOUR_GRAPH_TASK_ID = 'task-2-0';
  const NUMERIC_SUBMISSION_INDEX = 3;

  /**
   * Restores canonical inputs once, wiring real ops and the same persistence
   * owner over hermetic stores as the facade does. Only the production chain
   * prepares the four graphs; serializer/store spies capture them.
   */
  function buildFourGraphRun() {
    const inputs = loadBackendModelInputs('small');
    const assignment = Assignment.fromJSON(
      clone(inputs.assignmentsByKey[FOUR_GRAPH_ASSIGNMENT_ID]),
      'full'
    );
    const abClass = withTemporaryGlobals(TEACHER_GLOBAL, () =>
      ABClass.fromJSON(clone(inputs.classesById[FOUR_GRAPH_CLASS_ID]))
    );
    const db = mockDb();
    const validation = new ABClassValidation();
    const persistence = new ABClassPersistence({ dbManager: db, validation });
    const ops = new ABClassAssignmentOps({ dbManager: db, validation, persistence });
    return { assignment, abClass, db, ops, persistence };
  }

  /**
   * Mirrors facade delegation: real ops writes the full assignment, then the
   * same persistence owner consumes its prepared return for class/registry writes.
   */
  function runConnectedPersistChain(ops, persistence, abClass, assignment) {
    const prepared = ops.persistAssignmentRun(abClass, assignment);
    persistence.persistClassAndPartial(abClass, prepared);
  }

  /** Full assignment collection name for the scenario's dedicated store. */
  function fullStoreName(assignment) {
    return `assign_full_${assignment.courseId}_${assignment.assignmentId}`;
  }

  it.each([
    ['class-1', 'class-store', 1],
    ['abclass_partials', 'class-partials-store', 2],
  ])(
    'diagnoses %s collection acquisition after the full assignment commits',
    (name, phase, savedStores) => {
      const { assignment, abClass, db, ops, persistence } = buildFourGraphRun();
      const fault = new Error(`${name} collection acquisition failed`);
      const getCollection = db.getCollection;
      const accessSpy = vi.spyOn(db, 'getCollection').mockImplementation((collectionName) => {
        if (collectionName === name) throw fault;
        return getCollection(collectionName);
      });
      const logger = require('#backend/Utils/ABLogger.js').getInstance();
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const run = vi.fn(() => runConnectedPersistChain(ops, persistence, abClass, assignment));
      expect(run).toThrow(fault);
      expect(run.mock.results[0].value).toBe(fault);
      const fullName = fullStoreName(assignment);
      expect(db.collections[fullName].save).toHaveBeenCalledTimes(1);
      expect(accessSpy.mock.calls.map(([key]) => key)).toEqual(
        [fullName, abClass.classId, 'abclass_partials'].slice(0, savedStores + 1)
      );
      expect(db.events).toEqual(
        [fullName, abClass.classId]
          .slice(0, savedStores)
          .flatMap((key) => ['findOne', 'insertOne', 'save'].map((op) => `${key}.${op}`))
      );
      const entry = errorSpy.mock.calls.map((call) => call[1]).find((data) => data?.err === fault);
      expect(entry, 'same-entry original fault and phase/commit diagnostic').toBeDefined();
      expect(entry.err).toBe(fault);
      expect(entry.failedPhase).toBe(phase);
      expect(entry.fullWriteCommitted).toBe(true);
    }
  );

  /** Identity fields shared by full and partial assignment projections. */
  const ASSIGNMENT_IDENTITY_FIELDS = [
    'courseId',
    'assignmentId',
    'assignmentName',
    'documentType',
    'createdAt',
    'updatedAt',
  ];
  /** Identity fields shared by full and partial submission projections. */
  const SUBMISSION_IDENTITY_FIELDS = [
    'studentId',
    'studentName',
    'assignmentId',
    'documentId',
    'createdAt',
    'updatedAt',
  ];

  /**
   * Pins faithful redaction: identities/feedback/metadata unchanged, E intact,
   * numeric/N score-only, and artefact body/hash null.
   */
  function expectPartialRedactsFull(full, partial) {
    for (const field of ASSIGNMENT_IDENTITY_FIELDS) {
      expect(partial[field], field).toBe(full[field]);
    }
    expect(partial.submissions).toHaveLength(full.submissions.length);
    full.submissions.forEach((fullSubmission, submissionIndex) => {
      const partialSubmission = partial.submissions[submissionIndex];
      for (const field of SUBMISSION_IDENTITY_FIELDS) {
        expect(partialSubmission[field], `submissions[${submissionIndex}].${field}`).toBe(
          fullSubmission[field]
        );
      }
      expect(Object.keys(partialSubmission.items)).toEqual(Object.keys(fullSubmission.items));
      for (const [taskId, fullItem] of Object.entries(fullSubmission.items)) {
        const partialItem = partialSubmission.items[taskId];
        expect(partialItem.taskId, `submissions[${submissionIndex}].${taskId}.taskId`).toBe(
          fullItem.taskId
        );
        for (const field of ['type', 'uid', 'pageId', 'documentId']) {
          expect(partialItem.artifact[field], `${taskId}.artifact.${field}`).toBe(
            fullItem.artifact[field]
          );
        }
        expect(partialItem.artifact.metadata).toEqual(fullItem.artifact.metadata);
        expect(partialItem.artifact.content).toBeNull();
        expect(partialItem.artifact.contentHash).toBeNull();
        expect(partialItem.feedback).toEqual(fullItem.feedback);
        for (const [criterion, fullEntry] of Object.entries(fullItem.assessments)) {
          const partialEntry = partialItem.assessments[criterion];
          if (fullEntry.score === 'E') {
            expect(partialEntry, `${taskId}.${criterion} E entry`).toEqual(fullEntry);
          } else {
            expect(partialEntry, `${taskId}.${criterion} numeric/N entry`).toEqual({
              score: fullEntry.score,
            });
          }
        }
      }
    });
  }

  it('writes prepared payloads once and installs the sole pre-write partial construction', () => {
    const { assignment, abClass, db, ops, persistence } = buildFourGraphRun();
    const classToJSONSpy = vi.spyOn(abClass, 'toJSON');
    const classPartialSpy = vi.spyOn(abClass, 'toPartialJSON');
    const assignmentToJSONSpy = vi.spyOn(assignment, 'toJSON');
    const assignmentPartialSpy = vi.spyOn(assignment, 'toPartialJSON');
    // Observe actual partial construction only, never a validation-only round-trip.
    const restoreSpy = vi.spyOn(Assignment, 'fromJSON');

    runConnectedPersistChain(ops, persistence, abClass, assignment);

    expect(classToJSONSpy).toHaveBeenCalledTimes(1);
    expect(classPartialSpy).toHaveBeenCalledTimes(1);
    expect(assignmentToJSONSpy).toHaveBeenCalledTimes(1);
    expect(assignmentPartialSpy).toHaveBeenCalledTimes(1);

    const writtenClass = db.collections[FOUR_GRAPH_CLASS_ID].insertOne.mock.calls[0][0];
    const writtenRegistry = db.collections['abclass_partials'].insertOne.mock.calls[0][0];
    expect(writtenClass).toEqual(classToJSONSpy.mock.results[0].value);
    expect(writtenRegistry).toEqual(classPartialSpy.mock.results[0].value);
    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy.mock.calls[0]).toEqual([
      assignmentPartialSpy.mock.results[0].value,
      'partial',
    ]);
    expect(restoreSpy.mock.invocationCallOrder[0]).toBeGreaterThan(
      assignmentPartialSpy.mock.invocationCallOrder[0]
    );
    const firstMutation = Math.min(
      ...Object.values(db.collections).flatMap((store) =>
        ['insertOne', 'replaceOne', 'save'].flatMap((op) => store[op].mock.invocationCallOrder)
      )
    );
    expect(restoreSpy.mock.invocationCallOrder[0]).toBeLessThan(firstMutation);
    expect(
      abClass.assignments.find((entry) => entry.assignmentId === assignment.assignmentId)
    ).toBe(restoreSpy.mock.results[0].value);
  });

  it('persists class and registry payloads whose overlapping fields match the production-prepared full and partial assignment projections', () => {
    const { assignment, abClass, db, ops, persistence } = buildFourGraphRun();
    const expectedMetadata = clone(abClass.metadata);
    const assignmentToJSONSpy = vi.spyOn(assignment, 'toJSON');
    const assignmentPartialSpy = vi.spyOn(assignment, 'toPartialJSON');

    runConnectedPersistChain(ops, persistence, abClass, assignment);

    const preparedFull = clone(assignmentToJSONSpy.mock.results[0].value);
    const preparedPartial = clone(assignmentPartialSpy.mock.results[0].value);
    const writtenClass = db.collections[FOUR_GRAPH_CLASS_ID].insertOne.mock.calls[0][0];
    const writtenRegistry = db.collections['abclass_partials'].insertOne.mock.calls[0][0];
    const embedded = writtenClass.assignments.find(
      (entry) => entry.assignmentId === FOUR_GRAPH_ASSIGNMENT_ID
    );

    expect(embedded).toEqual(preparedPartial);
    expect(embedded.assessmentContractVersion).toBe(1);
    expect(preparedFull.assessmentContractVersion).toBe(1);
    expect(Object.hasOwn(writtenRegistry, 'assignments')).toBe(false);
    expect(writtenClass.metadata).toEqual(expectedMetadata);
    expect(writtenRegistry.metadata).toEqual(expectedMetadata);
    expect(writtenRegistry.metadata).not.toBe(writtenClass.metadata);
    expect(writtenRegistry.metadata.classAverages).not.toBe(writtenClass.metadata.classAverages);
    const numericFullItem =
      preparedFull.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID];
    const numericPartialItem =
      preparedPartial.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID];
    expect(numericFullItem.artifact.content).not.toBeNull();
    expect(numericPartialItem.artifact.content).toBeNull();
    expectPartialRedactsFull(preparedFull, preparedPartial);
  });

  // Save-seam detachment: the payloads written for storage are the serialiser
  // projections prepared before the first store mutation, with metadata rebuilt
  // through ABClassMetadata at the seam. The tests below mutate only nodes the
  // seam and serialisers provably detach, so a seam that stores live model
  // state, or re-projects after the full commit, fails them.
  it('consumes the exact pre-full-commit prepared graphs when the input models mutate at the full-store save seam', () => {
    const { assignment, abClass, db, ops, persistence } = buildFourGraphRun();
    const expectedFull = clone(assignment.toJSON());
    const expectedPartial = clone(assignment.toPartialJSON());
    const expectedMetadata = clone(abClass.metadata);
    db.getCollection(fullStoreName(assignment)).save.mockImplementation(() => {
      // The full store has committed: every later write must consume the
      // payloads prepared before it, so input-model mutation at this seam
      // must not reach any store write.
      assignment.assignmentName = 'mutated after full commit';
      assignment.submissions.push({ studentId: 'late-submission', items: {} });
      abClass.metadata.classAverages.completeness = 0;
    });

    runConnectedPersistChain(ops, persistence, abClass, assignment);

    const writtenFull = db.collections[fullStoreName(assignment)].insertOne.mock.calls[0][0];
    const writtenClass = db.collections[FOUR_GRAPH_CLASS_ID].insertOne.mock.calls[0][0];
    const writtenRegistry = db.collections['abclass_partials'].insertOne.mock.calls[0][0];
    const embedded = writtenClass.assignments.find(
      (entry) => entry.assignmentId === FOUR_GRAPH_ASSIGNMENT_ID
    );
    expect(
      embedded,
      'the class write must consume the prepared embedded partial, not a post-commit re-projection of the mutated model'
    ).toEqual(expectedPartial);
    expect(writtenFull).toEqual(expectedFull);
    expect(writtenClass.metadata).toEqual(expectedMetadata);
    expect(writtenRegistry.metadata).toEqual(expectedMetadata);
  });

  it('keeps the persisted graphs and the input models independent when a persisted graph node is mutated', () => {
    const { assignment, abClass, db, ops, persistence } = buildFourGraphRun();
    const expectedMetadata = clone(abClass.metadata);

    runConnectedPersistChain(ops, persistence, abClass, assignment);

    const writtenFull = db.collections[fullStoreName(assignment)].insertOne.mock.calls[0][0];
    const writtenClass = db.collections[FOUR_GRAPH_CLASS_ID].insertOne.mock.calls[0][0];
    const writtenRegistry = db.collections['abclass_partials'].insertOne.mock.calls[0][0];
    const embedded = writtenClass.assignments.find(
      (entry) => entry.assignmentId === FOUR_GRAPH_ASSIGNMENT_ID
    );
    const instance = abClass.assignments.find(
      (entry) => entry.assignmentId === FOUR_GRAPH_ASSIGNMENT_ID
    );
    expect(Array.isArray(instance.assignmentDefinition.tasks)).toBe(true);
    expect(
      instance.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID].artifact.content
    ).toBeNull();

    writtenRegistry.metadata.classAverages.accuracy = 0;
    expect(writtenClass.metadata).toEqual(expectedMetadata);
    expect(abClass.metadata).toEqual(expectedMetadata);

    writtenClass.metadata.classAverages.spag = 'E';
    expect(abClass.metadata).toEqual(expectedMetadata);

    const numericEntry =
      embedded.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID].assessments
        .completeness;
    numericEntry.score = 1;
    expect(
      instance.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID].assessments
        .completeness.score
    ).toBe(3);
    expect(
      assignment.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID].assessments
        .completeness.score
    ).toBe(3);

    writtenFull.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID].artifact.content =
      'payload-only';
    expect(
      assignment.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID].artifact.content
    ).not.toBe('payload-only');
  });

  it('keeps the persisted class and registry payloads independent of the input assignment model', () => {
    const { assignment, abClass, db, ops, persistence } = buildFourGraphRun();
    const expectedPartial = clone(assignment.toPartialJSON());
    const expectedMetadata = clone(abClass.metadata);
    db.getCollection(FOUR_GRAPH_CLASS_ID).findOne.mockImplementation(() => {
      // Between the full-assignment commit and the class write the input
      // models mutate: the class and registry writes must still receive the
      // payloads prepared before the full store was touched.
      assignment.assignmentName = 'mutated assignment model';
      assignment.submissions.push({ studentId: 'late-submission', items: {} });
      assignment.submissions[NUMERIC_SUBMISSION_INDEX].items[
        FOUR_GRAPH_TASK_ID
      ].assessments.completeness.score = 1;
      abClass.metadata.classAverages.accuracy = 0;
      return null;
    });

    runConnectedPersistChain(ops, persistence, abClass, assignment);

    const writtenClass = db.collections[FOUR_GRAPH_CLASS_ID].insertOne.mock.calls[0][0];
    const writtenRegistry = db.collections['abclass_partials'].insertOne.mock.calls[0][0];
    const embedded = writtenClass.assignments.find(
      (entry) => entry.assignmentId === FOUR_GRAPH_ASSIGNMENT_ID
    );
    expect(embedded).toEqual(expectedPartial);
    expect(writtenClass.metadata).toEqual(expectedMetadata);
    expect(writtenRegistry.metadata).toEqual(expectedMetadata);
  });

  it('re-prepares both payloads from the current model on a subsequent ordinary class save after the run', () => {
    const { assignment, abClass, db, ops, persistence } = buildFourGraphRun();
    const originalMetadata = clone(abClass.metadata);
    const classToJSONSpy = vi.spyOn(abClass, 'toJSON');
    const classPartialSpy = vi.spyOn(abClass, 'toPartialJSON');
    const restoreSpy = vi.spyOn(Assignment, 'fromJSON');

    runConnectedPersistChain(ops, persistence, abClass, assignment);
    const runRegistryMetadata = clone(
      db.collections['abclass_partials'].insertOne.mock.calls[0][0].metadata
    );
    restoreSpy.mockClear();
    classToJSONSpy.mockClear();
    classPartialSpy.mockClear();
    const selected = abClass.assignments.find(
      (entry) => entry.assignmentId === FOUR_GRAPH_ASSIGNMENT_ID
    );
    selected.submissions[NUMERIC_SUBMISSION_INDEX].items[
      FOUR_GRAPH_TASK_ID
    ].assessments.completeness.score = 1;

    abClass.setMetadata({
      classAverages: {
        completeness: 1.5,
        accuracy: 2.5,
        spag: 'E',
        overall: 2,
        updatedAt: '2026-01-02T03:04:05.000Z',
      },
      recentAssignments: [],
    });
    persistence.persistClassAndPartial(abClass);

    expect(classToJSONSpy).toHaveBeenCalledTimes(1);
    expect(classPartialSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).not.toHaveBeenCalled();
    const registryWrites = db.collections['abclass_partials'].insertOne.mock.calls;
    expect(registryWrites[0][0].metadata).toEqual(originalMetadata);
    expect(registryWrites[0][0].metadata).toEqual(runRegistryMetadata);
    expect(registryWrites[1][0].metadata).toEqual(abClass.metadata);
    expect(registryWrites[1][0].metadata).not.toBe(abClass.metadata);
    const savedSelected = db.collections[
      FOUR_GRAPH_CLASS_ID
    ].insertOne.mock.calls[1][0].assignments.find(
      (entry) => entry.assignmentId === FOUR_GRAPH_ASSIGNMENT_ID
    );
    expect(
      savedSelected.submissions[NUMERIC_SUBMISSION_INDEX].items[FOUR_GRAPH_TASK_ID].assessments
        .completeness.score
    ).toBe(1);
  });
});

describe('ABClassPersistence ordinary save of legacy non-array submissions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const LEGACY_CLASS_ID = 'class-0';
  const LEGACY_ASSIGNMENT_ID = 'assignment-0-1';
  const OBJECT_SUBMISSIONS = {
    legacyStudent: { studentId: 'legacy-student', createdAt: '2019-01-02T03:04:05.000Z' },
  };

  /**
   * Restores the canonical small class with a present non-array legacy
   * `submissions` value on its linked assignment and wires the persistence owner
   * to hermetic stores.
   *
   * @param {object|null} submissions Stored legacy submissions value.
   * @returns {{abClass: Object, db: Object, owner: Object}} Restored class, stores and owner.
   */
  function buildLegacyClassRun(submissions) {
    const inputs = loadBackendModelInputs('small');
    const classView = clone(inputs.classesById[LEGACY_CLASS_ID]);
    const embedded = classView.assignments.find(
      (assignment) => assignment.assignmentId === LEGACY_ASSIGNMENT_ID
    );
    delete embedded.assessmentContractVersion;
    embedded.submissions = submissions;
    const abClass = withTemporaryGlobals(TEACHER_GLOBAL, () => ABClass.fromJSON(classView));
    const db = mockDb();
    const owner = new ABClassPersistence({ dbManager: db, validation: {} });
    return { abClass, db, owner };
  }

  /** Reads the embedded assignment's submissions from the stored class write payload. */
  function storedSubmissions(db, abClass) {
    const stored = db.collections[abClass.classId].insertOne.mock.calls[0][0];
    return stored.assignments.find((assignment) => assignment.assignmentId === LEGACY_ASSIGNMENT_ID)
      .submissions;
  }

  it.each([
    ['object', OBJECT_SUBMISSIONS],
    ['null', null],
  ])('writes the preserved %s submissions value to the class store', (_label, submissions) => {
    const { abClass, db, owner } = buildLegacyClassRun(submissions);
    owner.persistClassAndPartial(abClass);
    expect(storedSubmissions(db, abClass)).toEqual(submissions);
  });

  it('keeps the preserved object value through a save and reload round trip', () => {
    const { abClass, db, owner } = buildLegacyClassRun(OBJECT_SUBMISSIONS);
    owner.persistClassAndPartial(abClass);

    const storedPayload = db.collections[abClass.classId].insertOne.mock.calls[0][0];
    const reloaded = withTemporaryGlobals(TEACHER_GLOBAL, () =>
      ABClass.fromJSON(clone(storedPayload))
    );
    const reloadedAssignment = reloaded.assignments.find(
      (assignment) => assignment.assignmentId === LEGACY_ASSIGNMENT_ID
    );
    expect(reloadedAssignment.submissions).toEqual(OBJECT_SUBMISSIONS);
  });

  it('keeps the restored instance holding the preserved object after the save', () => {
    const { abClass, owner } = buildLegacyClassRun(OBJECT_SUBMISSIONS);
    owner.persistClassAndPartial(abClass);
    const restoredAssignment = abClass.assignments.find(
      (assignment) => assignment.assignmentId === LEGACY_ASSIGNMENT_ID
    );
    expect(restoredAssignment.submissions).toEqual(OBJECT_SUBMISSIONS);
  });
});
