import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  withGlobalMocks,
  withTemporaryGlobals,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';
import { createAssignment } from '../helpers/llmRequestManagerHarness.js';

// Scoped image-failure coverage for ImageManager: final shared-transport
// outcomes are assigned by scope (student-task hydration E versus a blocking
// shared-input failure), scoped failures are logged privately and the shared
// attempt budget is honoured. Routing-identity and wiring-fault rejections
// live in the identity companion suite. Canonical small/medium graphs are
// restored through the existing backend adapter; response/blob/error fixtures
// stay local.
const savedBaseRequestManagerGlobals = saveGlobals(['BaseRequestManager']);
const RealBaseRequestManager = require('#backend/RequestHandlers/BaseRequestManager.js');
globalThis.BaseRequestManager = globalThis.BaseRequestManager || RealBaseRequestManager;

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

/** The exact atomic all-three extraction IMAGE_HYDRATION_FAILED E contract. */
function expectHydrationError(item) {
  for (const criterion of ['completeness', 'accuracy', 'spag']) {
    expect(item.getAssessment(criterion)).toMatchObject({
      score: 'E',
      reasoning: 'The submitted slide image could not be loaded.',
      error: { stage: 'extraction', code: 'IMAGE_HYDRATION_FAILED' },
    });
  }
}

function httpOutcome(uid, status, attempts, getBlob) {
  return {
    uid,
    response: { getResponseCode: () => status, getBlob },
    error: null,
    attempts,
  };
}

function networkOutcome(uid, error, attempts) {
  return { uid, response: null, error, attempts };
}

