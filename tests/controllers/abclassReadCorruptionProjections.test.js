/**
 * Corruption isolation at the real controller/store read seam.
 *
 * The model-level suites (`assignmentRehydration.current*.test.js`) drive
 * `Assignment.fromJSON` directly, and the legacy persistence suite covers opaque
 * retention and reassessment replacement. Neither drives a corrupted class
 * document through the controller/store seam. This suite does: one identifiable
 * corrupt item inside an otherwise valid canonical class document is read through
 * the real `ABClassController.readClass` path (and the real `getABClass_`
 * transport wrapper) and through the real full-read path
 * (`ABClassAssignmentOps.readRehydrateAssignment` → `toReadJSON`), so both
 * projections are pinned together.
 *
 * CHARACTERISATION: Sections 1–8 already deliver this isolation, so these rows
 * pin existing behaviour. They fail if corruption stops being isolated, if the
 * healthy siblings or either projection regress, or if a repeat read starts
 * mutating the stored document.
 *
 * Proof limits: mocked `DbManager` collections and canonical synthetic inputs
 * only. Nothing here proves live GAS behaviour, deployed logging fidelity or
 * durable JsonDbApp persistence.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { restoreGlobals, saveGlobals } from '#test-helpers/globalMockManager.js';
import { Assessment } from '#backend/Models/Assessment.js';
import { getABClass_ } from '#backend/z_Api/abclass/abclassRead.js';
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
const ClassNotFoundError = globalThis.ClassNotFoundError;
const AssignmentNotFoundError = globalThis.AssignmentNotFoundError;

const CLASS_ID = 'class-0';
const ASSIGNMENT_ID = 'assignment-0-1';
const CORRUPT_TASK_ID = 'task-1-0';
const SIBLING_TASK_ID = 'task-1-1';
const HEALTHY_SUBMISSION_INDEX = 1;

/** Exact validation/CORRUPT_RECORD catalogue entry (detached copy each call). */
const corruptRecordEntry = () => Assessment.createError('validation', 'CORRUPT_RECORD').toJSON();

/** All three criteria as exact catalogue copies. */
const corruptRecordAssessments = () =>
  Object.fromEntries(
    ['completeness', 'accuracy', 'spag'].map((criterion) => [criterion, corruptRecordEntry()])
  );

/** Canonical class document with its partial embedded definitions. */
function canonicalClassDocument() {
  const document = structuredClone(loadBackendModelInputs('small').classesById[CLASS_ID]);
  if (embeddedAssignmentOf(document).submissions.length <= HEALTHY_SUBMISSION_INDEX) {
    throw new Error('Canonical class document does not contain the expected submissions.');
  }
  return document;
}

/** Locates the target assignment inside a stored class document. */
function embeddedAssignmentOf(document) {
  const assignment = document.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
  if (!assignment) {
    throw new Error(`Canonical class document has no "${ASSIGNMENT_ID}" assignment.`);
  }
  return assignment;
}

/** Canonical standalone full record for the same assignment. */
function canonicalFullRecord() {
  return structuredClone(loadBackendModelInputs('small').assignmentsByKey[ASSIGNMENT_ID]);
}

/**
 * Removes the full-mode `contentHash` key from one item of the first submission.
 * The raw-validation owner must reject the record before any constructor fills it.
 *
 * @param {Record<string, unknown>} document Class or full assignment document.
 * @param {Record<string, unknown>} [assignment] Embedded assignment holding the submissions.
 */
function corruptFirstSubmissionItem(document, assignment = document) {
  const submission = assignment.submissions[0];
  expect(submission.items[CORRUPT_TASK_ID]).toBeDefined();
  delete submission.items[CORRUPT_TASK_ID].artifact.contentHash;
  return document;
}

const clone = (value) => structuredClone(value);

/** Locates one assignment entry in a read projection. */
const assignmentOf = (view) =>
  view.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);

/** Locates one submission by student identity. */
const submissionOf = (assignment, studentId) =>
  assignment.submissions.find((submission) => submission.studentId === studentId);

