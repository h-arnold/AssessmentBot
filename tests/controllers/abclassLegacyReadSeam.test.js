/**
 * Legacy read seam through the real controller/store.
 *
 * `abclassLegacyAssessmentPersistence.test.js` pins opaque retention across a
 * model-level read and ordinary save; this companion drives the legacy record
 * through the real `ABClassController.readClass` (class read) and
 * `ABClassAssignmentOps.readRehydrateAssignment` (full read), exercising the
 * activated `'legacy'` wire marker and preparation owner end to end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { restoreGlobals, saveGlobals } from '#test-helpers/globalMockManager.js';
import {
  createMockCollection,
  setupControllerTestMocks,
  cleanupControllerTestMocks,
} from '../helpers/mockFactories.js';

const ABClass = require('#backend/Models/ABClass.js').ABClass;
const Teacher = require('#backend/Models/Teacher.js').Teacher;
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');

const ABClassAssignmentOps = globalThis.ABClassAssignmentOps;
const CORRUPT_RECORD = { stage: 'validation', code: 'CORRUPT_RECORD' };

const CLASS_ID = 'class-0';
const ASSIGNMENT_ID = 'assignment-0-1';
const CRITERIA = ['completeness', 'accuracy', 'spag'];

/** Canonical class document with the selected assignment marked as stored legacy. */
function storedLegacyClassDocument() {
  const document = structuredClone(loadBackendModelInputs('small').classesById[CLASS_ID]);
  const embedded = document.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
  Reflect.deleteProperty(embedded, 'assessmentContractVersion');
  return document;
}

/** Canonical standalone full document marked as stored legacy. */
function storedLegacyFullRecord() {
  const record = structuredClone(loadBackendModelInputs('small').assignmentsByKey[ASSIGNMENT_ID]);
  Reflect.deleteProperty(record, 'assessmentContractVersion');
  return record;
}

/** Reports whether an item carries the exact all-criteria CORRUPT_RECORD map. */
function isCorruptItem(item) {
  return CRITERIA.every(
    (criterion) =>
      item?.assessments?.[criterion]?.score === 'E' &&
      item.assessments[criterion].error?.stage === CORRUPT_RECORD.stage &&
      item.assessments[criterion].error?.code === CORRUPT_RECORD.code
  );
}

let savedGlobals;
let classCollection;
let fullCollection;
let dbManager;

beforeEach(() => {
  savedGlobals = saveGlobals([
    'ABClass',
    'Teacher',
    'Assignment',
    'ABClassController',
    'DateUtils',
    'DbManager',
    'ABLogger',
    'AssignmentDefinitionController',
  ]);
  setupControllerTestMocks(vi);
  classCollection = createMockCollection(vi);
  fullCollection = createMockCollection(vi);
  dbManager = {
    getCollection: vi.fn((name) =>
      name.startsWith('assign_full_') ? fullCollection : classCollection
    ),
  };
  globalThis.DbManager = { getInstance: () => dbManager };
  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Assignment = Assignment;
  globalThis.ABClassController = ABClassController;
  globalThis.DateUtils = { ...globalThis.DateUtils, deepConvertDates: vi.fn((value) => value) };
});

afterEach(() => {
  cleanupControllerTestMocks();
  restoreGlobals(savedGlobals);
  vi.restoreAllMocks();
});

