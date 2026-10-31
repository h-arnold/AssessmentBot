import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';
import { createAssignment } from '../helpers/llmRequestManagerHarness.js';

// Hydrated-content availability, sibling survival and result invalidation
// coverage for the ImageManager writeback boundary (companion to the writeBack
// suite). Availability probes are bounded to returned-content usability —
// null/empty bytes, reader-less or null blobs and unusable stored fingerprints
// — with no image-format or source-policy validation. Sibling survival is
// proved within one canonical submission for both the fetch path and a
// writeback failure. All network and GAS collaborators are mocked.
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
  manager.configManager = { getApiKey: () => 'KEY' };
  Object.assign(manager, overrides);
  return manager;
}

function pendingImageItem(sourceUrl) {
  const artifact = ArtifactFactory.image({
    type: 'image',
    taskId: 'task-one',
    role: 'submission',
    metadata: { sourceUrl },
    taskIndex: 0,
    artifactIndex: 0,
  });
  return new globalThis.StudentSubmissionItem({ taskId: 'task-one', artifact });
}

function submissionAssignment(item) {
  return {
    assignmentDefinition: { tasks: {} },
    submissions: [{ documentId: 'student-doc', items: { [item.taskId]: item } }],
  };
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

/** Installs a warning observer and returns it with its restore handle. */
function captureWarnings() {
  const warnings = [];
  const mockContext = withGlobalMocks({
    ABLogger: () => ({
      getInstance: () => ({
        warn: (...args) => warnings.push(args),
        info: vi.fn(),
        error: vi.fn(),
      }),
    }),
  });
  return { warnings, restore: mockContext.restore };
}

/** One failed IMAGE item beside its healthy TEXT sibling from the same canonical submission. */
function mediumSameSubmissionFixture() {
  const inputs = loadBackendModelInputs('medium');
  const assignment = globalThis.Assignment.fromJSON(
    structuredClone(inputs.assignmentsByKey['assignment-0-4'])
  );
  const submission = assignment.submissions.find((entry) => entry.studentId.endsWith('0000'));
  const failed = submission.getItem('task-0-1');
  failed.artifact.content = null;
  failed.artifact.contentHash = null;
  failed.artifact.metadata = { sourceUrl: 'https://images.test/pending.png' };
  const sibling = submission.getItem('task-0-0');
  assignment.submissions = [submission];
  return { assignment, failed, sibling };
}

describe('ImageManager hydrated content availability', () => {
  it.each([
    { label: 'empty returned bytes', makeBlob: () => ({ getBytes: () => [] }), reused: false },
    { label: 'a null blob', makeBlob: () => null, reused: false },
    { label: 'a blob without a byte reader', makeBlob: () => ({}), reused: false },
    { label: 'a reader-less blob on an already hydrated item', makeBlob: () => ({}), reused: true },
  ])(
    'materialises the hydration error after apparent writeback success with $label',
    ({ makeBlob, reused }) => {
      const item = pendingImageItem('https://images.test/student.png');
      if (reused) {
        Object.assign(item.artifact, { content: 'data:image/png;base64,AQ', contentHash: 'hash' });
        item.addAssessment('completeness', { score: 4, reasoning: 'stale mark' });
      }
      const manager = buildManager();
      const { warnings, restore } = captureWarnings();
      try {
        manager.writeBackBlobs(submissionAssignment(item), [
          { uid: item.artifact.getUid(), blob: makeBlob() },
        ]);
        expectHydrationError(item);
        expect(item.artifact.content).toBeNull();
        expect(item.artifact.contentHash).toBeNull();
        expect(warnings).toHaveLength(1);
        expect(warnings[0][1]).toMatchObject({
          uid: item.artifact.getUid(),
          taskId: 'task-one',
          scope: 'submission',
        });
        expect(JSON.stringify(warnings)).not.toContain('images.test');
      } finally {
        restore();
      }
    }
  );

  it('materialises the hydration error when the writer succeeds with an unusable stored hash', () => {
    const item = pendingImageItem('https://images.test/student.png');
    const manager = buildManager();
    const { warnings, restore } = captureWarnings();
    const hashContext = withGlobalMocks({
      Utils: () => ({ ...globalThis.Utils, generateHash: () => null }),
    });
    try {
      manager.writeBackBlobs(submissionAssignment(item), [
        { uid: item.artifact.getUid(), blob: { getBytes: () => [1, 2, 3] } },
      ]);
      expectHydrationError(item);
      expect(item.artifact.content).toBeNull();
      expect(item.artifact.contentHash).toBeNull();
      expect(warnings).toHaveLength(1);
      expect(warnings[0][1]).toMatchObject({
        uid: item.artifact.getUid(),
        taskId: 'task-one',
        scope: 'submission',
      });
      expect(JSON.stringify(warnings)).not.toContain('data:image');
    } finally {
      hashContext.restore();
      restore();
    }
  });
});

describe('ImageManager sibling survival across hydration failures', () => {
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

  it('keeps a healthy task beside a failed IMAGE task in the same submission', () => {
    const { assignment, failed, sibling } = mediumSameSubmissionFixture();
    const siblingResults = structuredClone(sibling.getAssessment());
    const siblingFeedback = structuredClone(sibling.getFeedback());
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    const entries = manager.collectAllImageArtifacts(assignment);
    expect(entries).toHaveLength(1);
    expect(entries[0].uid).toBe(failed.artifact.getUid());
    expect(entries[0].itemId).toBe(failed.id);
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete([httpOutcome(failed.artifact.getUid(), 500, 3, vi.fn())]);
    });
    expect(manager.fetchImagesAsBlobs(entries)).toEqual([]);
    expectHydrationError(failed);
    expect(failed.artifact.content).toBeNull();
    expect(failed.artifact.contentHash).toBeNull();
    expect(structuredClone(sibling.getAssessment())).toEqual(siblingResults);
    expect(structuredClone(sibling.getFeedback())).toEqual(siblingFeedback);
    expect(sibling.getAssessment('completeness')).toMatchObject({ score: 0 });
  });

  it('preserves existing results on the failed item and its healthy sibling when a student writeback fails', () => {
    const { assignment, failed, sibling } = mediumSameSubmissionFixture();
    const fault = new Error('native read fault');
    const siblingResults = structuredClone(sibling.getAssessment());
    const siblingFeedback = structuredClone(sibling.getFeedback());
    const siblingContent = sibling.artifact.content;
    // The canonical item keeps its own pre-existing 0/0/N marks beside the
    // pending artefact mutation. A thrown native read replaces no content, so
    // those results must survive verbatim — never converted to hydration E
    // and never cleared by the manager.
    const failedResults = structuredClone(failed.getAssessment());
    expect(failedResults).toMatchObject({
      completeness: { score: 0 },
      accuracy: { score: 0 },
      spag: { score: 'N' },
    });
    const manager = buildManager();
    let caught;
    try {
      manager.writeBackBlobs(assignment, [
        {
          uid: failed.artifact.getUid(),
          blob: {
            getBytes: () => {
              throw fault;
            },
          },
        },
      ]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(fault);
    expect(structuredClone(failed.getAssessment())).toEqual(failedResults);
    expect(failed.artifact.content).toBeNull();
    expect(failed.artifact.contentHash).toBeNull();
    expect(structuredClone(sibling.getAssessment())).toEqual(siblingResults);
    expect(structuredClone(sibling.getFeedback())).toEqual(siblingFeedback);
    expect(sibling.artifact.content).toBe(siblingContent);
  });
});

describe('ImageManager result invalidation on reused items', () => {
  it('invalidates full results and feedback when non-null hydrated content changes', () => {
    const { assignment, item } = createAssignment('IMAGE');
    const previousContent = item.artifact.content;
    const previousHash = item.artifact.contentHash;
    item.addFeedback('general', { text: 'stale feedback', category: 'general' });
    expect(Object.keys(item.getAssessment())).toEqual(['completeness', 'accuracy', 'spag']);
    const manager = buildManager();
    manager.writeBackBlobs(assignment, [
      { uid: item.artifact.getUid(), blob: { getBytes: () => [7, 7, 7] } },
    ]);
    expect(item.artifact.content).not.toBe(previousContent);
    expect(item.artifact.content).toMatch(/^data:image\/png;base64,/);
    // Real model-owned hash oracle: the stored fingerprint must be the hash
    // the model chain computes for the hydrated content, not just truthy.
    expect(item.artifact.contentHash).toBe(
      globalThis.Utils.generateHash(JSON.stringify(item.artifact.content))
    );
    expect(item.artifact.contentHash).not.toBe(previousHash);
    expect(item.getAssessment()).toEqual({});
    expect(item.getFeedback()).toEqual({});
  });

  it('preserves full results and feedback when the hydrated content is unchanged', () => {
    const { assignment, item } = createAssignment('IMAGE');
    const previousContent = item.artifact.content;
    const canonicalResults = structuredClone(item.getAssessment());
    const canonicalFeedback = structuredClone(item.getFeedback());
    const prefix = 'data:image/png;base64,';
    const bytes = Array.from(Buffer.from(previousContent.slice(prefix.length), 'base64'));
    const manager = buildManager();
    manager.writeBackBlobs(assignment, [
      { uid: item.artifact.getUid(), blob: { getBytes: () => bytes } },
    ]);
    expect(item.artifact.content).toBe(previousContent);
    expect(item.artifact.contentHash).toBe(
      globalThis.Utils.generateHash(JSON.stringify(item.artifact.content))
    );
    expect(item.getAssessment()).toEqual(canonicalResults);
    expect(item.getFeedback()).toEqual(canonicalFeedback);
  });
});
