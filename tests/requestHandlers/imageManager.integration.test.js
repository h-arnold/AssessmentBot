import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  withGlobalMocks,
  withTemporaryGlobals,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';
import { createMockUtils } from '../helpers/mockFactories.js';
import { createAssignment, loadManager } from '../helpers/llmRequestManagerHarness.js';

const AssignmentController = require('#backend/y_controllers/AssignmentController.js');
const { ABClass } = require('#backend/Models/ABClass.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');
const SlidesAssignment = require('#backend/AssignmentProcessor/SlidesAssignment.js');
const AssignmentDefinitionController = require('#backend/y_controllers/AssignmentDefinition/index.js');

// Connected image-pipeline coverage for ImageManager: canonical-model image
// collection through the shared transport, the real SlidesAssignment caller
// and real controller/store seam for shared blocking in both roles, and real
// LLM eligibility after a hydrated IMAGE failure. Manager rows prove in-memory
// preservation only; caller/store rows prove no replacement write reaches the
// prior saved record (hermetic spies, no durable-storage claim).
const savedBaseRequestManagerGlobals = saveGlobals(['BaseRequestManager']);
const RealBaseRequestManager = require('#backend/RequestHandlers/BaseRequestManager.js');
globalThis.BaseRequestManager = globalThis.BaseRequestManager || RealBaseRequestManager;

afterAll(() => restoreSavedGlobals(savedBaseRequestManagerGlobals));

const ImageManager = require('#backend/RequestHandlers/ImageManager.js');

function buildManager(overrides = {}) {
  const manager = new ImageManager();
  manager.configManager = { getApiKey: () => 'test-key' };
  Object.assign(manager, overrides);
  return manager;
}

function httpOutcome(uid, status, attempts, getBlob) {
  return {
    uid,
    response: { getResponseCode: () => status, getBlob },
    error: null,
    attempts,
  };
}

describe('ImageManager shared-input run blocking', () => {
  let restoreGlobals;

  beforeEach(() => {
    const mockContext = withGlobalMocks({
      ABLogger: () => ({
        getInstance: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
      }),
      ConfigurationManager: () => ({
        getInstance: () => ({ getSlidesFetchBatchSize: () => 10 }),
      }),
      ScriptApp: () => ({ getOAuthToken: () => 'token' }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it.each(['reference', 'template'])(
    'throws for a final shared %s failure and preserves the active in-memory results',
    (role) => {
      const { assignment, item, task } = createAssignment('IMAGE');
      const shared = role === 'reference' ? task.getPrimaryReference() : task.getPrimaryTemplate();
      shared.metadata = { sourceUrl: `https://images.test/${role}.png` };
      const manager = buildManager();
      manager.progressTracker = { updateProgress: vi.fn() };
      const entries = manager.collectAllImageArtifacts(assignment);
      expect(entries).toHaveLength(1);
      expect(entries[0].scope).toBe(role);
      const priorResults = structuredClone(item.getAssessment());
      manager.sendRequestsInBatches = vi.fn((requests, options) => {
        options.onBatchComplete([httpOutcome(entries[0].uid, 500, 3, vi.fn())]);
      });
      expect(() => manager.fetchImagesAsBlobs(entries)).toThrow();
      expect(item.getAssessment()).toEqual(priorResults);
      expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
    }
  );

  it('bypasses LLM request generation with the hydrated IMAGE error preserved', () => {
    const { assignment, item } = createAssignment('IMAGE');
    item.artifact.content = null;
    item.artifact.contentHash = null;
    item.artifact.metadata = { sourceUrl: 'https://images.test/pending.png' };
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    const entries = manager.collectAllImageArtifacts(assignment);
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete([httpOutcome(entries[0].uid, 500, 3, vi.fn())]);
    });
    expect(manager.fetchImagesAsBlobs(entries)).toEqual([]);
    for (const criterion of ['completeness', 'accuracy', 'spag']) {
      expect(item.getAssessment(criterion)).toMatchObject({
        score: 'E',
        reasoning: 'The submitted slide image could not be loaded.',
        error: { stage: 'extraction', code: 'IMAGE_HYDRATION_FAILED' },
      });
    }
    const context = loadManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const llm = new (require(context.llmPath))();
        expect(llm.generateRequestObjects(assignment)).toEqual([]);
        expect(context.scriptCache.get).not.toHaveBeenCalled();
      });
    } finally {
      vi.restoreAllMocks();
      context.restore();
    }
  });
});

