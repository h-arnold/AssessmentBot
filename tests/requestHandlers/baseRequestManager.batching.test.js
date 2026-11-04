import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

let restoreGlobals;
let BaseRequestManager;
let fetchApp;
let utilities;
const response = (code) => ({
  code,
  getResponseCode: () => code,
  getContentText: () => `response ${code}`,
});

describe('BaseRequestManager per-batch dispatch and consumption', () => {
  beforeEach(() => {
    fetchApp = { fetch: vi.fn(), fetchAll: vi.fn() };
    utilities = { sleep: vi.fn() };
    const config = { getInstance: vi.fn(() => ({ getBackendAssessorBatchSize: () => 10 })) };
    const progress = {
      getInstance: vi.fn(() => ({
        logError: vi.fn(),
        updateProgress: vi.fn(),
        getCurrentProgress: () => ({ message: 'Processing' }),
      })),
    };
    const logger = { getInstance: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) };
    const AbortRequestError = require('#backend/Utils/ErrorTypes/AbortRequestError.js');
    restoreGlobals = withGlobalMocks({
      UrlFetchApp: fetchApp,
      Utilities: utilities,
      CacheService: { getScriptCache: () => ({}) },
      ConfigurationManager: config,
      ProgressTracker: progress,
      ABLogger: logger,
      AbortRequestError: () => AbortRequestError,
    }).restore;
    delete require.cache[require.resolve('#backend/RequestHandlers/BaseRequestManager.js')];
    BaseRequestManager = require('#backend/RequestHandlers/BaseRequestManager.js');
  });

  afterEach(() => {
    restoreGlobals();
    vi.clearAllMocks();
  });

  it('honours explicit batch size and consumes each completed batch before the next dispatch', () => {
    const events = [];
    const completed = [];
    fetchApp.fetchAll.mockImplementation((requests) => {
      events.push(`dispatch:${requests.map((request) => request.url).join(',')}`);
      return requests.map(() => response(200));
    });
    const requests = ['a', 'b', 'c'].map((uid) => ({ uid, url: `/${uid}` }));
    new BaseRequestManager().sendRequestsInBatches(requests, {
      batchSize: 2,
      acceptedStatuses: [200],
      stopStatuses: [],
      onBatchComplete: (outcomes) => {
        completed.push(outcomes);
        events.push(`consume:${outcomes.map(({ uid }) => uid).join(',')}`);
      },
    });
    expect(events).toEqual(['dispatch:/a,/b', 'consume:a,b', 'dispatch:/c', 'consume:c']);
    expect(
      completed.map((batch) =>
        batch.map(({ uid, response: nativeResponse }) => [uid, nativeResponse.code])
      )
    ).toEqual([
      [
        ['a', 200],
        ['b', 200],
      ],
      [['c', 200]],
    ]);
  });

  it('classifies every response before retry and preserves same-batch success when caller stop status is seen', () => {
    fetchApp.fetchAll.mockReturnValueOnce([response(200), response(401)]);
    const consumed = [];
    new BaseRequestManager().sendRequestsInBatches(
      [
        { uid: 'ok', url: '/x' },
        { uid: 'auth', url: '/x' },
        { uid: 'later', url: '/x' },
      ],
      {
        batchSize: 2,
        acceptedStatuses: [200, 201],
        stopStatuses: [401, 403, 404],
        onBatchComplete: (outcomes) => consumed.push(outcomes),
      }
    );
    expect(consumed[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uid: 'ok', response: expect.anything() }),
        expect.objectContaining({ uid: 'auth' }),
      ])
    );
    expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
    expect(fetchApp.fetch).not.toHaveBeenCalled();
  });

  it('counts thrown initial fetchAll as attempt one for each request and retries sequentially, never rebatching', () => {
    const batchError = new Error('batch network failure');
    fetchApp.fetchAll.mockImplementation(() => {
      throw batchError;
    });
    fetchApp.fetch.mockReturnValue(response(200));
    const requests = [
      { uid: 'one', url: '/one' },
      { uid: 'two', url: '/two' },
    ];
    new BaseRequestManager().sendRequestsInBatches(requests, {
      batchSize: 2,
      acceptedStatuses: [200],
      stopStatuses: [],
    });
    expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
    expect(fetchApp.fetch.mock.calls.map(([url]) => url)).toEqual(['/one', '/two']);
    expect(utilities.sleep).toHaveBeenCalledWith(5000);
  });

  it.each([
    { stopStatus: 401, position: 'before', members: ['stop', 'success', 'retry'] },
    {
      stopStatus: 403,
      position: 'between',
      members: ['success-before', 'stop', 'success-after', 'retry'],
    },
    { stopStatus: 404, position: 'after', members: ['success', 'retry', 'stop'] },
  ])(
    'classifies every received response with $stopStatus $position successes/retryables before stopping',
    ({ stopStatus, members }) => {
      const nativeResponses = new Map([
        ['success', response(200)],
        ['success-before', response(200)],
        ['success-after', response(201)],
        ['retry', response(503)],
        ['stop', response(stopStatus)],
      ]);
      fetchApp.fetchAll.mockReturnValueOnce(members.map((uid) => nativeResponses.get(uid)));
      const batches = [];
      new BaseRequestManager().sendRequestsInBatches(
        [...members, 'later'].map((uid) => ({ uid, url: `/${uid}` })),
        {
          batchSize: members.length,
          acceptedStatuses: [200, 201],
          stopStatuses: [401, 403, 404],
          onBatchComplete: (batch) => batches.push(batch),
        }
      );
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(members.length);
      expect(batches[0].map(({ uid }) => uid)).toEqual(members);
      for (const { uid, response: nativeResponse, attempts } of batches[0]) {
        expect(nativeResponse).toBe(nativeResponses.get(uid));
        expect(nativeResponse.getResponseCode()).toBe(nativeResponses.get(uid).code);
        expect(attempts).toBe(1);
      }
      expect(fetchApp.fetchAll.mock.calls[0][0]).toHaveLength(members.length);
      expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
      expect(fetchApp.fetchAll.mock.calls[0][0].map(({ url }) => url)).toEqual(
        members.map((uid) => `/${uid}`)
      );
      expect(fetchApp.fetch).not.toHaveBeenCalled();
      expect(utilities.sleep).not.toHaveBeenCalled();
    }
  );

  it.each([401, 403, 404])(
    'stops sequential retries and later batches when a retry returns HTTP %i',
    (stopStatus) => {
      const initialRetry = response(429);
      const initialSuccess = response(200);
      const secondInitialRetry = response(503);
      const retryStop = response(stopStatus);
      fetchApp.fetchAll.mockReturnValueOnce([initialRetry, initialSuccess, secondInitialRetry]);
      fetchApp.fetch.mockReturnValueOnce(retryStop);
      const batches = [];
      new BaseRequestManager().sendRequestsInBatches(
        [
          { uid: 'first-retry', url: '/first-retry' },
          { uid: 'success', url: '/success' },
          { uid: 'second-retry', url: '/second-retry' },
          { uid: 'later-batch', url: '/later-batch' },
        ],
        {
          batchSize: 3,
          acceptedStatuses: [200, 201],
          stopStatuses: [401, 403, 404],
          onBatchComplete: (batch) => batches.push(batch),
        }
      );
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(3);
      expect(batches[0][0]).toMatchObject({ uid: 'first-retry', attempts: 2 });
      expect(batches[0][0].response).toBe(retryStop);
      expect(batches[0][0].response.getResponseCode()).toBe(stopStatus);
      expect(batches[0][1]).toMatchObject({ uid: 'success', attempts: 1 });
      expect(batches[0][1].response).toBe(initialSuccess);
      expect(batches[0][2]).toMatchObject({ uid: 'second-retry', attempts: 1 });
      expect(batches[0][2].response).toBe(secondInitialRetry);
      expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
      expect(fetchApp.fetchAll.mock.calls[0][0].map(({ url }) => url)).toEqual([
        '/first-retry',
        '/success',
        '/second-retry',
      ]);
      expect(fetchApp.fetch.mock.calls.map(([url]) => url)).toEqual(['/first-retry']);
      expect(utilities.sleep.mock.calls).toEqual([[5000]]);
    }
  );

  it('does not treat image 403 as an LLM-wide stop and retains outcome identities', () => {
    const imageResponse = response(403);
    const healthyResponse = response(200);
    const laterResponse = response(200);
    fetchApp.fetchAll
      .mockReturnValueOnce([imageResponse, healthyResponse])
      .mockReturnValueOnce([laterResponse]);
    const completed = [];
    new BaseRequestManager().sendRequestsInBatches(
      [
        { uid: 'image', url: '/image' },
        { uid: 'healthy', url: '/healthy' },
        { uid: 'later', url: '/later' },
      ],
      {
        batchSize: 2,
        acceptedStatuses: [200],
        stopStatuses: [],
        onBatchComplete: (batch) => completed.push(batch),
      }
    );
    expect(completed[0].map(({ uid }) => uid)).toEqual(['image', 'healthy']);
    expect(completed[0][0].response).toBe(imageResponse);
    expect(completed[0][1].response).toBe(healthyResponse);
    expect(
      completed[0].map(({ uid, response: nativeResponse }) => [uid, nativeResponse.code])
    ).toEqual([
      ['image', 403],
      ['healthy', 200],
    ]);
    expect(
      completed[1].map(({ uid, response: nativeResponse }) => [uid, nativeResponse.code])
    ).toEqual([['later', 200]]);
    expect(completed[1][0].uid).toBe('later');
    expect(completed[1][0].response).toBe(laterResponse);
    expect(fetchApp.fetch).not.toHaveBeenCalled();
    expect(fetchApp.fetchAll).toHaveBeenCalledTimes(2);
  });

  it('retains per-member attempts and original final network errors after a thrown batch call', () => {
    const batchError = new Error('batch failure');
    const finalError = new Error('member network failure');
    const secondMemberFinalResponse = response(200);
    fetchApp.fetchAll.mockImplementationOnce(() => {
      throw batchError;
    });
    fetchApp.fetch
      .mockImplementationOnce(() => {
        throw finalError;
      })
      .mockImplementationOnce(() => {
        throw finalError;
      })
      .mockImplementationOnce(() => {
        throw finalError;
      })
      .mockReturnValueOnce(secondMemberFinalResponse);
    const completed = [];
    new BaseRequestManager().sendRequestsInBatches(
      [
        { uid: 'one', url: '/one' },
        { uid: 'two', url: '/two' },
      ],
      {
        batchSize: 2,
        acceptedStatuses: [200],
        stopStatuses: [],
        onBatchComplete: (batch) => completed.push(batch),
      }
    );
    expect(completed[0]).toHaveLength(2);
    expect(completed[0][0]).toMatchObject({ uid: 'one', response: null, attempts: 3 });
    expect(completed[0][0].error).toBe(finalError);
    expect(completed[0][1]).toMatchObject({ uid: 'two', error: null, attempts: 3 });
    expect(completed[0][1].response).toBe(secondMemberFinalResponse);
    expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
    expect(fetchApp.fetch.mock.calls.map(([url]) => url)).toEqual(['/one', '/one', '/two', '/two']);
    expect(utilities.sleep.mock.calls).toEqual([[5000], [7500], [5000], [7500]]);
  });

  it('rejects duplicate request identities before dispatch', () => {
    const manager = new BaseRequestManager();
    fetchApp.fetchAll.mockReturnValueOnce([response(200), response(200)]);
    expect(() =>
      manager.sendRequestsInBatches(
        [
          { uid: 'same', url: '/one' },
          { uid: 'same', url: '/two' },
        ],
        { batchSize: 2, acceptedStatuses: [200], stopStatuses: [] }
      )
    ).toThrow();
    expect(fetchApp.fetchAll).not.toHaveBeenCalled();
  });

  it('rejects excess native responses without retry or routing them to requests', () => {
    const manager = new BaseRequestManager();
    fetchApp.fetchAll.mockReturnValueOnce([response(200), response(200)]);
    expect(() =>
      manager.sendRequestsInBatches([{ uid: 'expected', url: '/expected' }], {
        batchSize: 1,
        acceptedStatuses: [200],
        stopStatuses: [],
      })
    ).toThrow();
    expect(fetchApp.fetch).not.toHaveBeenCalled();

    expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty native response list for a dispatched request', () => {
    const manager = new BaseRequestManager();
    fetchApp.fetchAll.mockReturnValueOnce([]);
    expect(() =>
      manager.sendRequestsInBatches([{ uid: 'unmatched', url: '/unmatched' }], {
        batchSize: 1,
        acceptedStatuses: [200],
        stopStatuses: [],
      })
    ).toThrow();

    expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing request identity before dispatch', () => {
    const manager = new BaseRequestManager();
    fetchApp.fetchAll.mockReturnValueOnce([response(200)]);
    expect(() =>
      manager.sendRequestsInBatches([{ url: '/missing-uid' }], {
        batchSize: 1,
        acceptedStatuses: [200],
        stopStatuses: [],
      })
    ).toThrow();
    expect(fetchApp.fetchAll).not.toHaveBeenCalled();
  });

  it('propagates a callback fault by identity and does not retry it', () => {
    const manager = new BaseRequestManager();
    const callbackError = new Error('consumer bug');
    fetchApp.fetchAll.mockReturnValueOnce([response(200)]);
    let propagated;
    try {
      manager.sendRequestsInBatches([{ uid: 'callback', url: '/callback' }], {
        batchSize: 1,
        acceptedStatuses: [200],
        stopStatuses: [],
        onBatchComplete: () => {
          throw callbackError;
        },
      });
    } catch (error) {
      propagated = error;
    }
    expect(propagated).toBe(callbackError);
    expect(fetchApp.fetchAll).toHaveBeenCalledTimes(1);
    expect(fetchApp.fetchAll.mock.calls[0][0].map(({ url }) => url)).toEqual(['/callback']);
    expect(fetchApp.fetch).not.toHaveBeenCalled();
    expect(utilities.sleep).not.toHaveBeenCalled();
  });
});
