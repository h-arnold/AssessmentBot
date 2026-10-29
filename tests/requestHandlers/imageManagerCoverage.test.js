import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for ImageManager: artefact checks, collection
// filtering, batched fetching and blob write back. All network and GAS
// collaborators are mocked.
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

const { ArtifactFactory } = require('#backend/Models/Artifacts/index.js');
const ImageManager = require('#backend/RequestHandlers/ImageManager.js');

function buildManager(overrides = {}) {
  const manager = new ImageManager();
  manager.configManager = { getApiKey: () => 'test-key' };
  Object.assign(manager, overrides);
  return manager;
}

function imageArtifact(role, sourceUrl, uid = undefined) {
  return ArtifactFactory.image({
    type: 'image',
    taskId: 'task-one',
    role,
    metadata: { sourceUrl },
    taskIndex: 0,
    artifactIndex: 0,
    ...(uid ? { uid } : {}),
  });
}

describe('ImageManager artefact behaviour', () => {
  let restoreGlobals;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('identifies image artefacts only', () => {
    const manager = buildManager();
    expect(manager.isImageArtifact(null)).toBe(false);
    expect(manager.isImageArtifact({})).toBe(false);
    expect(manager.isImageArtifact({ getType: 'not-a-function' })).toBe(false);
    expect(manager.isImageArtifact({ getType: () => 'TEXT' })).toBe(false);

    const image = imageArtifact('reference', 'https://example.com/image.png');
    expect(manager.isImageArtifact(image)).toBe(true);
  });

  it('skips non image reference artefacts and invalid urls', () => {
    const manager = buildManager();
    const textArtifact = ArtifactFactory.text({
      type: 'text',
      taskId: 'task-one',
      role: 'reference',
      content: 'hello',
      taskIndex: 0,
      artifactIndex: 0,
    });
    const badImage = imageArtifact('reference', 'not-a-url');
    const assignment = {
      assignmentDefinition: {
        tasks: {
          task_one: {
            id: 'task-one',
            artifacts: { reference: [textArtifact, badImage], template: [] },
            taskTitle: 'Task One',
          },
        },
        referenceDocumentId: 'ref-doc',
        templateDocumentId: 'tpl-doc',
      },
      submissions: [],
    };
    expect(manager.collectAllImageArtifacts(assignment)).toEqual([]);
  });

  it('skips image artefacts when the owning document id is missing', () => {
    const manager = buildManager();
    const image = imageArtifact('template', 'https://example.com/image.png');
    const assignment = {
      assignmentDefinition: {
        tasks: {
          task_one: {
            id: 'task-one',
            artifacts: { reference: [], template: [image] },
            taskTitle: 'Task One',
          },
        },
        referenceDocumentId: 'ref-doc',
        templateDocumentId: null,
      },
      submissions: [],
    };
    expect(manager.collectAllImageArtifacts(assignment)).toEqual([]);
  });

  it('collects submission images and warns on invalid submission urls', () => {
    const manager = buildManager();
    const good = imageArtifact('submission', 'https://example.com/student.png');
    const bad = imageArtifact('submission', 'invalid-url');
    const text = ArtifactFactory.text({
      type: 'text',
      taskId: 'task-one',
      role: 'submission',
      content: 'hello',
      taskIndex: 0,
      artifactIndex: 0,
    });
    const assignment = {
      assignmentDefinition: { tasks: {}, referenceDocumentId: 'ref', templateDocumentId: 'tpl' },
      submissions: [
        { documentId: null, items: {} },
        { documentId: 'student-doc', items: {} },
        {
          documentId: 'student-doc',
          items: {
            good: { taskId: 'task-one', id: 'item-good', artifact: good },
            bad: { taskId: 'task-one', id: 'item-bad', artifact: bad },
            text: { taskId: 'task-one', id: 'item-text', artifact: text },
            missing: { taskId: 'task-one', id: 'item-missing' },
          },
        },
      ],
    };
    const entries = manager.collectAllImageArtifacts(assignment);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      scope: 'submission',
      documentId: 'student-doc',
      taskId: 'task-one',
      itemId: 'item-good',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Submission image artifact has no valid sourceUrl; it will not be hydrated and content stays null',
      expect.objectContaining({ taskId: 'task-one' })
    );
  });
});

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

  it.each([
    { label: 'final HTTP failure', responseCode: 500, error: null, expectedStatus: 500 },
    {
      label: 'final network failure',
      responseCode: null,
      error: new Error('opaque network failure'),
      expectedStatus: null,
    },
  ])(
    'safely warns for a $label without reading response details',
    ({ responseCode, error, expectedStatus }) => {
      const warnings = [];
      const mockContext = withGlobalMocks({
        ABLogger: () => ({ getInstance: () => ({ warn: (...args) => warnings.push(args) }) }),
      });
      const manager = buildManager();
      manager.progressTracker = { updateProgress: vi.fn() };
      const getResponseCode = vi.fn(() => responseCode);
      const getBlob = vi.fn(() => 'must not be read');
      const response = responseCode === null ? null : { getResponseCode, getBlob };
      manager.sendRequestsInBatches = vi.fn((requests, options) => {
        options.onBatchComplete([{ uid: requests[0].uid, response, error, attempts: 3 }]);
      });
      try {
        expect(
          manager.fetchImagesAsBlobs([
            { uid: 'opaque-uid', url: 'https://private.example/image', documentId: 'doc-a' },
          ])
        ).toEqual([]);
        expect(warnings).toEqual([
          [
            'Failed to fetch image',
            { uid: 'opaque-uid', attempts: 3, responseCode: expectedStatus },
          ],
        ]);
        expect(getBlob).not.toHaveBeenCalled();
        if (response) expect(getResponseCode).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(warnings)).not.toContain('private.example');
        expect(JSON.stringify(warnings)).not.toContain('opaque network failure');
      } finally {
        mockContext.restore();
      }
    }
  );
});
