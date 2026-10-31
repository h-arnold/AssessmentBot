import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withGlobalMocks, withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { loadManager } from '../helpers/llmRequestManagerHarness.js';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

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

function buildImageManager() {
  const mgr = new ImageManager();
  // Inject stub configManager expected by constructor / instance
  mgr.configManager = { getApiKey: () => 'KEY' };
  return mgr;
}

/** A real pending submission IMAGE item awaiting hydration from sourceUrl. */
function pendingStudentImage(taskId, sourceUrl) {
  return new globalThis.StudentSubmissionItem({
    taskId,
    artifact: ArtifactFactory.image({
      type: 'image',
      taskId,
      role: 'submission',
      metadata: { sourceUrl },
      taskIndex: 0,
      artifactIndex: 0,
    }),
  });
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
    const fetch = vi.fn();
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
          UrlFetchApp: () => ({ fetchAll, fetch }),
        },
        () => {
          delete require.cache[imagePath];
          const RealImageManager = require(imagePath);
          const manager = new RealImageManager();
          manager.progressTracker = tracker;
          const sender = vi.spyOn(manager, 'sendRequestsInBatches');
          // Scoped student entries from real collection over pending IMAGE
          // models across two documents: the final 201 outcome has a real
          // owning item instead of a scope-less escape.
          const failedItem = pendingStudentImage('task-a1', 'https://images.test/a1');
          const healthyA2 = pendingStudentImage('task-a2', 'https://images.test/a2');
          const healthyB1 = pendingStudentImage('task-b1', 'https://images.test/b1');
          const assignment = {
            assignmentDefinition: {
              tasks: {},
              referenceDocumentId: 'ref',
              templateDocumentId: 'tpl',
            },
            submissions: [
              { documentId: 'doc-a', items: { 'task-a1': failedItem, 'task-a2': healthyA2 } },
              { documentId: 'doc-b', items: { 'task-b1': healthyB1 } },
            ],
          };
          const entries = manager.collectAllImageArtifacts(assignment);
          expect(entries).toHaveLength(3);
          const failedEntry = entries.find(({ url }) => url === 'https://images.test/a1');
          expect(failedEntry).toMatchObject({
            scope: 'submission',
            taskId: 'task-a1',
            itemId: failedItem.id,
          });

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
          expect(blobs.map(({ uid, blob }) => [uid, blob.sourceUrl])).toEqual(
            ['https://images.test/b1', 'https://images.test/a2'].map((url) => [
              entries.find((entry) => entry.url === url).uid,
              url,
            ])
          );
          expect(fetchAll).toHaveBeenCalledTimes(2);
          // 201 is a final image-download failure and is never retried.
          expect(fetch).not.toHaveBeenCalled();
          // The scoped 201 failure materialises the atomic hydration error on
          // its owning student item while the healthy items stay pending.
          for (const criterion of ['completeness', 'accuracy', 'spag']) {
            expect(failedItem.getAssessment(criterion)).toMatchObject({
              score: 'E',
              reasoning: 'The submitted slide image could not be loaded.',
              error: { stage: 'extraction', code: 'IMAGE_HYDRATION_FAILED' },
            });
          }
          expect(failedItem.artifact.content).toBeNull();
          expect(failedItem.artifact.contentHash).toBeNull();
          expect(healthyA2.getAssessment()).toEqual({});
          expect(healthyB1.getAssessment()).toEqual({});
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

  it('hydrates a student image with a single native byte read', () => {
    const item = pendingStudentImage('t1', 'https://images.test/student.png');
    item.addAssessment('completeness', { score: 4, reasoning: 'stale mark' });
    const getBytes = vi.fn(() => [1, 2, 3]);
    buildImageManager().writeBackBlobs(
      { assignmentDefinition: { tasks: {} }, submissions: [{ items: { t1: item } }] },
      [{ uid: item.artifact.getUid(), blob: { getBytes } }]
    );
    expect(getBytes).toHaveBeenCalledTimes(1);
    expect(item.artifact.content).toMatch(/^data:image\/png;base64,/);
    expect(item.artifact.contentHash).toBe(
      globalThis.Utils.generateHash(JSON.stringify(item.artifact.content))
    );
    expect(item.getAssessment()).toEqual({});
  });
});

describe('ImageManager transport UID guards', () => {
  let restoreGlobals;

  beforeEach(() => {
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
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

describe('ImageManager collection preserves upstream extraction causes', () => {
  it.each([
    ['missing IMAGE match', 'extraction', 'SOURCE_CONTENT_UNAVAILABLE'],
    ['failed document open', 'acquisition', 'SOURCE_UNREADABLE'],
  ])(
    'preserves the established %s cause instead of overwriting it during collection',
    (scenario, stage, code) => {
      const assignment = globalThis.Assignment.fromJSON(
        structuredClone(loadBackendModelInputs('small').assignmentsByKey['assignment-0-2'])
      );
      const submission = assignment.submissions.find((entry) => entry.documentId);
      const task = assignment.assignmentDefinition.tasks['task-2-1'];
      const missingMatch = {
        taskId: task.getId(),
        pageId: null,
        content: null,
        metadata: {},
        documentId: submission.documentId,
        type: 'IMAGE',
      };
      const extraction = scenario === 'failed document open' ? null : [missingMatch];
      const hydrationWarnings = vi.fn();
      const mockContext = withGlobalMocks({
        SlidesParser: () =>
          function () {
            return { extractSubmissionArtifacts: vi.fn(() => extraction) };
          },
        ABLogger: () => ({
          getInstance: () => ({ warn: hydrationWarnings, info: vi.fn(), error: vi.fn() }),
        }),
      });
      try {
        assignment.processAllSubmissions();
        const item = submission.getItem(task.getId());
        const prior = structuredClone(item.getAssessment());
        const established = item.getAssessment('completeness');
        expect(established).toMatchObject({ score: 'E', error: { stage, code } });
        expect(buildImageManager().collectAllImageArtifacts(assignment)).toEqual([]);
        expect(item.getAssessment()).toEqual(prior);
        expect(hydrationWarnings).not.toHaveBeenCalled();
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
      } finally {
        mockContext.restore();
      }
    }
  );
});
