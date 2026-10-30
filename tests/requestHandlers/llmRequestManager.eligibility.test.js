import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { createRunStopAssignment } from '../helpers/llmRunStopHarness.js';
import {
  VALID_RESULT_DATA,
  createAssignment,
  loadManager,
  observeLookup,
  validHttpResponse,
  withCacheManager,
} from '../helpers/llmRequestManagerHarness.js';

describe('LLMRequestManager eligibility outcomes', () => {
  // Approved hash invariant (user decision): stored content requires a usable
  // contentHash; paired unusable hashes fail loudly pre-lookup, never template N.
  it.each([
    ['null', null],
    ['empty string', ''],
  ])(
    'fails generation loudly for paired unusable %s template/student hashes without false N or live marking',
    (_label, unusableValue) => {
      const fetchAll = vi.fn(() => []);
      const fetch = vi.fn();
      const sleep = vi.fn();
      const context = loadManager({ fetchAll, fetch, sleep });
      try {
        withTemporaryGlobals(context.globals, () => {
          delete require.cache[context.llmPath];
          const Manager = require(context.llmPath);
          const manager = new Manager();
          const { assignment, task, item } = createAssignment('TEXT');
          task.getPrimaryTemplate().contentHash = unusableValue;
          item.artifact.contentHash = unusableValue;
          const artefactSnapshot = structuredClone(item.artifact.toJSON());
          const documentId = assignment.submissions[0].documentId;
          // Fail-loudly invariant Red: current null===null N mutation instead.
          let caught = null;
          try {
            manager.generateRequestObjects(assignment);
          } catch (error) {
            caught = error;
          }
          expect(caught).toBeInstanceOf(Error);
          expect(caught.message.toLowerCase()).toContain('hash');
          expect(caught.message.length).toBeGreaterThan('hash'.length);
          // No false N, no cache lookup/write, no HTTP dispatch, source retained.
          expect(item.getAssessment()).toEqual({});
          expect(item.artifact.toJSON()).toEqual(artefactSnapshot);
          expect(item.taskId).toBe(task.getId());
          expect(assignment.submissions[0].documentId).toBe(documentId);
          expect(context.scriptCache.get).not.toHaveBeenCalled();
          expect(context.scriptCache.put).not.toHaveBeenCalled();
          expect(fetchAll).not.toHaveBeenCalled();
          expect(fetch).not.toHaveBeenCalled();
          expect(sleep).not.toHaveBeenCalled();
        });
      } finally {
        context.restore();
      }
    }
  );

  it('classifies matching non-empty hashes as template N without changing the source', () => {
    const context = loadManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const Manager = require(context.llmPath);
        const manager = new Manager();
        const { assignment, task, item } = createAssignment('TEXT');
        const originalContent = item.artifact.content;
        const matchingHash = task.getPrimaryTemplate().contentHash;
        expect(matchingHash).toEqual(expect.any(String));
        expect(matchingHash.length).toBeGreaterThan(0);
        item.artifact.contentHash = matchingHash;
        const originalHash = item.artifact.contentHash;
        const originalUid = item.artifact.getUid();
        const originalTaskId = item.taskId;
        const originalArtefact = item.artifact;
        const artefactSnapshot = structuredClone(originalArtefact.toJSON());
        const originalDocumentId = assignment.submissions[0].documentId;

        expect(manager.generateRequestObjects(assignment)).toEqual([]);
        expect(item.artifact).toBe(originalArtefact);
        expect(item.artifact.content).toBe(originalContent);
        expect(item.artifact.contentHash).toBe(matchingHash);
        expect(item.artifact.contentHash).toBe(originalHash);
        expect(item.artifact.getUid()).toBe(originalUid);
        expect(item.taskId).toBe(originalTaskId);
        expect(item.artifact.toJSON()).toEqual(artefactSnapshot);
        expect(assignment.submissions[0].documentId).toBe(originalDocumentId);
        expect(item.getAssessment()).toEqual({
          completeness: { score: 'N', reasoning: 'Task not attempted' },
          accuracy: { score: 'N', reasoning: 'Task not attempted' },
          spag: { score: 'N', reasoning: 'Task not attempted' },
        });
      });
    } finally {
      context.restore();
    }
  });

  it.each([
    ['substantive work', 'existing-content'],
    ['blank work', ''],
  ])('preserves prior E entries without dispatch for %s', (_label, content) => {
    const context = loadManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const Manager = require(context.llmPath);
        const manager = new Manager();
        const { assignment, task, item } = createAssignment('TEXT');
        item.artifact.content = content;
        item.artifact.ensureHash();
        if (content === '') {
          expect(item.artifact.contentHash).not.toBe(task.getPrimaryTemplate().contentHash);
        }
        item.setError('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
        const priorAssessments = item.getAssessment();
        const priorEntries = ['completeness', 'accuracy', 'spag'].map(
          (criterion) => priorAssessments[criterion]
        );
        const priorCauses = priorEntries.map(({ error }) => error);
        const expected = {
          completeness: {
            score: 'E',
            reasoning: 'No source content could be extracted for this task.',
            error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
          },
          accuracy: {
            score: 'E',
            reasoning: 'No source content could be extracted for this task.',
            error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
          },
          spag: {
            score: 'E',
            reasoning: 'No source content could be extracted for this task.',
            error: { stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' },
          },
        };
        const originalContent = item.artifact.content;
        const originalHash = item.artifact.contentHash;
        const originalUid = item.artifact.getUid();
        const originalTaskId = item.taskId;
        const originalDocumentId = assignment.submissions[0].documentId;
        const originalPageId = item.artifact.pageId;
        const originalArtefact = item.artifact;
        const artefactSnapshot = structuredClone(originalArtefact.toJSON());

        expect(manager.generateRequestObjects(assignment)).toEqual([]);
        expect(item.getAssessment()).toEqual(expected);
        ['completeness', 'accuracy', 'spag'].forEach((criterion, index) => {
          expect(item.getAssessment(criterion)).toBe(priorEntries[index]);
          expect(item.getAssessment(criterion).error).toBe(priorCauses[index]);
        });
        expect(item.artifact).toBe(originalArtefact);
        expect(item.artifact.content).toBe(originalContent);
        expect(item.artifact.contentHash).toBe(originalHash);
        expect(item.artifact.getUid()).toBe(originalUid);
        expect(item.taskId).toBe(originalTaskId);
        expect(assignment.submissions[0].documentId).toBe(originalDocumentId);
        expect(item.artifact.pageId).toBe(originalPageId);
        expect(item.artifact.toJSON()).toEqual(artefactSnapshot);
      });
    } finally {
      context.restore();
    }
  });

  it('does not generate LLM requests for spreadsheet items', () => {
    const context = loadManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const Manager = require(context.llmPath);
        const manager = new Manager();
        const { assignment, task, item } = createAssignment('SPREADSHEET');
        const submission = assignment.submissions[0];
        const artefact = item.artifact;
        const artefactSnapshot = structuredClone(artefact.toJSON());
        const sourceIdentity = {
          documentId: submission.documentId,
          pageId: artefact.pageId,
          artefactUid: artefact.getUid(),
          itemId: item.taskId,
        };
        expect(item.taskId).toBe(task.getId());
        expect(submission.items[task.getId()]).toBe(item);
        const originalContent = structuredClone(item.artifact.content);
        const originalHash = item.artifact.contentHash;
        const originalAssessments = structuredClone(item.getAssessment());

        expect(item.getType()).toBe('SPREADSHEET');
        expect(item.artifact.getType()).toBe('SPREADSHEET');
        expect(Array.isArray(item.artifact.content)).toBe(true);
        expect(item.artifact.contentHash).toBeTruthy();
        expect(task.getPrimaryReference().getType()).toBe('SPREADSHEET');
        expect(task.getPrimaryTemplate().getType()).toBe('SPREADSHEET');
        expect(Array.isArray(task.getPrimaryTemplate().content)).toBe(true);
        expect(task.getPrimaryTemplate().contentHash).toBeTruthy();

        expect(manager.generateRequestObjects(assignment)).toEqual([]);
        expect(item.artifact).toBe(artefact);
        expect(item.artifact.content).toEqual(originalContent);
        expect(item.artifact.contentHash).toBe(originalHash);
        expect(item.getAssessment()).toEqual(originalAssessments);
        expect(item.artifact.toJSON()).toEqual(artefactSnapshot);
        expect({
          documentId: submission.documentId,
          pageId: item.artifact.pageId,
          artefactUid: item.artifact.getUid(),
          itemId: item.taskId,
        }).toEqual(sourceIdentity);
      });
    } finally {
      context.restore();
    }
  });

  it('keeps successfully extracted blank work as not attempted', () => {
    const context = loadManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const Manager = require(context.llmPath);
        const manager = new Manager();
        const { assignment, task, item } = createAssignment('TEXT');
        item.artifact.content = '';
        item.artifact.ensureHash();
        const originalHash = item.artifact.contentHash;
        const originalUid = item.artifact.getUid();
        const originalTaskId = item.taskId;
        const originalDocumentId = assignment.submissions[0].documentId;
        const originalPageId = item.artifact.pageId;
        const originalArtefact = item.artifact;
        const artefactSnapshot = structuredClone(originalArtefact.toJSON());
        expect(originalHash).toEqual(expect.any(String));
        expect(originalHash.length).toBeGreaterThan(0);
        expect(originalHash).not.toBe(task.getPrimaryTemplate().contentHash);

        expect(manager.generateRequestObjects(assignment)).toEqual([]);
        expect(item.getAssessment()).toEqual({
          completeness: { score: 'N', reasoning: 'Task not attempted' },
          accuracy: { score: 'N', reasoning: 'Task not attempted' },
          spag: { score: 'N', reasoning: 'Task not attempted' },
        });
        expect(item.artifact.content).toBe('');
        expect(item.artifact.contentHash).toBe(originalHash);
        expect(item.artifact.getUid()).toBe(originalUid);
        expect(item.taskId).toBe(originalTaskId);
        expect(assignment.submissions[0].documentId).toBe(originalDocumentId);
        expect(item.artifact.pageId).toBe(originalPageId);
        expect(item.artifact).toBe(originalArtefact);
        expect(item.artifact.toJSON()).toEqual(artefactSnapshot);
      });
    } finally {
      context.restore();
    }
  });
});

