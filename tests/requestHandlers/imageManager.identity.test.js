import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Routing-identity and wiring-fault coverage for ImageManager: final failure
// outcomes must route to a real owning item by scope (never log-only
// omission), and unmatched writeback identities or missing model methods are
// wiring faults that throw. All network and GAS collaborators are mocked.
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

describe('ImageManager routing identity and wiring faults', () => {
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

  it('throws for a final failure outcome on a scope-less entry instead of log-only omission', () => {
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    const scopelessEntry = {
      uid: 'opaque-uid',
      url: 'https://private.example/image',
      documentId: 'doc-a',
    };
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete([
        networkOutcome('opaque-uid', new Error('opaque network failure'), 3),
      ]);
    });
    expect(() => manager.fetchImagesAsBlobs([scopelessEntry])).toThrow();
  });

  it('throws for a failed student outcome whose item is missing the model error methods', () => {
    const manager = buildManager();
    manager.progressTracker = { updateProgress: vi.fn() };
    const brokenItem = {
      taskId: 'task-one',
      id: 'item-one',
      artifact: {
        getUid: () => 'uid-one',
        getType: () => 'IMAGE',
        metadata: { sourceUrl: 'https://images.test/pending.png' },
      },
    };
    const assignment = {
      assignmentDefinition: { tasks: {} },
      submissions: [{ documentId: 'student-doc', items: { 'task-one': brokenItem } }],
    };
    const entries = manager.collectAllImageArtifacts(assignment);
    expect(entries).toHaveLength(1);
    manager.sendRequestsInBatches = vi.fn((requests, options) => {
      options.onBatchComplete([
        httpOutcome('uid-one', 500, 3, () => ({ getBytes: () => [1, 2, 3] })),
      ]);
    });
    expect(() => manager.fetchImagesAsBlobs(entries)).toThrow();
  });

  it('throws when a writeback blob uid matches no collected artefact', () => {
    const manager = buildManager();
    const reference = imageArtifact('reference', 'https://example.com/ref.png');
    const assignment = {
      assignmentDefinition: {
        tasks: { task_one: { artifacts: { reference: [reference], template: [] } } },
      },
      submissions: [],
    };
    expect(() =>
      manager.writeBackBlobs(assignment, [
        { uid: 'missing-uid', blob: { getBytes: () => [4, 5, 6] } },
      ])
    ).toThrow();
    expect(reference.content).toBeNull();
  });

  it('throws when writeback receives duplicate blob UIDs before applying any blob', () => {
    const manager = buildManager();
    const reference = imageArtifact('reference', 'https://example.com/ref.png');
    const assignment = {
      assignmentDefinition: {
        tasks: { task_one: { artifacts: { reference: [reference], template: [] } } },
      },
      submissions: [],
    };
    const blob = { getBytes: () => [1, 2, 3] };
    expect(() =>
      manager.writeBackBlobs(assignment, [
        { uid: reference.getUid(), blob },
        { uid: reference.getUid(), blob },
      ])
    ).toThrow();
    expect(reference.content).toBeNull();
    expect(reference.contentHash).toBeNull();
  });

  it('throws when the model contains duplicate image artefact UIDs instead of overwriting', () => {
    const manager = buildManager();
    const first = imageArtifact('template', 'https://example.com/a.png', 'shared-uid');
    const second = imageArtifact('template', 'https://example.com/b.png', 'shared-uid');
    const assignment = {
      assignmentDefinition: {
        tasks: { task_one: { artifacts: { reference: [], template: [first, second] } } },
      },
      submissions: [],
    };
    expect(() =>
      manager.writeBackBlobs(assignment, [
        { uid: 'shared-uid', blob: { getBytes: () => [1, 2, 3] } },
      ])
    ).toThrow();
    expect(first.content).toBeNull();
    expect(second.content).toBeNull();
  });

  it('throws when a matched image artefact is missing the content model methods', () => {
    const manager = buildManager();
    const artifact = { getUid: () => 'bare-uid', getType: () => 'IMAGE' };
    const assignment = {
      assignmentDefinition: {
        tasks: { task_one: { artifacts: { reference: [artifact], template: [] } } },
      },
      submissions: [],
    };
    expect(() =>
      manager.writeBackBlobs(assignment, [{ uid: 'bare-uid', blob: { getBytes: () => [1] } }])
    ).toThrow();
  });

  it.each([
    ['a null blob', () => null],
    ['empty returned bytes', () => ({ getBytes: () => [] })],
  ])(
    'throws for a missing content writer before converting %s returned data',
    (_label, makeBlob) => {
      const manager = buildManager();
      const artifact = imageArtifact('submission', 'https://images.test/student.png');
      artifact.setContentFromBlob = undefined;
      const item = new globalThis.StudentSubmissionItem({ taskId: 'task-one', artifact });
      const assignment = {
        assignmentDefinition: { tasks: {} },
        submissions: [{ documentId: 'student-doc', items: { 'task-one': item } }],
      };
      expect(() =>
        manager.writeBackBlobs(assignment, [{ uid: artifact.getUid(), blob: makeBlob() }])
      ).toThrow();
      expect(item.getAssessment()).toEqual({});
    }
  );

  it.each([
    ['a missing submissions collection', undefined],
    ['a submission without its items map', [{ documentId: 'student-doc' }]],
  ])(
    'fails fast on %s instead of hydrating shared artefacts through fallbacks',
    (_label, submissions) => {
      const manager = buildManager();
      const shared = imageArtifact('reference', 'https://example.com/ref.png');
      const assignment = {
        assignmentDefinition: {
          tasks: { task_one: { artifacts: { reference: [shared], template: [] } } },
        },
        submissions,
      };
      expect(() =>
        manager.writeBackBlobs(assignment, [
          { uid: shared.getUid(), blob: { getBytes: () => [1, 2, 3] } },
        ])
      ).toThrow();
      expect(shared.content).toBeNull();
      expect(shared.contentHash).toBeNull();
    }
  );
});

