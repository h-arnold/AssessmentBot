import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  DummyBaseRequestManager,
  createSlidesAssignment,
} = require('../helpers/modelFactories.js');

// Real generic cache collaborator: the same owner class the runtime
// instantiates. The suite installs it as the global CacheManager for every
// freshly constructed LLM manager, so the planned sole-caller cut-over to
// generic get/put cannot meet a wrapper-only double lacking get/put here.
const RealCacheManager = require('#backend/RequestHandlers/CacheManager.js').CacheManager;

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
// Suite cache collaborator: the real generic CacheManager owner, not a
// wrapper-only double. Its constructor needs the faithful native script-cache
// Map installed per test in the describe block below (newly scoped cache
// globals, restored in afterEach).
globalThis.CacheManager = RealCacheManager;

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
  let savedCacheGlobals, nativeCache, nativeCacheStorage;

  beforeEach(() => {
    // Faithful scoped native script cache for the suite collaborator: get
    // returns the LAST string written for a key or null on a miss; put stores
    // the actual serialised argument it receives. Newly scoped globals;
    // restored in afterEach.
    nativeCacheStorage = new Map();
    nativeCache = {
      get: vi.fn((key) => (nativeCacheStorage.has(key) ? nativeCacheStorage.get(key) : null)),
      put: vi.fn((key, value) => nativeCacheStorage.set(key, value)),
    };
    savedCacheGlobals = saveGlobals(['CacheService', 'CacheManager']);
    globalThis.CacheService = { getScriptCache: () => nativeCache };
    globalThis.CacheManager = RealCacheManager;

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

  afterEach(() => {
    restoreGlobals(savedCacheGlobals);
    savedCacheGlobals = null;
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

  it('serves a real cold cache write to a warm generation without re-dispatching', () => {
    // Generic cache surface only: the real suite collaborator mutates a
    // faithful native script-cache Map. This test never names or computes a
    // key, never calls an assessment wrapper, and never inspects its own key
    // format.
    const cacheStorage = new Map();
    const scriptCache = {
      get: vi.fn((key) => (cacheStorage.has(key) ? cacheStorage.get(key) : null)),
      put: vi.fn((key, value, ttlSeconds) => cacheStorage.set(key, value)),
    };
    const saved = saveGlobals(['CacheService', 'CacheManager']);
    try {
      globalThis.CacheService = { getScriptCache: () => scriptCache };
      globalThis.CacheManager = RealCacheManager;
      const coldManager = new LLMRequestManagerFresh();
      coldManager.configManager = createDummyConfigurationManager();
      const expectedBody = {
        completeness: { score: 5, reasoning: 'ok' },
        accuracy: { score: 4, reasoning: 'fine' },
        spag: { score: 3, reasoning: 'avg' },
      };
      // COLD: two real eligible items mark and write through generic cache paths.
      const requests = coldManager.generateRequestObjects(assignment);
      expect(requests).toHaveLength(2);
      expect(cacheStorage.size).toBe(0);
      coldManager.processStudentResponses(requests, assignment);
      expect(cacheStorage.size).toBe(2);
      expect(scriptCache.put).toHaveBeenCalledTimes(2);
      expect(new Set(scriptCache.put.mock.calls.map(([key]) => key)).size).toBe(2);
      scriptCache.put.mock.calls.forEach(([key, value, ttl]) => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
        expect(JSON.parse(value)).toEqual(expectedBody);
        expect(ttl).toBe(RealCacheManager.CACHE_EXPIRY_SECONDS);
      });
      Object.values(assignment.submissions[0].items)
        .filter((item) => item.getType() !== 'SPREADSHEET')
        .forEach((item) => expect(item.getAssessment()).toEqual(expectedBody));
      // WARM: fresh real manager and identical fingerprints reuse the entries.
      scriptCache.get.mockClear();
      scriptCache.put.mockClear();
      const warmManager = new LLMRequestManagerFresh();
      warmManager.configManager = createDummyConfigurationManager();
      const warmRequests = warmManager.generateRequestObjects(assignment);
      expect(warmRequests).toEqual([]);
      expect(scriptCache.get).toHaveBeenCalledTimes(2);
      scriptCache.get.mock.results
        .slice(-2)
        .forEach((result) => expect(result.value).not.toBeNull());
      expect(scriptCache.put).not.toHaveBeenCalled();
      Object.values(assignment.submissions[0].items)
        .filter((item) => item.getType() !== 'SPREADSHEET')
        .forEach((item) => expect(item.getAssessment()).toEqual(expectedBody));
    } finally {
      restoreGlobals(saved);
    }
  });

  it('proves the suite cache collaborator serves generic get/put with the shared CacheManager TTL', () => {
    // Collaborator capability/continuity reached before any business outcome:
    // every retained generation/N/assignment/native-response control receives
    // the real generic CacheManager owner, so this exercises — not merely
    // presence-checks — the generic surface a sole-caller get/put cut-over
    // needs, plus the actual shared TTL constant.
    const collaborator = manager.cacheManager;
    expect(collaborator).toBeInstanceOf(RealCacheManager);
    expect(typeof collaborator.get).toBe('function');
    expect(typeof collaborator.put).toBe('function');
    const sharedTtl = RealCacheManager.CACHE_EXPIRY_SECONDS;
    expect(Number.isFinite(sharedTtl) && sharedTtl > 0).toBe(true);
    // Reached string-JSON roundtrip through the faithful native store: generic
    // put serialises with the explicit shared TTL and generic get parses that
    // exact native string back; an absent key stays a no-write native miss.
    const continuityValue = { completeness: { score: 1, reasoning: 'suite continuity' } };
    const continuityKey = 'suite-cache-collaborator-roundtrip';
    expect(nativeCacheStorage.size).toBe(0);
    collaborator.put(continuityKey, continuityValue, sharedTtl);
    const [putKey, putValue, putTtl] = nativeCache.put.mock.calls[0];
    expect(putKey).toBe(continuityKey);
    expect(typeof putValue).toBe('string');
    expect(JSON.parse(putValue)).toEqual(continuityValue);
    expect(putTtl).toBe(sharedTtl);
    expect(nativeCacheStorage.get(continuityKey)).toBe(putValue);
    expect(collaborator.get(continuityKey)).toEqual(continuityValue);
    expect(collaborator.get('suite-cache-collaborator-absent')).toBe(null);
    expect(nativeCache.put).toHaveBeenCalledTimes(1);
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

  it('terminalises an invalid successful response without a semantic retry dispatch', () => {
    const targetItem = assignment.submissions[0].getItem(Object.keys(assignment.getTasks())[0]);
    const request = { uid: 'invalid-outcome', url: 'https://service.test/assess', method: 'post' };
    manager.uidIndex = { 'invalid-outcome': { item: targetItem } };
    const sendRequestWithRetries = vi.spyOn(manager, 'sendRequestWithRetries');
    manager.sendRequestsInBatches = vi.fn((_requests, options) => {
      options.onBatchComplete([
        {
          uid: 'invalid-outcome',
          response: { getResponseCode: () => 200, getContentText: () => '{}' },
          error: null,
          attempts: 1,
        },
      ]);
    });
    const expectedCause = { stage: 'assessment', code: 'LLM_INVALID_RESPONSE' };
    const expectedErrorMap = Object.fromEntries(
      ['completeness', 'accuracy', 'spag'].map((criterion) => [
        criterion,
        {
          score: 'E',
          reasoning: 'The assessment service returned an invalid result.',
          error: expectedCause,
        },
      ])
    );
    let caught = null;
    try {
      manager.processStudentResponses([request], assignment);
    } catch (error) {
      caught = error;
    }
    // One consumed batch: no semantic retry dispatch and no later dispatch.
    expect(sendRequestWithRetries).not.toHaveBeenCalled();
    expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
    // No run abort: processing completes with an explicit terminal outcome.
    expect(caught).toBe(null);
    // The invalid unit terminalises atomically instead of retrying optimistically.
    expect(targetItem.getAssessment()).toEqual(expectedErrorMap);
    // No cache entry is produced for a semantic-invalid or retrying outcome,
    // asserted with the generic no-write oracle on the suite's faithful native
    // store (the wrapper-only collaborator `.store` double no longer exists).
    expect(nativeCache.put).not.toHaveBeenCalled();
    expect(nativeCacheStorage.size).toBe(0);
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

  it('fails the stop sweep loudly when the generated route map is missing entirely', () => {
    const requests = manager.generateRequestObjects(assignment);
    expect(requests).toHaveLength(2);
    expect(Object.keys(manager.uidIndex)).toHaveLength(2);
    delete manager.uidIndex;
    // Direct owned-boundary call with explicit map corruption: the missing
    // generated route map is a wiring fault and must fail loudly, never fall
    // back to an empty object that silently reports no unfinished work.
    let caught = null;
    try {
      manager._terminaliseUnprocessedItems(new Set());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
  });

  it('fails the stop sweep loudly when a generated route entry is missing', () => {
    const requests = manager.generateRequestObjects(assignment);
    expect(requests).toHaveLength(2);
    manager.uidIndex[requests[0].uid] = null;
    // Direct owned-boundary call with explicit route-entry corruption: the
    // `entry &&` guard must not silently skip a known route entry.
    let caught = null;
    try {
      manager._terminaliseUnprocessedItems(new Set());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
  });
});
