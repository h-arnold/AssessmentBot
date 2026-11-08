/**
 * Non-array legacy submissions root: read transports fail contextually.
 *
 * A present non-array `submissions` value (an object or `null`) cannot be
 * prepared: `prepareLegacyReadSubmissions` reports the bypass as `null` and both
 * read transports — the model read emit and the class read through
 * `ABClassResponseMapper._toReadView()` — convert that signal into a contextual
 * `Error` naming the assignment instead of serving a preserved body. Persistence
 * keeps preserving the stored value unchanged (date-normalised), so the record
 * still round-trips through `toJSON()`/`toPartialJSON()`. This is the read-side
 * twin of the persistence preservation rule.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { restoreGlobals, saveGlobals } from '#test-helpers/globalMockManager.js';
import {
  classRead,
  healthyFullRecord,
  prepare,
  restoreLegacy,
} from './assignmentLegacyReadPreparationSupport.js';
import {
  createMockCollection,
  setupControllerTestMocks,
  cleanupControllerTestMocks,
} from '../helpers/mockFactories.js';

const ABClass = require('#backend/Models/ABClass.js').ABClass;
const Teacher = require('#backend/Models/Teacher.js').Teacher;
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');

const CLASS_ID = 'class-0';
const ASSIGNMENT_ID = 'assignment-0-1';

/** Canonical class document with the selected assignment marked as stored legacy. */
function storedLegacyClassDocument() {
  const document = structuredClone(loadBackendModelInputs('small').classesById[CLASS_ID]);
  const embedded = document.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
  Reflect.deleteProperty(embedded, 'assessmentContractVersion');
  return document;
}

let savedGlobals;
let classCollection;
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
  dbManager = {
    getCollection: vi.fn((name) =>
      name.startsWith('assign_full_') ? createMockCollection(vi) : classCollection
    ),
  };
  globalThis.DbManager = { getInstance: () => dbManager };
  globalThis.ABClass = ABClass;
  globalThis.Teacher = Teacher;
  globalThis.Assignment = Assignment;
  globalThis.ABClassController = ABClassController;
});

afterEach(() => {
  cleanupControllerTestMocks();
  restoreGlobals(savedGlobals);
  vi.restoreAllMocks();
});

describe('legacy non-array submissions root read transports', () => {
  it('fails the full read contextually when preparation reports a non-array root', () => {
    const record = healthyFullRecord();
    record.submissions = { preserved: { marks: [null, { score: 3 }] } };
    Reflect.deleteProperty(record, 'assessmentContractVersion');
    const restored = restoreLegacy(record);

    // The preparation facade reports the bypass as null; the read transport
    // converts that signal into a contextual error naming the assignment.
    expect(prepare(restored, 'full')).toBeNull();
    expect(() => restored.toReadJSON()).toThrow(/assignment-0-1.*non-array submissions root/);
  });

  it('fails the controller class read contextually for a preserved non-array submissions root', () => {
    const document = storedLegacyClassDocument();
    const embedded = document.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID);
    embedded.submissions = { preserved: { opaque: [null, { body: 'unchanged' }] } };
    classCollection.findOne.mockReturnValue(document);

    expect(() => new ABClassController().readClass(CLASS_ID)).toThrow(
      /assignment-0-1.*non-array submissions root/
    );
  });

  it('fails the full-definition class read contextually for a preserved non-array root', () => {
    const record = healthyFullRecord();
    const storedBody = { preserved: { opaque: [null, { body: 'unchanged' }] } };
    record.submissions = storedBody;

    expect(() =>
      classRead(record, {
        students: [{ studentId: 'roster-only', studentName: 'Roster learner' }],
      })
    ).toThrow(/assignment-0-1.*non-array submissions root/);
  });

  it('still preserves the non-array root unchanged on the persistence emits', () => {
    const record = healthyFullRecord();
    Reflect.deleteProperty(record, 'assessmentContractVersion');
    record.submissions = {
      preserved: { marks: [null, { score: 3 }] },
      stampedAt: new Date('2021-02-03T04:05:06.000Z'),
    };
    const restored = restoreLegacy(record);

    const preservedBody = {
      preserved: { marks: [null, { score: 3 }] },
      stampedAt: '2021-02-03T04:05:06.000Z',
    };
    expect(restored.toJSON().submissions).toEqual(preservedBody);
    expect(restored.toPartialJSON().submissions).toEqual(preservedBody);
  });
});