describe('ImageManager shared unusable returned content blocking', () => {
  let restoreGlobals;

  beforeEach(() => {
    const mockContext = withGlobalMocks({
      ABLogger: () => ({
        getInstance: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
      }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['reference', 'null returned bytes', () => ({ getBytes: () => null }), false],
    ['reference', 'empty returned bytes', () => ({ getBytes: () => [] }), false],
    ['reference', 'a null blob', () => null, false],
    ['reference', 'a reader-less blob while pending', () => ({}), false],
    ['reference', 'a reader-less blob while already hydrated', () => ({}), true],
    ['template', 'null returned bytes', () => ({ getBytes: () => null }), false],
    ['template', 'empty returned bytes', () => ({ getBytes: () => [] }), false],
    ['template', 'a null blob', () => null, false],
    ['template', 'a reader-less blob while pending', () => ({}), false],
    ['template', 'a reader-less blob while already hydrated', () => ({}), true],
  ])(
    'blocks writeback when a shared %s image returns %s without throwing',
    (role, _label, makeBlob, reused) => {
      const manager = buildManager();
      const shared = imageArtifact(role, `https://example.com/${role}.png`);
      if (reused) {
        shared.content = 'data:image/png;base64,AQID';
        shared.contentHash = globalThis.Utils.generateHash(shared.content);
      }
      const artifacts =
        role === 'reference'
          ? { reference: [shared], template: [] }
          : { reference: [], template: [shared] };
      const assignment = {
        assignmentDefinition: {
          tasks: { task_one: { artifacts } },
        },
        submissions: [],
      };
      // Unusable returned content blocks by shared scope: a throwing failure,
      // never a silent success or a student-task hydration E.
      expect(() =>
        manager.writeBackBlobs(assignment, [{ uid: shared.getUid(), blob: makeBlob() }])
      ).toThrow();
      // No partial application survives the blocking failure of a pending
      // artefact; a reused one is only pinned to the blocking throw itself.
      if (!reused) {
        expect(shared.content).toBeNull();
        expect(shared.contentHash).toBeNull();
      }
    }
  );
});
