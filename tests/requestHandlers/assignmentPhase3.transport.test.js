import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { createMockUtils } from '../helpers/mockFactories.js';
const { createTextTask, createSlidesAssignment } = require('../helpers/modelFactories.js');
const { Validate } = require('#backend/Utils/Validate.js');

describe('LLM transport caller policy', () => {
  function createProgressTracker() {
    return {
      updateProgress: vi.fn(),
      getCurrentProgress: () => ({ message: 'Assessing' }),
      logError: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
  }

  function loadManager({ fetchAll, fetch, tracker, batchSize, sleep, utils }) {
    const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
    const llmPath = require.resolve('#backend/RequestHandlers/LLMRequestManager.js');
    const previousLlmModule = require.cache[llmPath];
    const BaseRequestManager = require(basePath);
    const scriptCache = { get: vi.fn(() => null), put: vi.fn() };
    const restore = () => {
      delete require.cache[llmPath];
      if (previousLlmModule) require.cache[llmPath] = previousLlmModule;
    };
    const globals = {
      BaseRequestManager: () => BaseRequestManager,
      ConfigurationManager: () => ({
        getInstance: () => ({
          getBackendUrl: () => 'https://llm.test',
          getApiKey: () => 'key',
          getBackendAssessorBatchSize: () => batchSize,
        }),
      }),
      CacheService: () => ({ getScriptCache: () => scriptCache }),
      ProgressTracker: () => ({ getInstance: () => tracker }),
      ABLogger: () => ({ getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }),
      UrlFetchApp: () => ({ fetchAll, fetch }),
      Utilities: () => ({ sleep }),
      Utils: () => utils,
      Validate: () => Validate,
    };
    return { BaseRequestManager, llmPath, restore, globals, scriptCache };
  }

  const validBody = JSON.stringify({
    completeness: { score: 4, reasoning: 'valid' },
    accuracy: { score: 3, reasoning: 'valid' },
    spag: { score: 2, reasoning: 'valid' },
  });

  function createModelRequests(manager) {
    const assignment = createSlidesAssignment({
      courseId: 'course-stop',
      assignmentId: 'assignment-stop',
      referenceDocumentId: 'reference-stop',
      templateDocumentId: 'template-stop',
      assignmentName: 'Stop response test',
    });
    const tasks = {};
    [1, 2, 3, 4].forEach((index) => {
      const task = createTextTask(index, `Reference ${index}`, `Template ${index}`);
      tasks[task.getId()] = task;
    });
    assignment.setTasks(tasks);
    const submission = assignment.addStudent({ id: 'student-stop', name: 'Student' });
    submission.documentId = 'document-stop';
    Object.values(tasks).forEach((task, index) => {
      submission.upsertItemFromExtraction(task, { content: `Response ${index}` });
    });
    const requests = manager.generateRequestObjects(assignment);
    return { assignment, requests };
  }

  it.each(
    ['INITIAL', 'RETRY', 'VALIDATION_ORIGIN'].flatMap((mode) =>
      [401, 403, 404].map((status) => [mode, status])
    )
  )(
    'stops subsequent dispatch in %s mode on HTTP %i after a valid sibling is applied',
    (mode, stopStatus) => {
      const events = [];
      const tracker = createProgressTracker();
      if (mode === 'VALIDATION_ORIGIN') tracker.logAndThrowError = vi.fn();
      const response = (status, body) => ({
        getResponseCode: () => status,
        getContentText: () => body,
      });
      const nativeValidResponse = response(200, validBody);
      const invalidResponse = response(200, '{}');
      const firstBatchResponse = response(
        mode === 'INITIAL' ? stopStatus : mode === 'RETRY' ? 500 : 200,
        '{}'
      );
      const batchResponses = [firstBatchResponse, invalidResponse, nativeValidResponse];
      const fetchAll = vi.fn((requests) => {
        events.push(`fetchAll:${requests.map(({ url }) => url).join(',')}`);
        if (requests.length === batchResponses.length) return batchResponses;
        return requests.map(() => response(200, validBody));
      });
      const fetch = vi.fn((url) => {
        events.push(`fetch:${url}`);
        return response(stopStatus, '{}');
      });
      const sleep = vi.fn();
      const context = loadManager({
        fetchAll,
        fetch,
        tracker,
        batchSize: 3,
        sleep,
        utils: createMockUtils(vi),
      });
      try {
        withTemporaryGlobals(context.globals, () => {
          delete require.cache[context.llmPath];
          const manager = new (require(context.llmPath))();
          manager.progressTracker = tracker;
          manager.configManager = {
            getBackendUrl: () => 'https://llm.test',
            getApiKey: () => 'key',
            getBackendAssessorBatchSize: () => 3,
          };
          const { assignment, requests } = createModelRequests(manager);
          expect(requests).toHaveLength(4);
          expect(new Set(requests.map(({ uid }) => uid)).size).toBe(4);
          expect(manager.configManager.getBackendAssessorBatchSize()).toBe(3);
          const validRequest = requests[2];
          const validation = vi.spyOn(manager, 'validateAssessmentData');
          const processResponse = manager._processSingleResponse.bind(manager);
          const validProcessing = vi
            .spyOn(manager, '_processSingleResponse')
            .mockImplementation((nativeResponse, request, model) => {
              if (request === validRequest) expect(nativeResponse).toBe(nativeValidResponse);
              return processResponse(nativeResponse, request, model);
            });
          requests.forEach((request, index) => {
            request.url = `https://llm.test/${['stop', 'invalid', 'valid', 'later'][index]}`;
          });
          if (mode !== 'VALIDATION_ORIGIN' && (stopStatus === 401 || stopStatus === 403)) {
            expect(() => manager.processStudentResponses(requests, assignment)).toThrow(
              `(${stopStatus})`
            );
          } else {
            expect(() => manager.processStudentResponses(requests, assignment)).not.toThrow();
          }
          expect(validProcessing).toHaveBeenCalledWith(
            nativeValidResponse,
            validRequest,
            assignment
          );
          expect(validation).toHaveBeenCalledWith({});
          expect(validation.mock.results[0].value).toBe(false);
          expect(context.scriptCache.get).toHaveBeenCalled();
          expect(context.scriptCache.put).toHaveBeenCalled();
          const validItem = manager.uidIndex[validRequest.uid].item;
          expect(validItem.assessments).toMatchObject({
            completeness: { score: 4, reasoning: 'valid' },
            accuracy: { score: 3, reasoning: 'valid' },
            spag: { score: 2, reasoning: 'valid' },
          });
          expect({
            fetchAllCalls: fetchAll.mock.calls.length,
            fetchCalls: fetch.mock.calls.length,
          }).toEqual({
            fetchAllCalls: 1,
            fetchCalls: mode === 'INITIAL' ? 0 : 1,
          });
          expect(sleep.mock.calls).toEqual(mode === 'RETRY' ? [[5000]] : []);
          expect(events[0]).toBe(
            'fetchAll:https://llm.test/stop,https://llm.test/invalid,https://llm.test/valid'
          );
          expect(events).not.toContain('fetchAll:https://llm.test/later');
          expect(events).not.toContain('fetch:https://llm.test/later');
          expect(batchResponses).toHaveLength(3);
        });
      } finally {
        vi.restoreAllMocks();
        context.restore();
      }
    }
  );

  it('validates missing public LLM assignment before native dispatch', () => {
    const tracker = createProgressTracker();
    const fetchAll = vi.fn((requests) =>
      requests.map(() => ({ getResponseCode: () => 200, getContentText: () => '{}' }))
    );
    const fetch = vi.fn();
    const context = loadManager({
      fetchAll,
      fetch,
      tracker,
      batchSize: 2,
      sleep: vi.fn(),
      utils: createMockUtils(vi),
    });
    const validation = vi.spyOn(Validate, 'requireParams');
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const manager = new (require(context.llmPath))();
        manager.configManager = { getBackendAssessorBatchSize: () => 2 };
        expect(() => manager.processStudentResponses([], undefined)).not.toThrow();
        expect(fetchAll).not.toHaveBeenCalled();
        let thrown;
        try {
          manager.processStudentResponses(
            [{ uid: 'missing-assignment', url: 'https://llm.test/missing-assignment' }],
            undefined
          );
        } catch (error) {
          thrown = error;
        }
        expect(
          validation.mock.calls.some(
            ([parameters, contextName]) =>
              Object.hasOwn(parameters, 'assignment') &&
              parameters.assignment === undefined &&
              contextName.includes('processStudentResponses')
          )
        ).toBe(true);
        expect(thrown).toBeInstanceOf(Error);
        expect({
          fetchAllCalls: fetchAll.mock.calls.length,
          fetchCalls: fetch.mock.calls.length,
        }).toEqual({
          fetchAllCalls: 0,
          fetchCalls: 0,
        });
        expect(() => manager.processStudentResponses([], undefined)).not.toThrow();
        expect(fetchAll).not.toHaveBeenCalled();
      });
    } finally {
      validation.mockRestore();
      context.restore();
    }
  });

  it.each([
    ['uid', undefined],
    ['request', undefined],
    ['assignment', undefined],
  ])('validates required %s input to handleValidationFailure before side effects', (missing) => {
    const tracker = createProgressTracker();
    const fetchAll = vi.fn((requests) =>
      requests.map(() => ({ getResponseCode: () => 200, getContentText: () => '{}' }))
    );
    const fetch = vi.fn();
    const context = loadManager({
      fetchAll,
      fetch,
      tracker,
      batchSize: 2,
      sleep: vi.fn(),
      utils: createMockUtils(vi),
    });
    const validation = vi.spyOn(Validate, 'requireParams');
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const manager = new (require(context.llmPath))();
        manager.configManager = {
          getBackendAssessorBatchSize: () => 2,
          getBackendUrl: () => 'https://llm.test',
          getApiKey: () => 'key',
        };
        const uid = missing === 'uid' ? undefined : 'request-id';
        const request = missing === 'request' ? undefined : { uid: 'request-id', url: '/request' };
        const assignment = missing === 'assignment' ? undefined : {};
        let thrown;
        try {
          manager.handleValidationFailure(uid, request, assignment);
        } catch (error) {
          thrown = error;
        }
        const requiredField = missing === 'uid' ? 'uid' : missing;
        expect(
          validation.mock.calls.some(
            ([parameters, contextName]) =>
              parameters[requiredField] === undefined &&
              Object.hasOwn(parameters, requiredField) &&
              contextName.includes('handleValidationFailure')
          )
        ).toBe(true);
        expect(thrown).toBeInstanceOf(Error);
        expect({
          fetchAllCalls: fetchAll.mock.calls.length,
          fetchCalls: fetch.mock.calls.length,
          retryAttempts: manager.retryAttempts,
        }).toEqual({ fetchAllCalls: 0, fetchCalls: 0, retryAttempts: {} });
      });
    } finally {
      validation.mockRestore();
      context.restore();
    }
  });
  it('delegates requests with assessor sizing, LLM statuses and per-batch routing', () => {
    const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
    const llmPath = require.resolve('#backend/RequestHandlers/LLMRequestManager.js');
    const previousLlmModule = require.cache[llmPath];
    const BaseRequestManager = require(basePath);
    try {
      withTemporaryGlobals(
        {
          BaseRequestManager: () => BaseRequestManager,
          ConfigurationManager: () => ({
            getInstance: () => ({
              getBackendAssessorBatchSize: () => 37,
              getSlidesFetchBatchSize: () => 2,
            }),
          }),
        },
        () => {
          delete require.cache[llmPath];
          const Manager = require(llmPath);
          const manager = new Manager();
          manager.progressTracker = {
            updateProgress: vi.fn(),
            getCurrentProgress: () => ({ message: 'Assessing' }),
          };
          const requests = [{ uid: 'one', url: '/one' }];
          const transport = vi
            .spyOn(BaseRequestManager.prototype, 'sendRequestsInBatches')
            .mockReturnValue([]);
          manager.processStudentResponses(requests, {});
          expect(transport).toHaveBeenCalledWith(
            requests,
            expect.objectContaining({
              batchSize: 37,
              acceptedStatuses: [200, 201],
              stopStatuses: [401, 403, 404],
              onBatchComplete: expect.any(Function),
            })
          );
        }
      );
    } finally {
      vi.restoreAllMocks();
      delete require.cache[llmPath];
      if (previousLlmModule) require.cache[llmPath] = previousLlmModule;
    }
  });

  it('consumes native responses before the next assessor batch and routes by request UID', () => {
    const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
    const llmPath = require.resolve('#backend/RequestHandlers/LLMRequestManager.js');
    const previousLlmModule = require.cache[llmPath];
    const BaseRequestManager = require(basePath);
    const events = [];
    let eventsAtSecondBatch;
    const responseByUrl = new Map();
    const fetchAll = vi.fn((nativeRequests) => {
      const urls = nativeRequests.map(({ url }) => url);
      if (urls.includes('https://llm.test/third')) eventsAtSecondBatch = [...events];
      events.push(`fetch:${urls.join(',')}`);
      return nativeRequests.map(({ url }) => {
        const response = {
          url,
          getResponseCode: () => (url.endsWith('/first') ? 201 : 200),
          getContentText: () => `response for ${url}`,
        };
        responseByUrl.set(url, response);
        return response;
      });
    });
    const tracker = {
      updateProgress: vi.fn(),
      getCurrentProgress: () => ({ message: 'Assessing' }),
      logError: vi.fn(),
    };
    try {
      withTemporaryGlobals(
        {
          BaseRequestManager: () => BaseRequestManager,
          ConfigurationManager: () => ({
            getInstance: () => ({ getBackendAssessorBatchSize: () => 2 }),
          }),
          CacheService: () => ({ getScriptCache: () => ({ get: () => null, put: vi.fn() }) }),
          ProgressTracker: () => ({ getInstance: () => tracker }),
          ABLogger: () => ({
            getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
          }),
          UrlFetchApp: () => ({ fetchAll, fetch: vi.fn() }),
          Utilities: () => ({ sleep: vi.fn() }),
        },
        () => {
          delete require.cache[llmPath];
          const Manager = require(llmPath);
          const manager = new Manager();
          expect(manager).toBeInstanceOf(BaseRequestManager);
          manager.progressTracker = tracker;
          const routed = [];
          vi.spyOn(manager, '_processSingleResponse').mockImplementation((response, request) => {
            events.push(`consume:${request.uid}`);
            routed.push([request.uid, response]);
          });
          const requests = ['first', 'second', 'third'].map((uid) => ({
            uid,
            url: `https://llm.test/${uid}`,
            method: 'post',
          }));
          manager.processStudentResponses(requests, {});
          expect(fetchAll.mock.calls.map(([batch]) => batch.map(({ url }) => url))).toEqual([
            ['https://llm.test/first', 'https://llm.test/second'],
            ['https://llm.test/third'],
          ]);
          expect(events).toEqual([
            'fetch:https://llm.test/first,https://llm.test/second',
            'consume:first',
            'consume:second',
            'fetch:https://llm.test/third',
            'consume:third',
          ]);
          expect(eventsAtSecondBatch).toEqual(events.slice(0, 3));
          expect(routed.map(([uid]) => uid)).toEqual(['first', 'second', 'third']);
          for (const [uid, response] of routed) {
            expect(response).toBe(responseByUrl.get(`https://llm.test/${uid}`));
          }
          expect(routed[0][1].getResponseCode()).toBe(201);
        }
      );
    } finally {
      delete require.cache[llmPath];
      if (previousLlmModule) require.cache[llmPath] = previousLlmModule;
    }
  });

  it('propagates response-consumer faults unchanged without dispatching another batch', () => {
    const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
    const llmPath = require.resolve('#backend/RequestHandlers/LLMRequestManager.js');
    const previousLlmModule = require.cache[llmPath];
    const BaseRequestManager = require(basePath);
    const fetchAll = vi.fn((requests) =>
      requests.map(() => ({ getResponseCode: () => 200, getContentText: () => '{}' }))
    );
    const fetch = vi.fn();
    const sleep = vi.fn();
    const routeError = new Error('consumer routing fault');
    try {
      withTemporaryGlobals(
        {
          BaseRequestManager: () => BaseRequestManager,
          ConfigurationManager: () => ({
            getInstance: () => ({ getBackendAssessorBatchSize: () => 1 }),
          }),
          CacheService: () => ({ getScriptCache: () => ({ get: () => null, put: vi.fn() }) }),
          ProgressTracker: () => ({
            getInstance: () => ({
              updateProgress: vi.fn(),
              getCurrentProgress: () => ({ message: 'Assessing' }),
            }),
          }),
          ABLogger: () => ({
            getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
          }),
          UrlFetchApp: () => ({ fetchAll, fetch }),
          Utilities: () => ({ sleep }),
        },
        () => {
          delete require.cache[llmPath];
          const Manager = require(llmPath);
          const manager = new Manager();
          manager.progressTracker = {
            updateProgress: vi.fn(),
            getCurrentProgress: () => ({ message: 'Assessing' }),
          };
          vi.spyOn(manager, '_processSingleResponse').mockImplementation(() => {
            throw routeError;
          });
          let thrown;
          try {
            manager.processStudentResponses(
              [
                { uid: 'first', url: 'https://llm.test/first' },
                { uid: 'later', url: 'https://llm.test/later' },
              ],
              {}
            );
          } catch (error) {
            thrown = error;
          }
          expect(thrown).toBe(routeError);
          expect(fetchAll.mock.calls.map(([batch]) => batch.map(({ url }) => url))).toEqual([
            ['https://llm.test/first'],
          ]);
          expect(fetch).not.toHaveBeenCalled();
          expect(sleep).not.toHaveBeenCalled();
        }
      );
    } finally {
      delete require.cache[llmPath];
      if (previousLlmModule) require.cache[llmPath] = previousLlmModule;
    }
  });
});