describe('LLMRequestManager generated-route UID guards', () => {
  it('fails generation loudly when two eligible items produce the same request UID', () => {
    const fetchAll = vi.fn();
    const fetch = vi.fn();
    const sleep = vi.fn();
    const context = loadManager({ fetchAll, fetch, sleep });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const manager = new (require(context.llmPath))();
        const fixture = createRunStopAssignment('medium', 3);
        const [first, second] = fixture.numeric;
        expect(first.item).not.toBe(second.item);
        expect(first.item.taskId).toBe(first.task.getId());
        expect(second.item.taskId).toBe(second.task.getId());
        expect(first.submission.items[first.item.taskId]).toBe(first.item);
        expect(second.submission.items[second.item.taskId]).toBe(second.item);
        const firstUid = first.item.artifact.getUid();
        const secondUid = second.item.artifact.getUid();
        expect(secondUid).not.toBe(firstUid);
        expect(first.item.artifact.contentHash).not.toBe(
          first.task.getPrimaryTemplate().contentHash
        );
        expect(second.item.artifact.contentHash).not.toBe(
          second.task.getPrimaryTemplate().contentHash
        );
        expect(first.item.artifact.content).not.toBe(second.item.artifact.content);
        const firstSnapshot = structuredClone(first.item.artifact.toJSON());
        const secondSnapshot = structuredClone(second.item.artifact.toJSON());
        const firstVisited = vi.spyOn(first.item.artifact, 'getUid');
        const duplicateUidSource = vi
          .spyOn(second.item.artifact, 'getUid')
          .mockImplementation(() => firstUid);
        let caught = null;
        try {
          manager.generateRequestObjects(fixture.assignment);
        } catch (error) {
          caught = error;
        }
        expect(firstVisited).toHaveBeenCalled();
        expect(duplicateUidSource).toHaveBeenCalled();
        expect(caught).toBeInstanceOf(Error);
        expect(caught.message).toContain(firstUid);
        expect(fetchAll).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(sleep).not.toHaveBeenCalled();
        expect(first.item.getAssessment()).toEqual({});
        expect(second.item.getAssessment()).toEqual({});
        expect(context.scriptCache.put).not.toHaveBeenCalled();
        expect(first.item.artifact.toJSON()).toEqual(firstSnapshot);
        expect(second.item.artifact.toJSON()).toEqual(secondSnapshot);
      });
    } finally {
      vi.restoreAllMocks();
      context.restore();
    }
  });

  it('fails processing loudly for a request UID absent from the generated route map', () => {
    const fetchSingle = vi.fn();
    const sleep = vi.fn();
    const fetchAll = vi.fn((nativeRequests) => {
      expect(nativeRequests).toHaveLength(1);
      return [validHttpResponse()];
    });
    withCacheManager({ fetchAll, fetch: fetchSingle, sleep }, (bound) => {
      const { manager, scriptCache } = bound;
      const { assignment, item, task } = createAssignment('TEXT');
      const requests = manager.generateRequestObjects(assignment);
      expect(requests).toHaveLength(1);
      const generatedUid = requests[0].uid;
      expect(generatedUid).toBe(item.artifact.getUid());
      expect(item.taskId).toBe(task.getId());
      expect(manager.uidIndex[generatedUid].item).toBe(item);
      const unknownUid = 'unknown-never-generated-uid';
      expect(manager.uidIndex[unknownUid]).toBeUndefined();
      const unknownRequest = { ...requests[0], uid: unknownUid };
      expect(unknownRequest.uid).toBe(unknownUid);
      expect(unknownRequest.payload).toBe(requests[0].payload);
      const artefactSnapshot = structuredClone(item.artifact.toJSON());
      const documentId = assignment.submissions[0].documentId;
      const mutation = vi.spyOn(item, 'addAssessment');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      let caught = null;
      try {
        manager.processStudentResponses([unknownRequest], assignment);
      } catch (error) {
        caught = error;
      }
      expect(mutation).not.toHaveBeenCalled();
      expect(item.getAssessment()).toEqual({});
      expect(scriptCache.put).not.toHaveBeenCalled();
      expect(fetchSingle).not.toHaveBeenCalled();
      expect(sleep).not.toHaveBeenCalled();
      expect(item.artifact.toJSON()).toEqual(artefactSnapshot);
      expect(assignment.submissions[0].documentId).toBe(documentId);
      expect(caught).toBeInstanceOf(Error);
      expect(caught.message).toContain(unknownUid);
      expect(caught.message.length).toBeGreaterThan(unknownUid.length);
    });
  });

  it('rejects duplicate request UIDs in processing before dispatch, mutation and cache writes', () => {
    const fetchAll = vi.fn();
    const fetch = vi.fn();
    const sleep = vi.fn();
    const context = loadManager({ fetchAll, fetch, sleep });
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const manager = new (require(context.llmPath))();
        const { assignment, item } = createAssignment('TEXT');
        const requests = manager.generateRequestObjects(assignment);
        expect(requests).toHaveLength(1);
        const requestUid = requests[0].uid;
        expect(requestUid).toBe(item.artifact.getUid());
        const duplicateRequest = { ...requests[0] };
        expect(duplicateRequest).not.toBe(requests[0]);
        expect(duplicateRequest.uid).toBe(requestUid);
        const artefactSnapshot = structuredClone(item.artifact.toJSON());
        const documentId = assignment.submissions[0].documentId;
        const mutation = vi.spyOn(item, 'addAssessment');
        let caught = null;
        try {
          manager.processStudentResponses([requests[0], duplicateRequest], assignment);
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(Error);
        expect(caught.message).toContain(requestUid);
        expect(caught.message.toLowerCase()).toContain('duplicate');
        expect(fetchAll).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(sleep).not.toHaveBeenCalled();
        expect(mutation).not.toHaveBeenCalled();
        expect(item.getAssessment()).toEqual({});
        expect(context.scriptCache.put).not.toHaveBeenCalled();
        expect(item.artifact.toJSON()).toEqual(artefactSnapshot);
        expect(assignment.submissions[0].documentId).toBe(documentId);
      });
    } finally {
      vi.restoreAllMocks();
      context.restore();
    }
  });
});

