import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveGlobals, restoreGlobals } from '../helpers/globalMockManager.js';

// Import model classes from source (CommonJS exports)
const { TaskDefinition } = require('#backend/Models/TaskDefinition.js');
const { StudentSubmission } = require('#backend/Models/StudentSubmission/index.js');

// Import shared test helpers
const { simpleHash } = require('../helpers/testUtils.js');
const {
  createTextTask,
  setupGlobalDummyClasses,
  createDummyConfigurationManager,
  DummyCacheManager,
  DummyBaseRequestManager,
  createSlidesAssignment,
} = require('../helpers/modelFactories.js');

class LLMConsumerBaseRequestManager extends DummyBaseRequestManager {
  sendRequestsInBatches(requests, options) {
    for (let offset = 0; offset < requests.length; offset += options.batchSize) {
      options.onBatchComplete(
        requests.slice(offset, offset + options.batchSize).map((request) => ({
          uid: request.uid,
          response: {
            getResponseCode: () => this.responseCode,
            getContentText: () =>
              JSON.stringify(
                this.responseBody || {
                  completeness: { score: 5, reasoning: 'ok' },
                  accuracy: { score: 4, reasoning: 'fine' },
                  spag: { score: 3, reasoning: 'avg' },
                }
              ),
          },
          error: null,
          attempts: 1,
        }))
      );
    }
  }
}

// Minimal global Utils & dependencies stubs required by artifacts & manager (non-GAS)
globalThis.Utils = {
  generateHash: simpleHash,
  normaliseKeysToLowerCase: (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    Object.keys(obj).forEach((k) => {
      out[k.toLowerCase()] = obj[k];
    });
    return out;
  },
  toastMessage: () => {},
};

// Setup global dummy classes
setupGlobalDummyClasses();

// Override specific globals for this test (use the classes directly)
globalThis.BaseRequestManager = LLMConsumerBaseRequestManager;
globalThis.CacheManager = DummyCacheManager;

// Provide globals expected by Assignment constructor
globalThis.Classroom = {
  Courses: {
    CourseWork: {
      get: () => ({ title: 'Stubbed Assignment' }),
      StudentSubmissions: { list: () => ({ studentSubmissions: [] }) },
    },
  },
};
globalThis.DriveApp = {
  getFileById: () => ({ getMimeType: () => 'application/vnd.google-apps.slides' }),
};
globalThis.MimeType = {
  GOOGLE_SLIDES: 'application/vnd.google-apps.slides',
  GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
};
globalThis.StudentSubmission = StudentSubmission;

// Now that globals exist, require runtime-dependent classes
const LLMRequestManagerFresh = require('#backend/RequestHandlers/LLMRequestManager.js');

