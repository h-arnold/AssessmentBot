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

const { ArtifactFactory } = require('../../src/backend/Models/Artifacts/index.js');
const ImageManager = require('../../src/backend/RequestHandlers/ImageManager.js');

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

  it('fetches blobs across documents with progress updates', () => {
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    manager.sendRequestsInBatches = vi.fn((requests) =>
      requests.map(() => ({
        getResponseCode: () => 200,
        getBlob: () => ({ getBytes: () => [1, 2, 3] }),
      }))
    );
    const entries = [
      { uid: 'uid-one', url: 'https://example.com/one.png', documentId: 'doc-a' },
      { uid: 'uid-two', url: 'https://example.com/two.png', documentId: 'doc-b' },
      { uid: 'uid-three', url: 'https://example.com/three.png', documentId: 'doc-a' },
    ];
    const blobs = manager.fetchImagesAsBlobs(entries);
    expect(blobs).toHaveLength(3);
    expect(manager.progressTracker.updateProgress).toHaveBeenCalled();
    const sentUrls = manager.sendRequestsInBatches.mock.calls[0][0].map((item) => item.url);
    expect(sentUrls).toContain('https://example.com/one.png');
  });

  it('warns when blob reads fail or responses are not successful', () => {
    const warnings = [];
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => ({ warn: (...args) => warnings.push(args) }) }),
    });
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    manager.sendRequestsInBatches = vi.fn(() => [
      {
        getResponseCode: () => 200,
        getBlob: () => {
          throw new Error('blob read failed');
        },
      },
      { getResponseCode: () => 500 },
      null,
    ]);
    const blobs = manager.fetchImagesAsBlobs([
      { uid: 'uid-one', url: 'https://example.com/one.png', documentId: 'doc-a' },
      { uid: 'uid-two', url: 'https://example.com/two.png', documentId: 'doc-a' },
      { uid: 'uid-three', url: 'https://example.com/three.png', documentId: 'doc-a' },
    ]);
    expect(blobs).toEqual([]);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    mockContext.restore();
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
});