describe('ImageManager shared-image blocking through the caller and store seam', () => {
  const classId = 'class-0';
  const assignmentId = 'assignment-0-2';
  const fullName = `assign_full_${classId}_${assignmentId}`;

  const equalFilter = (row, filter) =>
    row && Object.entries(filter).every(([key, value]) => row[key] === value);

  function memoryCollection(name) {
    const docs = [];
    return {
      docs,
      findOne: vi.fn((filter) => docs.find((row) => equalFilter(row, filter)) || null),
      insertOne: vi.fn((row) => docs.push(structuredClone(row))),
      replaceOne: vi.fn((filter, row) => {
        const index = docs.findIndex((item) => equalFilter(item, filter));
        if (index >= 0) docs[index] = structuredClone(row);
      }),
      updateOne: vi.fn((filter, update) => {
        const row = docs.find((item) => equalFilter(item, filter));
        if (row) Object.assign(row, structuredClone(update.$set));
        return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
      }),
      save: vi.fn(),
      getMetadata: vi.fn(() => ({})),
    };
  }

  /** Canonical small class/assignment with a local pending shared IMAGE artefact mutation. */
  function setupStoreSeam(role) {
    const inputs = loadBackendModelInputs('small');
    const previousFull = structuredClone(
      Object.values(inputs.assignmentsByKey).find(
        (row) => row.courseId === classId && row.assignmentId === assignmentId
      )
    );
    previousFull.updatedAt = '2024-01-01T00:00:00.000Z';
    previousFull.assignmentName = 'Prior run snapshot';
    const definition = previousFull.assignmentDefinition;
    const sharedTask = definition.tasks['task-2-1'];
    sharedTask.artifacts[role] = [
      {
        taskId: sharedTask.id,
        role,
        pageId: sharedTask.pageId,
        documentId:
          role === 'reference' ? definition.referenceDocumentId : definition.templateDocumentId,
        content: null,
        contentHash: null,
        metadata: { sourceUrl: 'https://images.test/shared.png' },
        uid: `uid-${role}-shared-image`,
        type: 'IMAGE',
      },
    ];
    const sourceClass = structuredClone(inputs.classesById[classId]);
    const submissionRow = {
      userId: sourceClass.students[0].id,
      assignmentSubmission: { attachments: [{ driveFile: { id: 'new-document' } }] },
    };
    const collections = new Map();
    for (const [name, rows] of [
      [classId, [structuredClone(sourceClass)]],
      ['abclass_partials', []],
      [fullName, [structuredClone(previousFull)]],
      [`assdef_full_${definition.definitionKey}`, [structuredClone(definition)]],
    ]) {
      const collection = memoryCollection(name);
      collection.docs.push(...rows);
      collections.set(name, collection);
    }
    const progress = {
      startTracking: vi.fn(),
      updateProgress: vi.fn(),
      complete: vi.fn(),
      logError: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
      getCurrentProgress: () => ({ message: 'Fetching images' }),
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const fetchAll = vi.fn((requests) =>
      requests.map(() => ({ getResponseCode: () => 403, getBlob: vi.fn() }))
    );
    const getCollection = (name) => {
      if (!collections.has(name)) collections.set(name, memoryCollection(name));
      return collections.get(name);
    };
    const context = withGlobalMocks({
      Utils: () => createMockUtils(vi),
      ProgressTracker: () => ({ getInstance: () => progress }),
      ABLogger: () => ({ getInstance: () => logger }),
      DbManager: () => ({ getInstance: () => ({ getCollection }) }),
      ClassroomApiClient: () => ({
        fetchCourse: () => ({ name: 'Classroom course', ownerId: null }),
        fetchTeachers: () => [],
        fetchAllStudents: () => structuredClone(sourceClass.students),
      }),
      AssignmentDefinitionController: () => AssignmentDefinitionController,
      ABClass: () => ABClass,
      ABClassController: () => ABClassController,
      ImageManager: () => ImageManager,
      Classroom: () => ({
        Courses: {
          CourseWork: {
            get: () => ({ title: 'Coursework', creationTime: '2024-01-02T09:00:00.000Z' }),
            StudentSubmissions: { list: () => ({ studentSubmissions: [submissionRow] }) },
          },
        },
      }),
      DriveApp: () => ({
        getFileById: () => ({ getMimeType: () => 'application/vnd.google-apps.presentation' }),
      }),
      DriveManager: () => ({
        getFileModifiedTime: (id) =>
          id === definition.referenceDocumentId
            ? definition.referenceLastModified
            : definition.templateLastModified,
      }),
      ConfigurationManager: () => ({
        getInstance: () => ({ getApiKey: () => 'key', getSlidesFetchBatchSize: () => 5 }),
      }),
      ScriptApp: () => ({ getOAuthToken: () => 'token' }),
      UrlFetchApp: () => ({ fetchAll, fetch: vi.fn() }),
      Utilities: () => ({ ...globalThis.Utilities, sleep: vi.fn() }),
    });
    vi.spyOn(SlidesAssignment.prototype, 'processAllSubmissions').mockImplementation(() => {});
    vi.spyOn(SlidesAssignment.prototype, 'assessResponses').mockImplementation(() => {});
    return { context, collections, progress, logger };
  }

  it.each(['reference', 'template'])(
    'does not replace the saved assignment when the shared %s image fetch fails',
    (role) => {
      const seam = setupStoreSeam(role);
      try {
        const full = seam.collections.get(fullName);
        const classCollection = seam.collections.get(classId);
        const priorFull = structuredClone(full.docs[0]);
        const classAssignmentRow = () =>
          classCollection.docs[0].assignments.find((row) => row.assignmentId === assignmentId);
        const priorClassAssignment = structuredClone(classAssignmentRow());
        let thrown;
        try {
          new AssignmentController().processSelectedAssignment({
            assignmentId,
            definitionKey: 'definition-2-slides',
            courseId: classId,
          });
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeDefined();
        // loadClass's roster patch is the expected write; the saved assignment
        // records must not be touched.
        expect(full.replaceOne).not.toHaveBeenCalled();
        expect(full.insertOne).not.toHaveBeenCalled();
        expect(full.save).not.toHaveBeenCalled();
        expect(classCollection.replaceOne).not.toHaveBeenCalled();
        expect(seam.collections.get('abclass_partials').replaceOne).not.toHaveBeenCalled();
        expect(full.docs[0]).toEqual(priorFull);
        expect(classAssignmentRow()).toEqual(priorClassAssignment);
        expect(seam.progress.complete).not.toHaveBeenCalled();
        expect(seam.logger.error).toHaveBeenCalledTimes(1);
        expect(seam.progress.logError).toHaveBeenCalledWith(
          'Image processing failed.',
          expect.objectContaining({
            devContext: expect.objectContaining({ workflow: 'SlidesAssignment.processImages' }),
          })
        );
      } finally {
        seam.context.restore();
        vi.restoreAllMocks();
      }
    }
  );
});
