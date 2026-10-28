import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { createMockUtils } from '../helpers/mockFactories.js';

const AssignmentController = require('#backend/y_controllers/AssignmentController.js');
const { ABClass } = require('#backend/Models/ABClass.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const SlidesAssignment = require('#backend/AssignmentProcessor/SlidesAssignment.js');
const AssignmentDefinitionController = require('#backend/y_controllers/AssignmentDefinition/index.js');

const inputs = loadBackendModelInputs('small');
const classId = 'class-0';
const assignmentId = 'assignment-0-2';
const fullName = `assign_full_${classId}_${assignmentId}`;
const sourceClass = inputs.classesById[classId];
const previousFull = structuredClone(
  Object.values(inputs.assignmentsByKey).find(
    (row) => row.courseId === classId && row.assignmentId === assignmentId
  )
);
const definition = previousFull.assignmentDefinition;
if (Array.isArray(definition.tasks)) throw new Error('Expected full definition tasks');
const definitionKey = definition.definitionKey;
previousFull.updatedAt = '2024-01-01T00:00:00.000Z';
previousFull.assignmentName = 'Prior run snapshot';

function equalFilter(row, filter) {
  return row && Object.entries(filter).every(([key, value]) => row[key] === value);
}

function memoryCollection(name, log) {
  const docs = [];
  return {
    docs,
    findOne: vi.fn((filter) => docs.find((row) => equalFilter(row, filter)) || null),
    insertOne: vi.fn((row) => {
      docs.push(structuredClone(row));
    }),
    replaceOne: vi.fn((filter, row) => {
      const index = docs.findIndex((item) => equalFilter(item, filter));
      if (index >= 0) docs[index] = structuredClone(row);
    }),
    updateOne: vi.fn((filter, update) => {
      const row = docs.find((item) => equalFilter(item, filter));
      if (row) Object.assign(row, structuredClone(update.$set));
      return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
    }),
    save: vi.fn(() => log.push(`${name}.save`)),
    getMetadata: vi.fn(() => ({})),
  };
}

describe('acquisition failure and assignment persistence', () => {
  let restore;
  afterEach(() => {
    restore?.();
    restore = undefined;
    vi.restoreAllMocks();
  });

  function setup(list, driveFile) {
    const writes = [];
    const collections = new Map();
    for (const [name, rows] of [
      [classId, [structuredClone(sourceClass)]],
      ['abclass_partials', []],
      [fullName, [structuredClone(previousFull)]],
    ]) {
      const collection = memoryCollection(name, writes);
      collection.docs.push(...rows);
      collections.set(name, collection);
    }
    const progress = {
      startTracking: vi.fn(),
      updateProgress: vi.fn(),
      complete: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
    const mockUtils = createMockUtils(vi);
    const context = withGlobalMocks({
      Utils: () => mockUtils,
      ProgressTracker: () => ({ getInstance: () => progress }),
      ABLogger: () => ({ getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }),
      DbManager: () => ({
        getInstance: () => ({
          getCollection: (name) => {
            if (!collections.has(name)) collections.set(name, memoryCollection(name, writes));
            return collections.get(name);
          },
        }),
      }),
      ClassroomApiClient: () => ({
        fetchCourse: () => ({ name: 'Classroom course', ownerId: null }),
        fetchTeachers: () => [],
        fetchAllStudents: () => structuredClone(sourceClass.students),
      }),
      AssignmentDefinitionController: () =>
        class extends AssignmentDefinitionController {
          constructor() {
            super();
            const fullCollection = collections.get(`assdef_full_${definitionKey}`);
            if (fullCollection) return;
            const collection = memoryCollection(`assdef_full_${definitionKey}`, writes);
            collection.docs.push(structuredClone(definition));
            collections.set(`assdef_full_${definitionKey}`, collection);
          }
        },
      ABClass: () => ABClass,
      ABClassController: () => ABClassController,
      Assignment: () => Assignment,
      SlidesAssignment: () => SlidesAssignment,
      Classroom: () => ({
        Courses: {
          CourseWork: {
            get: () => ({ title: 'Coursework', creationTime: '2024-01-02T09:00:00.000Z' }),
            StudentSubmissions: { list },
          },
        },
      }),
      DriveApp: () => ({
        getFileById:
          driveFile || (() => ({ getMimeType: () => 'application/vnd.google-apps.presentation' })),
      }),
      DriveManager: () => ({
        getFileModifiedTime: (id) =>
          id === definition.referenceDocumentId
            ? definition.referenceLastModified
            : definition.templateLastModified,
      }),
    });
    restore = context.restore;
    vi.spyOn(SlidesAssignment.prototype, 'processAllSubmissions').mockImplementation(() => {});
    vi.spyOn(SlidesAssignment.prototype, 'processImages').mockImplementation(() => {});
    vi.spyOn(SlidesAssignment.prototype, 'assessResponses').mockImplementation(() => {});
    const controller = new AssignmentController();
    const full = collections.get(fullName);
    const classCollection = collections.get(classId);
    const partials = collections.get('abclass_partials');
    return { controller, progress, collections, full, classCollection, partials, writes };
  }

  it('runs the real caller and persists acquired assignment result and class projections', () => {
    const student = sourceClass.students[0];
    const list = vi.fn(() => ({
      studentSubmissions: [
        {
          userId: student.id,
          assignmentSubmission: { attachments: [{ driveFile: { id: 'new-document' } }] },
        },
      ],
    }));
    const state = setup(list);
    state.controller.processSelectedAssignment({
      assignmentId,
      definitionKey,
      courseId: classId,
    });
    const saved = state.full.docs[0];
    expect(saved.submissions.find((row) => row.studentId === student.id).documentId).toBe(
      'new-document'
    );
    expect(state.full.replaceOne).toHaveBeenCalledTimes(1);
    expect(state.classCollection.replaceOne).toHaveBeenCalledTimes(1);
    expect(state.partials.replaceOne).toHaveBeenCalledTimes(1);
    expect(state.progress.complete).toHaveBeenCalledOnce();
  });

  it('does not persist or report success when a later acquisition page fails', () => {
    const failure = new Error('later page failed');
    const list = vi
      .fn()
      .mockReturnValueOnce({ studentSubmissions: [], nextPageToken: 'page-two' })
      .mockImplementationOnce(() => {
        throw failure;
      });
    const state = setup(list);
    const priorFull = structuredClone(state.full.docs[0]);
    const priorClassAssignment = structuredClone(
      state.classCollection.docs[0].assignments.find((row) => row.assignmentId === assignmentId)
    );
    let thrown;
    try {
      state.controller.processSelectedAssignment({
        assignmentId,
        definitionKey,
        courseId: classId,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(failure);
    expect(list).toHaveBeenCalledTimes(2);
    expect(state.full.docs[0]).toEqual(priorFull);
    expect(
      state.classCollection.docs[0].assignments.find((row) => row.assignmentId === assignmentId)
    ).toEqual(priorClassAssignment);
    expect(state.full.replaceOne).not.toHaveBeenCalled();
    expect(state.full.insertOne).not.toHaveBeenCalled();
    expect(state.full.save).not.toHaveBeenCalled();
    expect(state.classCollection.replaceOne).not.toHaveBeenCalled();
    expect(state.partials.replaceOne).not.toHaveBeenCalled();
    expect(state.progress.complete).not.toHaveBeenCalled();
  });

  it.each([
    {
      cause: 'UNSUPPORTED_DOCUMENT',
      driveFile: () => ({ getMimeType: () => 'application/pdf' }),
      expectedError: 'UNSUPPORTED_DOCUMENT',
      mode: 'full',
    },
    {
      cause: 'SOURCE_UNREADABLE',
      driveFile: () => {
        throw new Error('Drive file unavailable');
      },
      expectedError: 'SOURCE_UNREADABLE',
      mode: 'full',
    },
    {
      cause: 'UNSUPPORTED_DOCUMENT',
      driveFile: () => ({ getMimeType: () => 'application/pdf' }),
      expectedError: 'UNSUPPORTED_DOCUMENT',
      mode: 'partial',
    },
    {
      cause: 'SOURCE_UNREADABLE',
      driveFile: () => {
        throw new Error('Drive file unavailable');
      },
      expectedError: 'SOURCE_UNREADABLE',
      mode: 'partial',
    },
  ])(
    'preserves persisted $cause results on the $mode read',
    ({ driveFile, expectedError, mode }) => {
      const student = sourceClass.students[0];
      const list = vi.fn(() => ({
        studentSubmissions: [
          {
            userId: student.id,
            assignmentSubmission: { attachments: [{ driveFile: { id: 'unavailable-document' } }] },
          },
        ],
      }));
      const state = setup(list, driveFile);
      vi.spyOn(SlidesAssignment.prototype, 'processAllSubmissions').mockImplementation(function () {
        this.assessmentContractVersion = 1;
      });

      state.controller.processSelectedAssignment({
        assignmentId,
        definitionKey,
        courseId: classId,
      });

      const savedFull = state.full.findOne({ courseId: classId, assignmentId });
      const savedPartial = state.classCollection.docs[0].assignments.find(
        (row) => row.assignmentId === assignmentId
      );
      expect(state.full.replaceOne).toHaveBeenCalledOnce();
      expect(state.classCollection.replaceOne).toHaveBeenCalledOnce();
      expect(savedFull.assessmentContractVersion).toBe(1);
      expect(savedPartial.assessmentContractVersion).toBe(1);

      const record = mode === 'full' ? savedFull : savedPartial;
      const restored = Assignment.fromJSON(record, mode);
      const restoredStudent = restored.submissions.find(
        (submission) => submission.studentId === student.id
      );
      const task = restoredStudent.getItem(Object.keys(definition.tasks)[0]);
      for (const criterion of ['completeness', 'accuracy', 'spag']) {
        expect(task.assessments[criterion]).toEqual({
          score: 'E',
          reasoning:
            expectedError === 'UNSUPPORTED_DOCUMENT'
              ? 'The submitted attachment is not a supported document for this assignment.'
              : 'The submitted document could not be accessed.',
          error: { stage: 'acquisition', code: expectedError },
        });
      }
    }
  );
});