describe('legacy class read wire marker at the controller seam', () => {
  it('reads the embedded partial with the legacy marker and retains the stored submission identities', () => {
    const document = storedLegacyClassDocument();
    const embedded = document.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
    const storedBefore = structuredClone(document);
    classCollection.findOne.mockReturnValue(document);

    const view = new ABClassController().readClass(CLASS_ID);
    const assignment = view.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);

    expect(assignment.assessmentContractVersion).toBe('legacy');
    expect(assignment.assignmentDefinitionKey).toBe(embedded.assignmentDefinition.definitionKey);
    expect(assignment).not.toHaveProperty('assignmentDefinition');
    expect(assignment.submissions.length).toBe(embedded.submissions.length);
    expect(assignment.submissions.map((submission) => submission.studentId).sort()).toEqual(
      embedded.submissions.map((submission) => submission.studentId).sort()
    );
    // The class read is a projection: the stored document is unchanged.
    expect(document).toEqual(storedBefore);
    for (const operation of ['insertOne', 'replaceOne', 'updateOne', 'deleteOne', 'save']) {
      expect(classCollection[operation]).not.toHaveBeenCalled();
    }
  });

  it('retains valid legacy scores on the class read, never blanket E', () => {
    const document = storedLegacyClassDocument();
    classCollection.findOne.mockReturnValue(document);

    const view = new ABClassController().readClass(CLASS_ID);
    const assignment = view.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
    const scores = assignment.submissions.flatMap((submission) =>
      Object.values(submission.items).flatMap((item) => Object.values(item.assessments))
    );

    expect(scores.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
    // Stored explicit E stays E with its original cause; corruption is the only
    // new E, so the read is never a blanket replacement.
    const errorCodes = scores
      .filter((entry) => entry.score === 'E')
      .map((entry) => entry.error?.code);
    expect(errorCodes).not.toHaveLength(0);
    expect(errorCodes.every((code) => code !== 'CORRUPT_RECORD')).toBe(true);
  });

  it('isolates a malformed legacy item map as per-task CORRUPT_RECORD E without blocking neighbours', () => {
    const document = storedLegacyClassDocument();
    const embedded = document.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
    const taskIds = embedded.assignmentDefinition.tasks.map((task) => task.taskId);
    embedded.submissions[0].items = null;
    const healthyBefore = structuredClone(embedded.submissions[1]);
    classCollection.findOne.mockReturnValue(document);

    const view = new ABClassController().readClass(CLASS_ID);
    const assignment = view.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);

    for (const taskId of taskIds) {
      expect(isCorruptItem(assignment.submissions[0].items[taskId])).toBe(true);
    }
    expect(assignment.submissions[1].items).toEqual(healthyBefore.items);
    expect(assignment.assessmentContractVersion).toBe('legacy');
  });

  it('emits a preserved non-array submissions root with the legacy marker instead of throwing', () => {
    const document = storedLegacyClassDocument();
    const embedded = document.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
    embedded.submissions = null;
    classCollection.findOne.mockReturnValue(document);

    const view = new ABClassController().readClass(CLASS_ID);
    const assignment = view.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);

    expect(assignment.assessmentContractVersion).toBe('legacy');
    expect(assignment.submissions).toBeNull();
  });
});

describe('legacy full read wire marker at the controller seam', () => {
  it('rehydrates the full record with the legacy marker and retains real scores and content', () => {
    const record = storedLegacyFullRecord();
    const storedBefore = structuredClone(record);
    fullCollection.findOne.mockReturnValue(record);
    const ops = new ABClassAssignmentOps({ dbManager, validation: {}, persistence: {} });

    const read = ops.readRehydrateAssignment(CLASS_ID, ASSIGNMENT_ID).toReadJSON();

    expect(read.assessmentContractVersion).toBe('legacy');
    const items = read.submissions.flatMap((submission) => Object.values(submission.items));
    expect(items.some((item) => item.artifact.content !== null)).toBe(true);
    const scores = items.flatMap((item) => Object.values(item.assessments));
    expect(scores.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
    expect(record).toEqual(storedBefore);
    for (const operation of ['insertOne', 'replaceOne', 'updateOne', 'deleteOne', 'save']) {
      expect(fullCollection[operation]).not.toHaveBeenCalled();
    }
  });

  it('keeps a stored explicit reassessment error on the full read', () => {
    const record = storedLegacyFullRecord();
    const taskId = Object.keys(record.submissions[0].items)[0];
    const reassessment = {
      score: 'E',
      reasoning: 'Reassessment required',
      error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' },
    };
    record.submissions[0].items[taskId].assessments = {
      completeness: reassessment,
      accuracy: reassessment,
      spag: reassessment,
    };
    fullCollection.findOne.mockReturnValue(record);
    const ops = new ABClassAssignmentOps({ dbManager, validation: {}, persistence: {} });

    const read = ops.readRehydrateAssignment(CLASS_ID, ASSIGNMENT_ID).toReadJSON();

    expect(read.assessmentContractVersion).toBe('legacy');
    expect(read.submissions[0].items[taskId].assessments.completeness.error.code).toBe(
      'REASSESSMENT_REQUIRED'
    );
  });
});