describe('ImageManager scoped image failure outcomes', () => {
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

  it.each([
    { label: 'final HTTP failure', responseCode: 500, error: null, expectedStatus: 500 },
    {
      label: 'final network failure',
      responseCode: null,
      error: new Error('opaque network failure'),
      expectedStatus: null,
    },
  ])(
    'warns privately and materialises the scoped hydration error for a $label',
    ({ responseCode, error, expectedStatus }) => {
      const warnings = [];
      const mockContext = withGlobalMocks({
        ABLogger: () => ({ getInstance: () => ({ warn: (...args) => warnings.push(args) }) }),
      });
      const { assignment, item } = createAssignment('IMAGE');
      item.artifact.content = null;
      item.artifact.contentHash = null;
      item.artifact.metadata = { sourceUrl: 'https://images.test/pending.png' };
      const manager = buildManager();
      manager.progressTracker = { updateProgress: vi.fn() };
      const entries = manager.collectAllImageArtifacts(assignment);
      expect(entries).toHaveLength(1);
      const getBlob = vi.fn(() => 'must not be read');
      manager.sendRequestsInBatches = vi.fn((requests, options) => {
        const outcome =
          responseCode === null
            ? networkOutcome(entries[0].uid, error, 3)
            : httpOutcome(entries[0].uid, responseCode, 3, getBlob);
        options.onBatchComplete([outcome]);
      });
      try {
        expect(manager.fetchImagesAsBlobs(entries)).toEqual([]);
        expect(getBlob).not.toHaveBeenCalled();
        expectHydrationError(item);
        expect(warnings).toHaveLength(1);
        expect(warnings[0][0]).toBe('Failed to fetch image');
        expect(warnings[0][1]).toMatchObject({
          uid: entries[0].uid,
          taskId: entries[0].taskId,
          scope: 'submission',
          attempts: 3,
          responseCode: expectedStatus,
        });
        expect(JSON.stringify(warnings)).not.toContain('images.test');
        expect(JSON.stringify(warnings)).not.toContain('opaque network failure');
      } finally {
        mockContext.restore();
      }
    }
  );

  it.each([
    { label: 'permanent HTTP 403', status: 403, error: null, attempts: 1 },
    { label: 'exhausted HTTP 500', status: 500, error: null, attempts: 3 },
    {
      label: 'final network failure',
      status: null,
      error: new Error('opaque network failure'),
      attempts: 3,
    },
  ])(
    'assigns a $label to the failed student task while a healthy sibling hydrates',
    ({ status, error, attempts }) => {
      const inputs = loadBackendModelInputs('medium');
      const assignment = globalThis.Assignment.fromJSON(
        structuredClone(inputs.assignmentsByKey['assignment-0-4'])
      );
      const pendingItems = assignment.submissions
        .filter((submission) => ['0000', '0004'].includes(submission.studentId.slice(-4)))
        .map((submission) => {
          const taskId = Object.keys(submission.items).find(
            (key) => submission.items[key].artifact.getType() === 'IMAGE'
          );
          const item = submission.getItem(taskId);
          item.artifact.content = null;
          item.artifact.contentHash = null;
          item.artifact.metadata = { sourceUrl: 'https://images.test/pending.png' };
          return item;
        });
      expect(pendingItems).toHaveLength(2);
      // Untouched controls: a non-IMAGE task in the healthy sibling's own
      // submission and the failed task's SPREADSHEET sibling. Neither takes
      // part in the image flow, so their full result/feedback snapshots must
      // survive the scoped failure end to end.
      const untouchedItem = assignment.submissions
        .find((submission) => submission.studentId.endsWith('0000'))
        .getItem('task-0-0');
      const failedSiblingItem = assignment.submissions
        .find((submission) => submission.studentId.endsWith('0004'))
        .getItem('task-0-1');
      expect(untouchedItem.artifact.getType()).toBe('TEXT');
      expect(failedSiblingItem.artifact.getType()).toBe('SPREADSHEET');
      const untouchedResults = structuredClone(untouchedItem.getAssessment());
      const untouchedFeedback = structuredClone(untouchedItem.getFeedback());
      const siblingResults = structuredClone(failedSiblingItem.getAssessment());
      const manager = buildManager();
      manager.progressTracker = { updateProgress: vi.fn() };
      const entries = manager.collectAllImageArtifacts(assignment);
      expect(entries).toHaveLength(2);
      const [healthy, failed] = entries;
      expect(healthy.scope).toBe('submission');
      const failedGetBlob = vi.fn();
      manager.sendRequestsInBatches = vi.fn((requests, options) => {
        options.onBatchComplete([
          httpOutcome(healthy.uid, 200, 1, () => ({ getBytes: () => [1, 2, 3] })),
          status === null
            ? networkOutcome(failed.uid, error, attempts)
            : httpOutcome(failed.uid, status, attempts, failedGetBlob),
        ]);
      });
      const blobs = manager.fetchImagesAsBlobs(entries);
      expect(manager.sendRequestsInBatches).toHaveBeenCalledTimes(1);
      expect(manager.sendRequestsInBatches.mock.calls[0][1]).toMatchObject({
        acceptedStatuses: [200],
        stopStatuses: [],
      });
      expect(blobs).toHaveLength(1);
      expect(failedGetBlob).not.toHaveBeenCalled();
      manager.writeBackBlobs(assignment, blobs);
      expectHydrationError(pendingItems[1]);
      expect(pendingItems[1].artifact.content).toBeNull();
      expect(pendingItems[1].artifact.contentHash).toBeNull();
      // The changed healthy item hydrates with usable content/hash, and its
      // stale results/feedback are invalidated — never preserved beside
      // replaced content.
      expect(pendingItems[0].artifact.content).toMatch(/^data:image\/png;base64,/);
      expect(pendingItems[0].artifact.contentHash).toBeTruthy();
      expect(pendingItems[0].getAssessment()).toEqual({});
      expect(pendingItems[0].getFeedback()).toEqual({});
      // Correctly scoped in-place assignment: the failed entry identifies the
      // owning model item, and untouched siblings keep their full snapshots.
      expect(failed.itemId).toBe(pendingItems[1].id);
      expect(structuredClone(untouchedItem.getAssessment())).toEqual(untouchedResults);
      expect(structuredClone(untouchedItem.getFeedback())).toEqual(untouchedFeedback);
      expect(structuredClone(failedSiblingItem.getAssessment())).toEqual(siblingResults);
    }
  );

  it('honours the three-attempt shared transport budget and hydrates on the final attempt', () => {
    const artifact = ArtifactFactory.image({
      type: 'image',
      taskId: 'task-budget',
      role: 'submission',
      metadata: { sourceUrl: 'https://images.test/budget.png' },
      taskIndex: 0,
      artifactIndex: 0,
    });
    const item = new globalThis.StudentSubmissionItem({ taskId: 'task-budget', artifact });
    const entry = {
      uid: artifact.getUid(),
      url: 'https://images.test/budget.png',
      documentId: 'student-doc',
      scope: 'submission',
      taskId: 'task-budget',
      itemId: item.id,
    };
    const sleeps = [];
    const nativeResponse = (status) => ({
      getResponseCode: () => status,
      getBlob: () => ({ getBytes: () => [1, 2, 3] }),
    });
    const fetchAll = vi.fn(() => [nativeResponse(500)]);
    const fetch = vi.fn(() => nativeResponse(fetch.mock.calls.length === 1 ? 500 : 200));
    const sleep = vi.fn((ms) => sleeps.push(ms));
    withTemporaryGlobals(
      {
        ConfigurationManager: () => ({
          getInstance: () => ({ getApiKey: () => 'key', getSlidesFetchBatchSize: () => 2 }),
        }),
        ScriptApp: () => ({ getOAuthToken: () => 'token' }),
        UrlFetchApp: () => ({ fetchAll, fetch }),
        Utilities: () => ({
          sleep,
          base64Encode: (bytes) => Buffer.from(Uint8Array.from(bytes)).toString('base64'),
        }),
        ProgressTracker: () => ({
          getInstance: () => ({
            updateProgress: vi.fn(),
            getCurrentProgress: () => ({ message: 'Fetching images' }),
          }),
        }),
        ABLogger: () => ({
          getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }),
        CacheService: () => ({ getScriptCache: () => ({}) }),
      },
      () => {
        const manager = new ImageManager();
        const blobs = manager.fetchImagesAsBlobs([entry]);
        expect(blobs).toHaveLength(1);
        manager.writeBackBlobs(
          {
            assignmentDefinition: { tasks: {} },
            submissions: [{ documentId: 'student-doc', items: { [item.taskId]: item } }],
          },
          blobs
        );
        expect(item.artifact.content).toMatch(/^data:image\/png;base64,/);
        expect(item.getAssessment()).toEqual({});
      }
    );
    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([5000, 7500]);
  });
});
