import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withGlobalMocks, withTemporaryGlobals } from '../helpers/globalMockManager.js';

// Stubs for globals required by ImageManager & Artifacts
globalThis.Utils = {
  generateHash: (str) => {
    let h = 0,
      i,
      chr;
    if (!str) return '0';
    for (i = 0; i < str.length; i++) {
      chr = str.codePointAt(i);
      h = (h << 5) - h + chr;
      h = Math.trunc(h);
    }
    return Math.abs(h).toString(16);
  },
  isValidUrl: (u) => typeof u === 'string' && u.startsWith('https://'),
};
class DummyProgressTracker {
  updateProgress() {
    /* noop */
  }
  logError(msg) {
    /* noop */
  }
  logAndThrowError(msg) {
    throw new Error(msg);
  }
}
globalThis.ProgressTracker = { getInstance: () => new DummyProgressTracker() };

// Minimal Utilities + ScriptApp stubs used by image artifact when setting content
globalThis.Utilities = { base64Encode: (bytes) => Buffer.from(bytes).toString('base64') };
globalThis.ScriptApp = { getOAuthToken: () => 'TOKEN' };

// BaseRequestManager stub parent providing batch request sending
class DummyBaseRequestManager {
  // Accepts array of request objects; produce 200 code responses with deterministic blob
  sendRequestsInBatches(requests) {
    return requests.map((req, idx) => ({
      getResponseCode: () => 200,
      getBlob: () => ({ getBytes: () => [idx, idx + 1, idx + 2] }),
    }));
  }
}

DummyBaseRequestManager.HTTP_STATUS_OK = 200;
DummyBaseRequestManager.HTTP_STATUS_CREATED = 201;

globalThis.BaseRequestManager = DummyBaseRequestManager;

// Import artifacts & ImageManager
const { ArtifactFactory } = require('#backend/Models/Artifacts/index.js');
const ImageManager = require('#backend/RequestHandlers/ImageManager.js');