describe('Phase 3 LLMRequestManager integration (new model)', () => {
  let assignment, manager;

  beforeEach(() => {
    assignment = createSlidesAssignment({
      courseId: 'course1',
      assignmentId: 'assign1',
      referenceDocumentId: 'ref-slides-1',
      templateDocumentId: 'tpl-slides-1',
      assignmentName: 'Test Assignment',
    });

    // Inject tasks
    const td1 = createTextTask(1, 'Reference Answer', 'Template Text');
    const td2 = createTextTask(2, 'Another Ref', 'Another Template');
    const tdSpreadsheet = new TaskDefinition({ taskTitle: 'Sheet', pageId: 's1', index: 3 });
    tdSpreadsheet.addReferenceArtifact({ type: 'SPREADSHEET', content: [['=sum(a1:a2)']] });
    tdSpreadsheet.addTemplateArtifact({ type: 'SPREADSHEET', content: [['=sum(a1:a2)']] });
    assignment.setTasks({
      [td1.getId()]: td1,
      [td2.getId()]: td2,
      [tdSpreadsheet.getId()]: tdSpreadsheet,
    });

    // Add a student & create submission entries
    const sub = assignment.addStudent({ id: 'stud1', name: 'Student One' });
    sub.documentId = 'doc1';

    // Upsert submission items for td1 & td2 with distinct content
    sub.upsertItemFromExtraction(td1, { content: 'Student response 1' });
    sub.upsertItemFromExtraction(td2, { content: 'Another student answer' });
    // For spreadsheet, upsert identical to template to verify skip (and type skip)
    sub.upsertItemFromExtraction(tdSpreadsheet, { content: [['=sum(A1:A2)']] });

    manager = new LLMRequestManagerFresh();
    manager.configManager = createDummyConfigurationManager();
  });

  it('generates requests only for non-spreadsheet items', () => {
    const reqs = manager.generateRequestObjects(assignment);
    expect(reqs.length).toBe(2); // text tasks only
    reqs.forEach((r) => {
      const payload = JSON.parse(r.payload);
      expect(['TEXT']).toContain(payload.taskType); // ensure uppercase type
    });
  });

  it('marks not-attempted when student hash equals template hash', () => {
    // Make a new task where student copies template exactly
    const tdCopy = createTextTask(4, 'Ref X', 'Template Y');
    const tasks = assignment.getTasks();
    tasks[tdCopy.getId()] = tdCopy;
    assignment.setTasks(tasks);
    const sub = assignment.submissions[0];
    sub.upsertItemFromExtraction(tdCopy, { content: 'Template Y' }); // identical to template
    const manager2 = new LLMRequestManagerFresh();
    manager2.configManager = createDummyConfigurationManager();
    const reqs = manager2.generateRequestObjects(assignment);
    // Original 2 + copied task excluded due to not-attempted -> still 2
    expect(reqs.length).toBe(2);
    // Ensure assessment data placed (N) on copied task
    const item = sub.getItem(tdCopy.getId());
    const assessments = item.getAssessment();
    // Not attempted sets score "N"
    expect(Object.values(assessments).every((a) => a.score === 'N')).toBe(true);
  });

  it('uses cache to skip generating duplicate request', () => {
    // First run generates and caches for task 1
    const reqs1 = manager.generateRequestObjects(assignment);
    expect(reqs1.length).toBe(2);
    // Simulate processing and caching result manually
    const sub = assignment.submissions[0];
    const taskKeys = Object.keys(assignment.getTasks());
    const item1 = sub.getItem(taskKeys[0]);
    const td1 = assignment.getTasks()[item1.taskId];
    const refHash = td1.getPrimaryReference().contentHash;
    const respHash = item1.artifact.contentHash;
    manager.cacheManager.setCachedAssessment(refHash, respHash, {
      completeness: { score: 5, reasoning: 'cache' },
      accuracy: { score: 5, reasoning: 'cache' },
      spag: { score: 5, reasoning: 'cache' },
    });
    // Re-run request generation; cached task removed -> still 2? we need to modify a second item to test skip.
    // Modify second item content to force new hash so only first task is cached
    const secondItem = sub.getItem(taskKeys[1]);
    secondItem.artifact.content = 'Different now';
    secondItem.artifact.ensureHash();
    const reqs2 = manager.generateRequestObjects(assignment);
    // One task cached, one new text request
    expect(reqs2.length).toBe(1);
  });

  it('processStudentResponses assigns assessments to items', () => {
    const reqs = manager.generateRequestObjects(assignment);
    manager.processStudentResponses(reqs, assignment);
    const sub = assignment.submissions[0];
    const assessedItems = Object.values(sub.items).filter((i) => i.getType() !== 'SPREADSHEET');
    assessedItems.forEach((item) => {
      const a = item.getAssessment();
      expect(a.completeness.score).toBeTypeOf('number');
      expect(a.accuracy.score).toBeTypeOf('number');
      expect(a.spag.score).toBeTypeOf('number');
    });
  });

  it('applies a valid native LLM response through real transport to the generated submission item', () => {
    const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
    const llmPath = require.resolve('#backend/RequestHandlers/LLMRequestManager.js');
    const previousLlmModule = require.cache[llmPath];
    const BaseRequestManager = require(basePath);
    const item = assignment.submissions[0].getItem(Object.keys(assignment.getTasks())[0]);
    Object.values(assignment.submissions[0].items).forEach((submissionItem) => {
      if (submissionItem !== item && submissionItem.getType() !== 'SPREADSHEET') {
        delete assignment.submissions[0].items[submissionItem.taskId];
      }
    });
    const validBody = JSON.stringify({
      completeness: { score: 3, reasoning: 'complete enough' },
      accuracy: { score: 4, reasoning: 'mostly accurate' },
      spag: { score: 2, reasoning: 'some errors' },
    });
    const nativeResponse = {
      getResponseCode: () => 200,
      getContentText: () => validBody,
    };
    const fetchAll = vi.fn(() => [nativeResponse]);
    const fetch = vi.fn();
    const sleep = vi.fn();
    const savedGlobals = saveGlobals([
      'BaseRequestManager',
      'ConfigurationManager',
      'UrlFetchApp',
      'Utilities',
    ]);
    let processSpy;
    let validationSpy;
    try {
      globalThis.BaseRequestManager = BaseRequestManager;
      globalThis.ConfigurationManager = {
        getInstance: () => ({ getBackendAssessorBatchSize: () => 1 }),
      };
      globalThis.UrlFetchApp = { fetchAll, fetch };
      globalThis.Utilities = { sleep };
      delete require.cache[llmPath];
      const RealLLMRequestManager = require(llmPath);
      const realManager = new RealLLMRequestManager();
      realManager.configManager = createDummyConfigurationManager();
      realManager.progressTracker = {
        getCurrentProgress: () => ({ message: 'Assessing' }),
        updateProgress: vi.fn(),
        logError: vi.fn(),
      };
      const requests = realManager.generateRequestObjects(assignment);
      expect(requests).toHaveLength(1);
      const uid = requests[0].uid;
      expect(realManager.uidIndex[uid].item).toBe(item);
      const originalProcess = realManager._processSingleResponse.bind(realManager);
      processSpy = vi
        .spyOn(realManager, '_processSingleResponse')
        .mockImplementation((response, request, model) => {
          expect(response).toBe(nativeResponse);
          return originalProcess(response, request, model);
        });
      validationSpy = vi.spyOn(realManager, 'validateAssessmentData');

      realManager.processStudentResponses(requests, assignment);

      expect(processSpy).toHaveBeenCalledOnce();
      expect(validationSpy).toHaveBeenCalledWith({
        completeness: { score: 3, reasoning: 'complete enough' },
        accuracy: { score: 4, reasoning: 'mostly accurate' },
        spag: { score: 2, reasoning: 'some errors' },
      });
      expect(item.assessments).toMatchObject({
        completeness: { score: 3, reasoning: 'complete enough' },
        accuracy: { score: 4, reasoning: 'mostly accurate' },
        spag: { score: 2, reasoning: 'some errors' },
      });
      expect(fetchAll).toHaveBeenCalledOnce();
      expect(fetch).not.toHaveBeenCalled();
      expect(sleep).not.toHaveBeenCalled();
    } finally {
      processSpy?.mockRestore();
      validationSpy?.mockRestore();
      delete require.cache[llmPath];
      if (previousLlmModule) require.cache[llmPath] = previousLlmModule;
      restoreGlobals(savedGlobals);
    }
  });

  it('processStudentResponses caches successful assessments', () => {
    // Ensure no cache present initially
    const sub = assignment.submissions[0];
    const itemEntries = Object.values(sub.items).filter((i) => i.getType() !== 'SPREADSHEET');
    expect(itemEntries.length).toBeGreaterThan(0);

    // Generate requests and process responses
    const reqs = manager.generateRequestObjects(assignment);
    manager.processStudentResponses(reqs, assignment);

    // After processing, each non-spreadsheet item should have a cached entry
    itemEntries.forEach((item) => {
      const td = assignment.getTasks()[item.taskId];
      const refHash = td.getPrimaryReference().contentHash;
      const respHash = item.artifact.contentHash;
      const cached = manager.cacheManager.getCachedAssessment(refHash, respHash);
      expect(cached).not.toBeNull();
      ['completeness', 'accuracy', 'spag'].forEach((criterion) => {
        expect(cached).toHaveProperty(criterion);
        const payload = cached[criterion];
        expect(typeof payload.score).toBe('number');
        expect(typeof payload.reasoning).toBe('string');
      });
    });
  });

  it('caches assessments after retry succeeds', () => {
    const reqs = manager.generateRequestObjects(assignment);
    expect(reqs.length).toBeGreaterThan(0);

    const retryRequest = reqs[0];
    const retryResponse = {
      uid: retryRequest.uid,
      response: {
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            completeness: { score: 5, reasoning: 'retry' },
            accuracy: { score: 4, reasoning: 'retry' },
            spag: { score: 3, reasoning: 'retry' },
          }),
      },
      error: null,
      attempts: 1,
    };
    manager.sendRequestWithRetries = () => retryResponse;

    manager.handleValidationFailure(retryRequest.uid, retryRequest, assignment);

    const { item, taskDef } = manager.uidIndex[retryRequest.uid];
    const refHash = taskDef.getPrimaryReference().contentHash;
    const respHash = item.artifact.contentHash;
    const cached = manager.cacheManager.getCachedAssessment(refHash, respHash);
    expect(cached).not.toBeNull();
    ['completeness', 'accuracy', 'spag'].forEach((criterion) => {
      expect(cached[criterion]).toMatchObject({
        score: expect.any(Number),
        reasoning: expect.any(String),
      });
    });
  });

  it.each([
    [
      'unknown',
      [
        { uid: 'valid', response: null, error: null, attempts: 1 },
        { uid: 'unknown', response: null, error: null, attempts: 1 },
      ],
    ],
    [
      'duplicate',
      [
        { uid: 'valid', response: null, error: null, attempts: 1 },
        { uid: 'valid', response: null, error: null, attempts: 1 },
      ],
    ],
  ])(
    'rejects %s callback outcomes before processing any assessment or dispatching again',
    (_kind, outcomes) => {
      const targetItem = assignment.submissions[0].getItem(Object.keys(assignment.getTasks())[0]);
      const request = { uid: 'valid', url: 'https://service.test/assess', method: 'post' };
      const nativeResponse = { getResponseCode: () => 200, getContentText: () => '{}' };
      outcomes[0].response = nativeResponse;
      let callbackReturned = false;
      manager.uidIndex = { valid: { item: targetItem } };
      manager.sendRequestsInBatches = vi.fn((_requests, options) => {
        options.onBatchComplete(outcomes);
        callbackReturned = true;
      });
      const processing = vi.spyOn(manager, '_processSingleResponse');

      expect(() => manager.processStudentResponses([request], assignment)).toThrow(
        /Unknown or duplicate LLM outcome UID/
      );
      expect(processing).not.toHaveBeenCalled();
      expect(outcomes[0].response).toBe(nativeResponse);
      expect(targetItem.assessments).toEqual({});
      expect(callbackReturned).toBe(false);
      expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
    }
  );

  it('rejects duplicate input UIDs before invoking the sender', () => {
    const request = { uid: 'duplicate', url: 'https://service.test/assess', method: 'post' };
    manager.sendRequestsInBatches = vi.fn();

    expect(() => manager.processStudentResponses([request, { ...request }], assignment)).toThrow(
      'Duplicate LLM request UID: duplicate'
    );
    expect(manager.sendRequestsInBatches).not.toHaveBeenCalled();
  });
});
