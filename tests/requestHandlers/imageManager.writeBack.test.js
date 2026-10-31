import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Blob write-back coverage for ImageManager: early returns, UID-matched
// content/hash application and the scoped hydration failure/invalidation
// contracts (routing-identity wiring faults live in the identity companion
// suite). All network and GAS collaborators are mocked.
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

/** A real pending submission image item: null content/hash awaiting hydration. */
function pendingImageItem(sourceUrl) {
  const artifact = imageArtifact('submission', sourceUrl);
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

  it('writes blobs to matching artefacts', () => {
    const manager = buildManager();
    const reference = imageArtifact('reference', 'https://example.com/ref.png');
    const assignment = {
      assignmentDefinition: {
        tasks: {
          task_one: {
            artifacts: { reference: [reference], template: [] },
          },
        },
      },
      submissions: [],
    };
    manager.writeBackBlobs(assignment, [
      { uid: reference.getUid(), blob: { getBytes: () => [4, 5, 6] } },
    ]);
    expect(reference.content).toBeTruthy();
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

describe('ImageManager hydration writeback failure and invalidation contracts', () => {
  it('materialises the hydration error for known unusable returned blob bytes', () => {
    const item = pendingImageItem('https://images.test/student.png');
    const manager = buildManager();
    manager.writeBackBlobs(submissionAssignment(item), [
      { uid: item.artifact.getUid(), blob: { getBytes: () => null } },
    ]);
    expectHydrationError(item);
    expect(item.artifact.content).toBeNull();
    expect(item.artifact.contentHash).toBeNull();
  });

  it.each(['reference', 'template'])(
    'propagates the original fault when a shared %s blob cannot be written',
    (role) => {
      const manager = buildManager();
      const fault = new Error('write failed');
      const failing = {
        getUid: () => 'failing-uid',
        getType: () => 'IMAGE',
        setContentFromBlob: () => {
          throw fault;
        },
      };
      const artifacts =
        role === 'reference'
          ? { reference: [failing], template: [] }
          : { reference: [], template: [failing] };
      const assignment = {
        assignmentDefinition: {
          tasks: { task_one: { artifacts } },
        },
        submissions: [],
      };
      let caught;
      try {
        manager.writeBackBlobs(assignment, [{ uid: 'failing-uid', blob: {} }]);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(fault);
    }
  );

  // Every thrown value escapes the writeback by original identity: the only
  // expected hydration failure is unusable returned bytes, never a thrown
  // error class. Ordinary errors from internal collaborators are covered
  // separately below. The thrown path emits no diagnostic of its own — the
  // caller boundary owns the failure log, so no raw error is logged twice.
  it.each([
    ['an ordinary Error', () => new Error('native read fault')],
    ['a TypeError', () => new TypeError('programming fault')],
    ['a ReferenceError', () => new ReferenceError('programming fault')],
    ['a non-Error value', () => 'opaque fault'],
  ])('propagates %s thrown while applying a student blob by identity', (_label, makeFault) => {
    const item = pendingImageItem('https://images.test/student.png');
    const manager = buildManager();
    const fault = makeFault();
    const blob = {
      getBytes: () => {
        throw fault;
      },
    };
    const warnings = [];
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => ({ warn: (...args) => warnings.push(args) }) }),
    });
    let caught;
    try {
      manager.writeBackBlobs(submissionAssignment(item), [{ uid: item.artifact.getUid(), blob }]);
    } catch (error) {
      caught = error;
    } finally {
      mockContext.restore();
    }
    expect(caught).toBe(fault);
    expect(item.getAssessment()).toEqual({});
    // No duplicate raw-error logging on the thrown path: no converted
    // diagnostic is emitted and the caller boundary owns the failure log.
    expect(warnings).toEqual([]);
  });

  it('propagates an ordinary Error thrown while base64-encoding hydrated bytes', () => {
    const item = pendingImageItem('https://images.test/student.png');
    const manager = buildManager();
    const fault = new Error('base64 encode fault');
    const mockContext = withGlobalMocks({
      Utilities: () => ({
        base64Encode: () => {
          throw fault;
        },
      }),
    });
    let caught;
    try {
      manager.writeBackBlobs(submissionAssignment(item), [
        { uid: item.artifact.getUid(), blob: { getBytes: () => [1, 2, 3] } },
      ]);
    } catch (error) {
      caught = error;
    } finally {
      mockContext.restore();
    }
    expect(caught).toBe(fault);
    expect(item.getAssessment()).toEqual({});
  });

  it('propagates an ordinary Error thrown while hashing hydrated content', () => {
    const item = pendingImageItem('https://images.test/student.png');
    const manager = buildManager();
    const fault = new Error('hash fault');
    const mockContext = withGlobalMocks({
      Utils: () => ({
        ...globalThis.Utils,
        generateHash: () => {
          throw fault;
        },
      }),
    });
    let caught;
    try {
      manager.writeBackBlobs(submissionAssignment(item), [
        { uid: item.artifact.getUid(), blob: { getBytes: () => [1, 2, 3] } },
      ]);
    } catch (error) {
      caught = error;
    } finally {
      mockContext.restore();
    }
    expect(caught).toBe(fault);
    expect(item.getAssessment()).toEqual({});
  });

  it('refreshes the hash on successful hydration and invalidates stale results only when content changes', () => {
    const item = pendingImageItem('https://images.test/student.png');
    item.addAssessment('completeness', { score: 4, reasoning: 'stale numeric mark' });
    item.addAssessment('accuracy', { score: 3, reasoning: 'stale numeric mark' });
    item.addAssessment('spag', { score: 2, reasoning: 'stale numeric mark' });
    item.addFeedback('general', { text: 'stale feedback', category: 'general' });
    const manager = buildManager();
    const assignment = submissionAssignment(item);
    const blob = { getBytes: () => [1, 2, 3] };

    manager.writeBackBlobs(assignment, [{ uid: item.artifact.getUid(), blob }]);

    expect(item.artifact.content).toMatch(/^data:image\/png;base64,/);
    expect(item.artifact.contentHash).toBeTruthy();
    expect(item.artifact.metadata.sourceUrl).toBe('https://images.test/student.png');
    expect(item.getAssessment()).toEqual({});
    expect(item.getFeedback()).toEqual({});

    item.addAssessment('completeness', { score: 2, reasoning: 'fresh mark' });
    manager.writeBackBlobs(assignment, [{ uid: item.artifact.getUid(), blob }]);
    expect(item.getAssessment('completeness')).toMatchObject({ score: 2 });
  });
});