function buildManager(overrides = {}) {
  const manager = buildImageManager();
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

function buildImageManager() {
  const mgr = new ImageManager();
  // Inject stub configManager expected by constructor / instance
  mgr.configManager = { getApiKey: () => 'KEY' };
  return mgr;
}

describe('Phase 5 ImageManager', () => {
  let assignment;
  beforeEach(() => {
    // Build assignment with TaskDefinition-like shape (no need for full class for mapping)
    const imageRef = ArtifactFactory.image({
      type: 'image',
      taskId: 't1',
      role: 'reference',
      metadata: { sourceUrl: 'https://ref.example.com/img1.png' },
      taskIndex: 0,
      artifactIndex: 0,
    });
    const imageTpl = ArtifactFactory.image({
      type: 'image',
      taskId: 't1',
      role: 'template',
      metadata: { sourceUrl: 'https://tpl.example.com/img1.png' },
      taskIndex: 0,
      artifactIndex: 0,
    });
    const tdLike = {
      id: 't1',
      artifacts: { reference: [imageRef], template: [imageTpl] },
      index: 0,
      taskTitle: 'Image Task',
    };

    // Submission with image item
    const subImage = ArtifactFactory.image({
      type: 'image',
      taskId: 't1',
      role: 'submission',
      metadata: { sourceUrl: 'https://stud.example.com/img1.png' },
      taskIndex: 0,
      artifactIndex: 1,
    });
    const submission = {
      documentId: 'studDoc1',
      items: {
        t1: {
          taskId: 't1',
          id: 'item1',
          pageId: null,
          artifact: subImage,
          feedback: {},
          assessments: {},
        },
      },
      studentId: 's1',
    };

    assignment = {
      assignmentDefinition: {
        tasks: { t1: tdLike },
        referenceDocumentId: 'refDoc',
        templateDocumentId: 'tplDoc',
      },
      submissions: [submission],
    };
  });

  it('collectAllImageArtifacts aggregates reference, template, and submission with correct scopes', () => {
    const mgr = buildImageManager();
    const entries = mgr.collectAllImageArtifacts(assignment);
    const scopes = entries.map((e) => e.scope).sort((a, b) => a.localeCompare(b));
    expect(scopes).toEqual(['reference', 'submission', 'template']);
    const uids = new Set(entries.map((e) => e.uid));
    expect(uids.size).toBe(3); // unique
    // Ensure documentIds match expected
    const byScope = Object.fromEntries(entries.map((e) => [e.scope, e]));
    expect(byScope.reference.documentId).toBe('refDoc');
    expect(byScope.template.documentId).toBe('tplDoc');
    expect(byScope.submission.documentId).toBe('studDoc1');
  });

  it('delegates the complete round-robin list with explicit Slides transport policy', () => {
    const mgr = buildImageManager();
    const requests = [
      { uid: 'first', url: 'https://images.test/first', documentId: 'doc-a' },
      { uid: 'second', url: 'https://images.test/second', documentId: 'doc-b' },
      { uid: 'third', url: 'https://images.test/third', documentId: 'doc-a' },
    ];
    mgr.collectAllImageArtifacts = () => requests;
    mgr.sendRequestsInBatches = vi.fn((batch) =>
      batch.map(({ uid }) => ({ uid, getResponseCode: () => 200, getBlob: () => ({}) }))
    );
    mgr.progressTracker = { updateProgress: vi.fn() };

    const globals = withGlobalMocks({
      ConfigurationManager: () => ({ getInstance: () => ({ getSlidesFetchBatchSize: () => 2 }) }),
    });
    try {
      mgr.fetchImagesAsBlobs(requests);
      expect(mgr.sendRequestsInBatches).toHaveBeenCalledTimes(1);
      expect(mgr.sendRequestsInBatches).toHaveBeenCalledWith(
        expect.arrayContaining(requests.map(({ url }) => expect.objectContaining({ url }))),
        expect.objectContaining({ batchSize: 2, acceptedStatuses: [200], stopStatuses: [] })
      );
    } finally {
      globals.restore();
    }
  });

  it('consumes real image blobs before the next Slides batch and refuses HTTP 201', () => {
    const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
    const imagePath = require.resolve('#backend/RequestHandlers/ImageManager.js');
    const previousImageModule = require.cache[imagePath];
    const RealBaseRequestManager = require(basePath);
    const events = [];
    let eventsAtSecondNativeBatch;
    const fetchAll = vi.fn((nativeRequests) => {
      const urls = nativeRequests.map(({ url }) => url);
      if (urls.includes('https://images.test/a2')) eventsAtSecondNativeBatch = [...events];
      events.push(`fetch:${urls.join(',')}`);
      return nativeRequests.map(({ url }) => {
        const status = url.endsWith('/a1') ? 201 : 200;
        return {
          url,
          getResponseCode: () => status,
          getBlob: () => {
            events.push(`blob:${url}`);
            return { sourceUrl: url };
          },
        };
      });
    });
    const tracker = {
      updateProgress: vi.fn(),
      getCurrentProgress: () => ({ message: 'Fetching images' }),
    };

    try {
      withTemporaryGlobals(
        {
          BaseRequestManager: () => RealBaseRequestManager,
          ConfigurationManager: () => ({
            getInstance: () => ({
              getSlidesFetchBatchSize: () => 2,
              getBackendAssessorBatchSize: () => 3,
            }),
          }),
          CacheService: () => ({ getScriptCache: () => ({}) }),
          ProgressTracker: () => ({ getInstance: () => tracker }),
          ABLogger: () => ({
            getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
          }),
          UrlFetchApp: () => ({ fetchAll, fetch: vi.fn() }),
        },
        () => {
          delete require.cache[imagePath];
          const RealImageManager = require(imagePath);
          const manager = new RealImageManager();
          manager.progressTracker = tracker;
          const sender = vi.spyOn(manager, 'sendRequestsInBatches');
          const entries = [
            { uid: 'image-a1', url: 'https://images.test/a1', documentId: 'doc-a' },
            { uid: 'image-b1', url: 'https://images.test/b1', documentId: 'doc-b' },
            { uid: 'image-a2', url: 'https://images.test/a2', documentId: 'doc-a' },
          ];

          const blobs = manager.fetchImagesAsBlobs(entries);

          expect(sender).toHaveBeenCalledTimes(1);
          expect(sender).toHaveBeenCalledWith(
            expect.arrayContaining(entries.map(({ url }) => expect.objectContaining({ url }))),
            expect.objectContaining({
              batchSize: 2,
              acceptedStatuses: [200],
              stopStatuses: [],
              onBatchComplete: expect.any(Function),
            })
          );
          expect(fetchAll.mock.calls.map(([batch]) => batch.map(({ url }) => url))).toEqual([
            ['https://images.test/a1', 'https://images.test/b1'],
            ['https://images.test/a2'],
          ]);
          expect(events).toEqual([
            'fetch:https://images.test/a1,https://images.test/b1',
            'blob:https://images.test/b1',
            'fetch:https://images.test/a2',
            'blob:https://images.test/a2',
          ]);
          expect(eventsAtSecondNativeBatch).toEqual([
            'fetch:https://images.test/a1,https://images.test/b1',
            'blob:https://images.test/b1',
          ]);
          expect(blobs.map(({ uid, blob }) => [uid, blob.sourceUrl])).toEqual([
            ['image-b1', 'https://images.test/b1'],
            ['image-a2', 'https://images.test/a2'],
          ]);
          expect(blobs.map(({ uid }) => uid)).toEqual(['image-b1', 'image-a2']);
          expect(fetchAll).toHaveBeenCalledTimes(2);
        }
      );
    } finally {
      delete require.cache[imagePath];
      if (previousImageModule) require.cache[imagePath] = previousImageModule;
    }
  });

  // NOTE: test for round-robin ordering was removed per request.

  it('writeBackBlobs sets base64 content and contentHash on artifacts', () => {
    const mgr = buildImageManager();
    const entries = mgr.collectAllImageArtifacts(assignment);
    // Simulate blobs for each uid
    const blobs = entries.map((e, idx) => ({
      uid: e.uid,
      blob: { getBytes: () => [1, 2, 3, idx] },
    }));
    mgr.writeBackBlobs(assignment, blobs);
    // Validate artifacts updated
    const td = assignment.assignmentDefinition.tasks.t1;
    const allArts = [
      ...td.artifacts.reference,
      ...td.artifacts.template,
      assignment.submissions[0].items['t1'].artifact,
    ];
    allArts.forEach((a) => {
      expect(a.content).toBeTypeOf('string');
      expect(a.content.length).toBeGreaterThan(0);
      expect(a.contentHash).toBeTruthy();
    });
  });
});

describe('ImageManager write back behaviour', () => {
  let restoreGlobals;
  let warnings;

  beforeEach(() => {
    warnings = [];
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => ({ warn: (...args) => warnings.push(args) }) }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('returns early when no blobs are supplied', () => {
    const manager = buildManager();
    expect(manager.writeBackBlobs({ assignmentDefinition: { tasks: {} } }, null)).toBeUndefined();
    expect(manager.writeBackBlobs({ assignmentDefinition: { tasks: {} } }, [])).toBeUndefined();
  });

  it('writes blobs to matching artefacts and warns on mismatches', () => {
    const manager = buildManager();
    const reference = imageArtifact('reference', 'https://example.com/ref.png');
    const mismatched = { getUid: () => 'unknown-uid', setContentFromBlob: vi.fn() };
    const assignment = {
      assignmentDefinition: {
        tasks: {
          task_one: {
            artifacts: { reference: [reference, mismatched], template: [] },
          },
        },
      },
      submissions: [],
    };
    const blob = { getBytes: () => [4, 5, 6] };
    manager.writeBackBlobs(assignment, [
      { uid: reference.getUid(), blob },
      { uid: 'missing-uid', blob },
    ]);
    expect(reference.content).toBeTruthy();
    expect(warnings.some((args) => args[0].includes('did not match'))).toBe(true);
  });

  it('warns when blob content cannot be applied', () => {
    const manager = buildManager();
    const failing = {
      getUid: () => 'failing-uid',
      getType: () => 'IMAGE',
      setContentFromBlob: () => {
        throw new Error('write failed');
      },
    };
    const assignment = {
      assignmentDefinition: {
        tasks: { task_one: { artifacts: { reference: [failing], template: [] } } },
      },
      submissions: [],
    };
    manager.writeBackBlobs(assignment, [{ uid: 'failing-uid', blob: {} }]);
    expect(warnings.some((args) => args[0].includes('Failed to write blob'))).toBe(true);
  });

  it('writes submission artefacts by uid', () => {
    const manager = buildManager();
    const submissionImage = imageArtifact('submission', 'https://example.com/student.png');
    const assignment = {
      assignmentDefinition: { tasks: {} },
      submissions: [
        {
          items: {
            item_one: { taskId: 'task-one', id: 'item-one', artifact: submissionImage },
            item_text: {
              taskId: 'task-one',
              id: 'item-text',
              artifact: ArtifactFactory.text({
                type: 'text',
                taskId: 'task-one',
                role: 'submission',
                content: 'hello',
                taskIndex: 0,
                artifactIndex: 0,
              }),
            },
          },
        },
      ],
    };
    manager.writeBackBlobs(assignment, [
      { uid: submissionImage.getUid(), blob: { getBytes: () => [7, 8, 9] } },
    ]);
    expect(submissionImage.content).toBeTruthy();
  });

  it.each([
    ['unknown', ['known', 'unknown']],
    ['duplicate', ['known', 'known']],
  ])(
    'rejects %s final image outcomes before blob access or another dispatch',
    (_kind, outcomeUids) => {
      const manager = buildImageManager();
      const entries = [
        { uid: 'known', url: 'https://images.test/known', documentId: 'doc-a' },
        { uid: 'other', url: 'https://images.test/other', documentId: 'doc-b' },
      ];
      manager.collectAllImageArtifacts = () => entries;
      const getBlob = vi.fn(() => ({ source: 'known' }));
      const nativeResponse = { getResponseCode: () => 200, getBlob };
      const outcomes = [
        { uid: outcomeUids[0], response: nativeResponse, error: null, attempts: 1 },
        { uid: outcomeUids[1], response: nativeResponse, error: null, attempts: 1 },
      ];
      let callbackReturned = false;
      manager.sendRequestsInBatches = vi.fn((_requests, options) => {
        options.onBatchComplete(outcomes);
        callbackReturned = true;
      });
      manager.progressTracker = { updateProgress: vi.fn() };
      withTemporaryGlobals(
        {
          ConfigurationManager: () => ({
            getInstance: () => ({ getSlidesFetchBatchSize: () => 2 }),
          }),
        },
        () => {
          expect(() => manager.fetchImagesAsBlobs(entries)).toThrow(
            /Unknown or duplicate image outcome UID/
          );
        }
      );

      expect(getBlob).not.toHaveBeenCalled();
      expect(outcomes[0].response).toBe(nativeResponse);
      expect(callbackReturned).toBe(false);
      expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
    }
  );

  it('rejects duplicate image input UIDs before sender invocation', () => {
    const manager = buildImageManager();
    const entries = [
      { uid: 'same', url: 'https://images.test/first', documentId: 'doc-a' },
      { uid: 'same', url: 'https://images.test/second', documentId: 'doc-b' },
    ];
    manager.collectAllImageArtifacts = () => entries;
    manager.sendRequestsInBatches = vi.fn();

    withTemporaryGlobals(
      {
        ConfigurationManager: () => ({ getInstance: () => ({ getSlidesFetchBatchSize: () => 2 }) }),
      },
      () => {
        expect(() => manager.fetchImagesAsBlobs(entries)).toThrow(
          'Duplicate image request UID: same'
        );
      }
    );
    expect(manager.sendRequestsInBatches).not.toHaveBeenCalled();
  });
});