/** Asserts the item is the materialised corrupt placeholder, never dropped. */
function expectCorruptPlaceholder(item) {
  expect(item, 'identified item must be materialised, never dropped').toBeDefined();
  expect(item.assessments).toEqual(corruptRecordAssessments());
  expect(item.feedback).toEqual({});
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

describe('ABClassController.readClass corruption isolation', () => {
  it('isolates one corrupt item and still serves healthy siblings and both projections', () => {
    const source = canonicalClassDocument();
    const embedded = embeddedAssignmentOf(source);
    const document = corruptFirstSubmissionItem(source, embedded);
    const healthyBefore = clone(embedded.submissions[HEALTHY_SUBMISSION_INDEX]);
    const siblingBefore = clone(embedded.submissions[0].items[SIBLING_TASK_ID]);
    const storedBefore = clone(document);
    classCollection.findOne.mockReturnValue(document);

    const view = new ABClassController().readClass(CLASS_ID);
    const assignment = assignmentOf(view);

    // The corrupt item is materialised as the exact catalogue placeholder.
    const corruptSubmission = submissionOf(assignment, embedded.submissions[0].studentId);
    expectCorruptPlaceholder(corruptSubmission.items[CORRUPT_TASK_ID]);
    // Its healthy sibling survives the class-partial projection unchanged.
    expect(corruptSubmission.items[SIBLING_TASK_ID].assessments).toEqual(siblingBefore.assessments);
    expect(Object.keys(corruptSubmission.items).sort()).toEqual(
      [CORRUPT_TASK_ID, SIBLING_TASK_ID].sort()
    );
    // Every other submission in the class is served untouched.
    expect(assignment.submissions).toHaveLength(embedded.submissions.length);
    const healthyAfter = submissionOf(assignment, healthyBefore.studentId);
    expect(healthyAfter.items[SIBLING_TASK_ID].assessments).toEqual(
      healthyBefore.items[SIBLING_TASK_ID].assessments
    );
    expect(healthyAfter.items[CORRUPT_TASK_ID].assessments).toEqual(
      healthyBefore.items[CORRUPT_TASK_ID].assessments
    );
    // The read is a projection: the stored document is not mutated.
    expect(document).toEqual(storedBefore);
  });

  it('serves the corrupt placeholder through the real getABClass transport wrapper', () => {
    const source = canonicalClassDocument();
    const embedded = embeddedAssignmentOf(source);
    const document = corruptFirstSubmissionItem(source, embedded);
    classCollection.findOne.mockReturnValue(document);

    const response = getABClass_({ classId: CLASS_ID });
    const assignment = assignmentOf(response);
    const corruptSubmission = submissionOf(assignment, embedded.submissions[0].studentId);

    expectCorruptPlaceholder(corruptSubmission.items[CORRUPT_TASK_ID]);
    expect(assignment.submissions).toHaveLength(embedded.submissions.length);
    expect(response).not.toHaveProperty('progressTracker');
  });

  it('returns the same view and performs no store mutation on a repeat read', () => {
    const source = canonicalClassDocument();
    const document = corruptFirstSubmissionItem(source, embeddedAssignmentOf(source));
    const storedBefore = clone(document);
    classCollection.findOne.mockReturnValue(document);
    const controller = new ABClassController();

    const first = controller.readClass(CLASS_ID);
    const second = controller.readClass(CLASS_ID);

    expect(second).toEqual(first);
    expect(document).toEqual(storedBefore);
    for (const operation of ['insertOne', 'replaceOne', 'updateOne', 'deleteOne', 'save']) {
      expect(classCollection[operation]).not.toHaveBeenCalled();
    }
    expect(fullCollection.findOne).not.toHaveBeenCalled();
  });
});

describe('full-read path corruption isolation for the same document', () => {
  it('isolates the same corrupt item through readRehydrateAssignment and toReadJSON', () => {
    const document = corruptFirstSubmissionItem(canonicalFullRecord());
    const siblingBefore = clone(document.submissions[0].items[SIBLING_TASK_ID]);
    const healthyBefore = clone(document.submissions[HEALTHY_SUBMISSION_INDEX]);
    const storedBefore = clone(document);
    fullCollection.findOne.mockReturnValue(document);
    const ops = new ABClassAssignmentOps({ dbManager, validation: {}, persistence: {} });

    const read = ops.readRehydrateAssignment(CLASS_ID, ASSIGNMENT_ID).toReadJSON();

    // Full projection keeps the complete cause and reasoning, unlike the partial one.
    const corruptSubmission = submissionOf(read, document.submissions[0].studentId);
    expectCorruptPlaceholder(corruptSubmission.items[CORRUPT_TASK_ID]);
    expect(corruptSubmission.items[CORRUPT_TASK_ID].assessments.completeness.reasoning).toBe(
      corruptRecordEntry().reasoning
    );
    // Healthy sibling and healthy submission survive the full read unchanged.
    expect(corruptSubmission.items[SIBLING_TASK_ID].assessments).toEqual(siblingBefore.assessments);
    expect(corruptSubmission.items[SIBLING_TASK_ID].artifact).toEqual(siblingBefore.artifact);
    const healthyAfter = submissionOf(read, healthyBefore.studentId);
    expect(healthyAfter.items[CORRUPT_TASK_ID].assessments).toEqual(
      healthyBefore.items[CORRUPT_TASK_ID].assessments
    );
    expect(healthyAfter.items[CORRUPT_TASK_ID].artifact).toEqual(
      healthyBefore.items[CORRUPT_TASK_ID].artifact
    );
    expect(read.submissions).toHaveLength(document.submissions.length);
    expect(read.assessmentContractVersion).toBe(1);
    expect(document).toEqual(storedBefore);
    // Neither projection is a write input: neither store is written.
    for (const operation of ['insertOne', 'replaceOne', 'updateOne', 'deleteOne', 'save']) {
      expect(fullCollection[operation]).not.toHaveBeenCalled();
      expect(classCollection[operation]).not.toHaveBeenCalled();
    }
    expect(classCollection.findOne).not.toHaveBeenCalled();
  });

  it('returns the same full read and performs no store mutation on a repeat read', () => {
    const document = corruptFirstSubmissionItem(canonicalFullRecord());
    const storedBefore = clone(document);
    fullCollection.findOne.mockReturnValue(document);
    const ops = new ABClassAssignmentOps({ dbManager, validation: {}, persistence: {} });

    const first = ops.readRehydrateAssignment(CLASS_ID, ASSIGNMENT_ID).toReadJSON();
    const second = ops.readRehydrateAssignment(CLASS_ID, ASSIGNMENT_ID).toReadJSON();

    expect(second).toEqual(first);
    expect(document).toEqual(storedBefore);
    for (const operation of ['insertOne', 'replaceOne', 'updateOne', 'deleteOne', 'save']) {
      expect(fullCollection[operation]).not.toHaveBeenCalled();
      expect(classCollection[operation]).not.toHaveBeenCalled();
    }
    expect(classCollection.findOne).not.toHaveBeenCalled();
  });
});

describe('root and identity faults on the read seam fail loudly', () => {
  it('throws ClassNotFoundError when the class collection is missing', () => {
    classCollection.findOne.mockReturnValue(null);
    expect(() => new ABClassController().readClass(CLASS_ID)).toThrow(ClassNotFoundError);
  });

  it('throws AssignmentNotFoundError when the full record is missing', () => {
    fullCollection.findOne.mockReturnValue(null);
    const ops = new ABClassAssignmentOps({ dbManager, validation: {}, persistence: {} });
    expect(() => ops.readRehydrateAssignment(CLASS_ID, ASSIGNMENT_ID)).toThrow(
      AssignmentNotFoundError
    );
  });

  it('throws instead of materialising a placeholder for an item outside the task list', () => {
    const document = canonicalClassDocument();
    const submission = embeddedAssignmentOf(document).submissions[0];
    submission.items['task-unknown'] = {
      ...clone(submission.items[CORRUPT_TASK_ID]),
      taskId: 'task-unknown',
    };
    classCollection.findOne.mockReturnValue(document);

    expect(() => new ABClassController().readClass(CLASS_ID)).toThrow(/task-unknown/);
  });
});
