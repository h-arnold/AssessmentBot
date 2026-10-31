import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';
import { createAssignment } from '../helpers/llmRequestManagerHarness.js';

// Collection-scope coverage for ImageManager: artefact type checks, image
// collection filtering across reference, template and submission artefacts,
// and the scoped source-availability contracts at the collection boundary
// (required shared sources block the run; student sources materialise the
// hydration error on the real model item). All network and GAS collaborators
// are mocked.
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

  it('identifies image artefacts only', () => {
    const manager = buildManager();
    expect(manager.isImageArtifact(null)).toBe(false);
    expect(manager.isImageArtifact({})).toBe(false);
    expect(manager.isImageArtifact({ getType: 'not-a-function' })).toBe(false);
    expect(manager.isImageArtifact({ getType: () => 'TEXT' })).toBe(false);

    const image = imageArtifact('reference', 'https://example.com/image.png');
    expect(manager.isImageArtifact(image)).toBe(true);
  });

  it('skips non-image reference artefacts during collection', () => {
    const manager = buildManager();
    const textArtifact = ArtifactFactory.text({
      type: 'text',
      taskId: 'task-one',
      role: 'reference',
      content: 'hello',
      taskIndex: 0,
      artifactIndex: 0,
    });
    const assignment = {
      assignmentDefinition: {
        tasks: {
          task_one: {
            id: 'task-one',
            artifacts: { reference: [textArtifact], template: [] },
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

  it.each([
    ['reference', 'absent', undefined],
    ['reference', 'invalid', 'not-a-url'],
    ['template', 'absent', undefined],
    ['template', 'invalid', 'not-a-url'],
  ])(
    'blocks collection when a required shared %s image has an %s source URL',
    (role, _label, sourceUrl) => {
      const manager = buildManager();
      const badImage = imageArtifact(role, sourceUrl);
      const artifacts =
        role === 'reference'
          ? { reference: [badImage], template: [] }
          : { reference: [], template: [badImage] };
      const assignment = {
        assignmentDefinition: {
          tasks: {
            task_one: {
              id: 'task-one',
              artifacts,
              taskTitle: 'Task One',
            },
          },
          referenceDocumentId: 'ref-doc',
          templateDocumentId: 'tpl-doc',
        },
        submissions: [],
      };
      expect(() => manager.collectAllImageArtifacts(assignment)).toThrow();
    }
  );

  it('blocks collection when a required shared template image has no owning document id', () => {
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
    expect(() => manager.collectAllImageArtifacts(assignment)).toThrow();
  });

  it('collects valid submission images and materialises the hydration error for an invalid submission URL', () => {
    const manager = buildManager();
    const good = new globalThis.StudentSubmissionItem({
      taskId: 'task-good',
      artifact: ArtifactFactory.image({
        type: 'image',
        taskId: 'task-good',
        role: 'submission',
        metadata: { sourceUrl: 'https://example.com/student.png' },
        taskIndex: 0,
        artifactIndex: 0,
      }),
    });
    const bad = new globalThis.StudentSubmissionItem({
      taskId: 'task-bad',
      artifact: ArtifactFactory.image({
        type: 'image',
        taskId: 'task-bad',
        role: 'submission',
        metadata: { sourceUrl: 'invalid-url' },
        taskIndex: 0,
        artifactIndex: 0,
      }),
    });
    const text = new globalThis.StudentSubmissionItem({
      taskId: 'task-text',
      artifact: ArtifactFactory.text({
        type: 'text',
        taskId: 'task-text',
        role: 'submission',
        content: 'hello',
        taskIndex: 0,
        artifactIndex: 0,
      }),
    });
    const assignment = {
      assignmentDefinition: { tasks: {}, referenceDocumentId: 'ref', templateDocumentId: 'tpl' },
      submissions: [
        { documentId: null, items: {} },
        { documentId: 'student-doc', items: {} },
        {
          documentId: 'student-doc',
          items: {
            task_good: good,
            task_bad: bad,
            task_text: text,
            missing: { taskId: 'task-missing', id: 'item-missing' },
          },
        },
      ],
    };
    const entries = manager.collectAllImageArtifacts(assignment);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      scope: 'submission',
      documentId: 'student-doc',
      taskId: 'task-good',
      itemId: good.id,
    });
    for (const criterion of ['completeness', 'accuracy', 'spag']) {
      expect(bad.getAssessment(criterion)).toMatchObject({
        score: 'E',
        reasoning: 'The submitted slide image could not be loaded.',
        error: { stage: 'extraction', code: 'IMAGE_HYDRATION_FAILED' },
      });
    }
    expect(bad.artifact.content).toBeNull();
    expect(bad.artifact.contentHash).toBeNull();
    expect(text.getAssessment()).toEqual({});
  });
});

describe('ImageManager required source URL outcomes', () => {
  it.each([
    ['absent', undefined],
    ['invalid', 'not-a-url'],
  ])(
    'materialises the hydration error for a student image with an %s required source URL',
    (_label, sourceUrl) => {
      const { assignment, item } = createAssignment('IMAGE');
      // Local pending-hydration mutation of the cloned canonical IMAGE item.
      item.artifact.content = null;
      item.artifact.contentHash = null;
      item.artifact.metadata = { sourceUrl };
      const channels = { info: [], warn: [], error: [], debug: [], debugUi: [] };
      const progress = { logError: [] };
      const observedLogger = {
        info: (...args) => channels.info.push(args),
        warn: (...args) => channels.warn.push(args),
        error: (...args) => channels.error.push(args),
        debug: (...args) => channels.debug.push(args),
        debugUi: (...args) => channels.debugUi.push(args),
      };
      const observedTracker = {
        logError: (...args) => progress.logError.push(args),
      };
      // Observed singletons must be installed before manager construction:
      // the manager constructors retain their own logger/tracker references.
      const mockContext = withGlobalMocks({
        ABLogger: () => ({ getInstance: () => observedLogger }),
        ProgressTracker: () => ({ getInstance: () => observedTracker }),
      });
      try {
        const manager = buildManager();
        // Bind the constructor-retained channels to the same observed objects.
        manager.logger = observedLogger;
        manager.progressTracker = observedTracker;
        const entries = manager.collectAllImageArtifacts(assignment);
        expect(entries).toEqual([]);
        for (const criterion of ['completeness', 'accuracy', 'spag']) {
          expect(item.getAssessment(criterion)).toMatchObject({
            score: 'E',
            reasoning: 'The submitted slide image could not be loaded.',
            error: { stage: 'extraction', code: 'IMAGE_HYDRATION_FAILED' },
          });
        }
        expect(item.artifact.content).toBeNull();
        expect(item.artifact.contentHash).toBeNull();
        // Exactly one owned contextual diagnostic on the developer warn
        // channel: opaque UID, task and scope. No other ABLogger channel and
        // no user-facing ProgressTracker error may fire for this converted
        // item failure — the real validator stays in place, so its raw-URL
        // progress leak must not appear on any observed channel either.
        expect(channels.warn).toHaveLength(1);
        expect(channels.warn[0][1]).toMatchObject({
          uid: item.artifact.getUid(),
          taskId: item.taskId,
          scope: 'submission',
        });
        const observed = JSON.stringify({ channels, progress });
        expect(observed).not.toContain('"sourceUrl"');
        expect(observed).not.toContain(sourceUrl ?? 'not-a-url');
        expect(channels.info).toEqual([]);
        expect(channels.error).toEqual([]);
        expect(channels.debug).toEqual([]);
        expect(channels.debugUi).toEqual([]);
        expect(progress.logError).toEqual([]);
      } finally {
        mockContext.restore();
      }
    }
  );
});
