import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';

/**
 * Hand-built dispatch scenarios for the LLM transport caller policy. These rows
 * supply route entries directly and exercise two-phase dispatch: seeds are the
 * first request per TaskDefinition, dispatched as one parallel round with a
 * batch size equal to the seed count, and the remainder is dispatched with the
 * configured assessor batch size. Every expectation below is derived from that
 * call sequence rather than pinned to pre-seeding batch counts.
 */
describe('LLM transport caller policy — hand-built dispatch scenarios', () => {
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
          const requests = [
            { uid: 'one', url: '/one' },
            { uid: 'two', url: '/two' },
          ];
          // Both UIDs route to one TaskDefinition: 'one' is the phase-1 seed and
          // 'two' the sole phase-2 remainder, so the two calls stay distinct.
          manager.uidIndex = {
            one: { taskDefinition: { getId: () => 'task-alpha' } },
            two: { taskDefinition: { getId: () => 'task-alpha' } },
          };
          const transport = vi
            .spyOn(BaseRequestManager.prototype, 'sendRequestsInBatches')
            .mockReturnValue([]);
          manager.processStudentResponses(requests, {});
          expect(transport).toHaveBeenCalledTimes(2);
          expect(transport).toHaveBeenNthCalledWith(1, [requests[0]], {
            batchSize: 1,
            acceptedStatuses: [200, 201],
            stopStatuses: [401, 403, 404],
            onBatchComplete: expect.any(Function),
          });
          expect(transport).toHaveBeenNthCalledWith(2, [requests[1]], {
            batchSize: 37,
            acceptedStatuses: [200, 201],
            stopStatuses: [401, 403, 404],
            onBatchComplete: expect.any(Function),
          });
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
          manager.uidIndex = {
            first: { taskDefinition: { getId: () => 'task-alpha' } },
            second: { taskDefinition: { getId: () => 'task-beta' } },
            third: { taskDefinition: { getId: () => 'task-alpha' } },
          };
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
          // 'first' and 'second' are the two seeds of the phase-1 round; 'third'
          // routes to the first seed's task and is therefore the sole remainder,
          // dispatched in the next round. This keeps the two-batch call shape.
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
          // Same task for both UIDs: 'first' is the only seed, 'later' the only
          // remainder. The consumer fault in phase 1 prevents phase 2 entirely.
          manager.uidIndex = {
            first: { taskDefinition: { getId: () => 'task-alpha' } },
            later: { taskDefinition: { getId: () => 'task-alpha' } },
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
