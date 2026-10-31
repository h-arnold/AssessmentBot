import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Hermetic fetching-transport coverage for ImageManager: empty-input and
// configuration-acquisition guards, document round-robin scheduling and
// bounded large-input dispatch. All network and GAS collaborators are mocked.
class DummyBaseRequestManager {
  sendRequestsInBatches() {
    return [];
  }
}

const savedBaseRequestManagerGlobals = saveGlobals(['BaseRequestManager']);
globalThis.BaseRequestManager = globalThis.BaseRequestManager || DummyBaseRequestManager;

afterAll(() => {
  restoreSavedGlobals(savedBaseRequestManagerGlobals);
});

const ImageManager = require('#backend/RequestHandlers/ImageManager.js');

function buildManager(overrides = {}) {
  const manager = new ImageManager();
  manager.configManager = { getApiKey: () => 'test-key' };
  Object.assign(manager, overrides);
  return manager;
}

describe('ImageManager fetching behaviour', () => {
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

  it('returns early for empty entry lists', () => {
    const manager = buildManager();
    manager.sendRequestsInBatches = vi.fn();
    expect(manager.fetchImagesAsBlobs(null)).toEqual([]);
    expect(manager.fetchImagesAsBlobs([])).toEqual([]);
    expect(manager.sendRequestsInBatches).not.toHaveBeenCalled();
  });

  it('does not read batch-size configuration for empty entry lists', () => {
    const configurationError = new Error('configuration unavailable');
    const getBatchSize = vi.fn(() => {
      throw configurationError;
    });
    const mockContext = withGlobalMocks({
      ConfigurationManager: () => ({
        getInstance: () => ({ getSlidesFetchBatchSize: getBatchSize }),
      }),
    });
    const manager = buildManager();
    manager.sendRequestsInBatches = vi.fn();

    expect(manager.fetchImagesAsBlobs([])).toEqual([]);
    expect(getBatchSize).not.toHaveBeenCalled();
    expect(manager.sendRequestsInBatches).not.toHaveBeenCalled();
    mockContext.restore();
  });

  it('reads batch-size configuration and propagates its failure for non-empty entries', () => {
    const configurationError = new Error('configuration unavailable');
    const getBatchSize = vi.fn(() => {
      throw configurationError;
    });
    const mockContext = withGlobalMocks({
      ConfigurationManager: () => ({
        getInstance: () => ({ getSlidesFetchBatchSize: getBatchSize }),
      }),
    });
    const manager = buildManager();
    manager.sendRequestsInBatches = vi.fn();

    expect(() =>
      manager.fetchImagesAsBlobs([
        { uid: 'uid-one', url: 'https://example.com/one.png', documentId: 'doc-a' },
      ])
    ).toThrow(configurationError);
    expect(getBatchSize).toHaveBeenCalledTimes(1);
    expect(manager.sendRequestsInBatches).not.toHaveBeenCalled();
    mockContext.restore();
  });

  it('fetches blobs across documents with progress updates', () => {
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete(
        requests.map((request) => ({
          uid: request.uid,
          response: { getResponseCode: () => 200, getBlob: () => ({ getBytes: () => [1, 2, 3] }) },
          error: null,
          attempts: 1,
        }))
      );
    });
    const entries = [
      { uid: 'uid-one', url: 'https://example.com/one.png', documentId: 'doc-a' },
      { uid: 'uid-two', url: 'https://example.com/two.png', documentId: 'doc-b' },
      { uid: 'uid-three', url: 'https://example.com/three.png', documentId: 'doc-a' },
    ];
    const blobs = manager.fetchImagesAsBlobs(entries);
    expect(blobs).toHaveLength(3);
    expect(manager.progressTracker.updateProgress).toHaveBeenCalled();
    const [sentRequests, policy] = manager.sendRequestsInBatches.mock.calls[0];
    const sentUrls = sentRequests.map((item) => item.url);
    expect(sentUrls).toContain('https://example.com/one.png');
    expect(sentRequests).toHaveLength(3);
    expect(policy).toMatchObject({ batchSize: 10, acceptedStatuses: [200], stopStatuses: [] });
  });

  it('fetches a single document group in input order', () => {
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete(
        requests.map((request) => ({
          uid: request.uid,
          response: { getResponseCode: () => 200, getBlob: () => 'blob' },
          error: null,
          attempts: 1,
        }))
      );
    });
    const entries = [
      { uid: 'first', url: 'https://example.com/first', documentId: 'doc' },
      { uid: 'second', url: 'https://example.com/second', documentId: 'doc' },
    ];

    const result = manager.fetchImagesAsBlobs(entries);

    expect(manager.sendRequestsInBatches.mock.calls[0][0].map(({ url }) => url)).toEqual(
      entries.map(({ url }) => url)
    );
    expect(result.map(({ uid }) => uid)).toEqual(['first', 'second']);
  });

  it('round-robins uneven document groups across batches and keeps each response with its UID', () => {
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    const entries = [
      { uid: 'a0', url: 'https://images.example/a0', documentId: 'a' },
      { uid: 'b0', url: 'https://images.example/b0', documentId: 'b' },
      { uid: 'a1', url: 'https://images.example/a1', documentId: 'a' },
      { uid: 'c0', url: 'https://images.example/c0', documentId: 'c' },
      { uid: 'b1', url: 'https://images.example/b1', documentId: 'b' },
      { uid: 'a2', url: 'https://images.example/a2', documentId: 'a' },
      { uid: 'c1', url: 'https://images.example/c1', documentId: 'c' },
      { uid: 'c2', url: 'https://images.example/c2', documentId: 'c' },
      { uid: 'c3', url: 'https://images.example/c3', documentId: 'c' },
    ];
    let sentRequests;
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      sentRequests = requests;
      options.onBatchComplete(
        requests.map(({ uid, url }) => ({
          uid,
          response: { getResponseCode: () => 200, getBlob: () => ({ sourceUrl: url }) },
          error: null,
          attempts: 1,
        }))
      );
    });
    const configuration = withGlobalMocks({
      ConfigurationManager: () => ({ getInstance: () => ({ getSlidesFetchBatchSize: () => 2 }) }),
    });

    try {
      const result = manager.fetchImagesAsBlobs(entries);

      expect(sentRequests.map(({ url }) => url)).toEqual([
        'https://images.example/a0',
        'https://images.example/b0',
        'https://images.example/c0',
        'https://images.example/a1',
        'https://images.example/b1',
        'https://images.example/c1',
        'https://images.example/a2',
        'https://images.example/c2',
        'https://images.example/c3',
      ]);
      expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
      expect(manager.sendRequestsInBatches.mock.calls[0][1]).toMatchObject({
        batchSize: 2,
        acceptedStatuses: [200],
        stopStatuses: [],
      });
      expect(result.map(({ uid, blob }) => [uid, blob.sourceUrl])).toEqual(
        ['a0', 'b0', 'c0', 'a1', 'b1', 'c1', 'a2', 'c2', 'c3'].map((uid) => [
          uid,
          `https://images.example/${uid}`,
        ])
      );
    } finally {
      configuration.restore();
    }
  });

  it('fetches a bounded large number of distinct document groups without argument spreading', () => {
    const groupCount = 150_000;
    const configuration = withGlobalMocks({
      ConfigurationManager: () => ({
        getInstance: () => ({ getSlidesFetchBatchSize: () => groupCount }),
      }),
    });
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete(
        requests.map(({ uid, url }) => ({
          uid,
          response: { getResponseCode: () => 200, getBlob: () => url },
          error: null,
          attempts: 1,
        }))
      );
    });
    const entries = Array.from({ length: groupCount }, (_, index) => ({
      uid: `uid-${index}`,
      url: `https://images.example/${index}`,
      documentId: `document-${index}`,
    }));

    try {
      const result = manager.fetchImagesAsBlobs(entries);

      expect(result).toHaveLength(groupCount);
      expect(result[0]).toEqual({ uid: 'uid-0', blob: 'https://images.example/0' });
      expect(result.at(-1)).toEqual({
        uid: `uid-${groupCount - 1}`,
        blob: `https://images.example/${groupCount - 1}`,
      });
      expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
    } finally {
      configuration.restore();
    }
  }, 20_000);

  it('propagates the original blob-read failure without warning', () => {
    const warnings = [];
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => ({ warn: (...args) => warnings.push(args) }) }),
    });
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    const blobError = new Error('blob read failed');
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete([
        {
          uid: requests[0].uid,
          response: {
            getResponseCode: () => 200,
            getBlob: () => {
              throw blobError;
            },
          },
          error: null,
          attempts: 1,
        },
      ]);
    });
    try {
      let caught;
      try {
        manager.fetchImagesAsBlobs([
          { uid: 'uid-one', url: 'https://example.com/one.png', documentId: 'doc-a' },
        ]);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(blobError);
      expect(warnings).toEqual([]);
      expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
    } finally {
      mockContext.restore();
    }
  });
});