const CACHE_USABLE_HASH_ROWS = [
  ['template', 'null', null],
  ['template', 'empty string', ''],
  ['student', 'null', null],
  ['student', 'empty string', ''],
  ['reference', 'null', null],
  ['reference', 'empty string', ''],
];

/** Applies one deliberate unusable-hash boundary mutation and captures the post-mutation source. */
function mutateUnusableHash(fixture, component, unusableValue) {
  if (component === 'template') fixture.task.getPrimaryTemplate().contentHash = unusableValue;
  else if (component === 'student') fixture.item.artifact.contentHash = unusableValue;
  else fixture.task.getPrimaryReference().contentHash = unusableValue;
  return structuredClone(fixture.item.artifact.toJSON());
}

/**
 * Usable-hash cache eligibility case. One real cold valid dispatch writes the
 * canonical numeric result into THIS native cache context (an existing numeric
 * entry must never certify a malformed identity); its history is cleared and
 * the tested warm run mutates one hash of a fresh identical model under a
 * fresh real manager, requiring a loud pre-lookup generation failure.
 */
function runUsableHashCacheCase(component, unusableValue) {
  const natives = {
    fetchAll: vi.fn(() => [validHttpResponse()]),
    fetch: vi.fn(),
    sleep: vi.fn(),
  };
  return withCacheManager(natives, (collected) => {
    // COLD: real processing produces the validated numeric write in this context.
    const cold = createAssignment('TEXT');
    const coldLookup = observeLookup(collected, cold.assignment);
    expect(coldLookup.requests).toHaveLength(1);
    expect(coldLookup.keys).toHaveLength(1);
    collected.manager.processStudentResponses(coldLookup.requests, cold.assignment);
    expect(cold.item.getAssessment()).toEqual(VALID_RESULT_DATA);
    expect(collected.scriptCache.put).toHaveBeenCalledTimes(1);
    expect(typeof collected.scriptCache.put.mock.calls[0][1]).toBe('string');
    // Reset the cold setup's history so the tested phase measures itself.
    natives.fetchAll.mockClear();
    collected.scriptCache.get.mockClear();
    collected.scriptCache.put.mockClear();
    // WARM: fresh real manager and fresh identical model with one boundary mutation.
    const warmManager = new collected.manager.constructor();
    expect(warmManager).not.toBe(collected.manager);
    const warm = createAssignment('TEXT');
    const artefact = warm.item.artifact;
    [
      warm.task.getPrimaryTemplate().contentHash,
      warm.task.getPrimaryReference().contentHash,
      artefact.contentHash,
    ].forEach((hash) => {
      expect(typeof hash === 'string' && hash.length > 0).toBe(true);
    });
    const mutatedSnapshot = mutateUnusableHash(warm, component, unusableValue);
    const documentId = warm.assignment.submissions[0].documentId;
    // Fail-loudly invariant Red: current silent hit/dispatch path instead.
    let caught = null;
    try {
      warmManager.generateRequestObjects(warm.assignment);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message.toLowerCase()).toContain(component);
    expect(caught.message.toLowerCase()).toContain('hash');
    // No cache lookup/write, no HTTP dispatch and no false not-attempted mark.
    expect(collected.scriptCache.get).not.toHaveBeenCalled();
    expect(collected.scriptCache.put).not.toHaveBeenCalled();
    expect(natives.fetchAll).not.toHaveBeenCalled();
    expect(natives.fetch).not.toHaveBeenCalled();
    expect(natives.sleep).not.toHaveBeenCalled();
    expect(warm.item.getAssessment()).toEqual({});
    expect(artefact).toBe(warm.item.artifact);
    expect(artefact.toJSON()).toEqual(mutatedSnapshot);
    expect(warm.item.taskId).toBe(warm.task.getId());
    expect(warm.assignment.submissions[0].documentId).toBe(documentId);
  });
}

describe('LLM usable-hash cache eligibility', () => {
  it.each(CACHE_USABLE_HASH_ROWS)(
    'fails generation loudly for an unusable %s hash (%s) as a stored-content invariant fault',
    (component, unusableLabel, unusableValue) => {
      runUsableHashCacheCase(component, unusableValue);
    }
  );
});
