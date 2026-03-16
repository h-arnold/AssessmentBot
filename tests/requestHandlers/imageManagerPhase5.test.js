import { describe, it, expect, beforeEach } from 'vitest';

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

globalThis.BaseRequestManager = DummyBaseRequestManager;

// Import artifacts & ImageManager
const { ArtifactFactory } = require('../../src/AdminSheet/Models/Artifacts/index.js');
const ImageManager = require('../../src/AdminSheet/RequestHandlers/ImageManager.js');

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
