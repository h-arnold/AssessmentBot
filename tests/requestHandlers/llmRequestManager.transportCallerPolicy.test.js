import { describe, it, expect, vi } from 'vitest';
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';
import { createMockUtils } from '../helpers/mockFactories.js';
const { createTextTask, createSlidesAssignment } = require('../helpers/modelFactories.js');
const { Validate } = require('#backend/Utils/Validate.js');

const STOP_CRITERIA = ['completeness', 'accuracy', 'spag'];
const RUN_STOPPED_REASONING =
  'Assessment stopped because the service credentials or endpoint were rejected.';

/** Exact canonical all-three LLM_RUN_STOPPED JSON required from every reconciled stop row. */
function canonicalRunStoppedAssessments() {
  return Object.fromEntries(
    STOP_CRITERIA.map((criterion) => [
      criterion,
      {
        score: 'E',
        reasoning: RUN_STOPPED_REASONING,
        error: { stage: 'assessment', code: 'LLM_RUN_STOPPED' },
      },
    ])
  );
}

describe('LLM transport caller policy', () => {
  function createProgressTracker() {
    return {
      updateProgress: vi.fn(),
      getCurrentProgress: () => ({ message: 'Assessing' }),
      logError: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
  }

  function loadManager({ fetchAll, fetch, tracker, batchSize, sleep, utils }) {
    const basePath = require.resolve('#backend/RequestHandlers/BaseRequestManager.js');
    const llmPath = require.resolve('#backend/RequestHandlers/LLMRequestManager.js');
    const previousLlmModule = require.cache[llmPath];
    const BaseRequestManager = require(basePath);
    const scriptCache = { get: vi.fn(() => null), put: vi.fn() };
    const restore = () => {
      delete require.cache[llmPath];
      if (previousLlmModule) require.cache[llmPath] = previousLlmModule;
    };
    const globals = {
      BaseRequestManager: () => BaseRequestManager,
      ConfigurationManager: () => ({
        getInstance: () => ({
          getBackendUrl: () => 'https://llm.test',
          getApiKey: () => 'key',
          getBackendAssessorBatchSize: () => batchSize,
        }),
      }),
      CacheService: () => ({ getScriptCache: () => scriptCache }),
      ProgressTracker: () => ({ getInstance: () => tracker }),
      ABLogger: () => ({ getInstance: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }),
      UrlFetchApp: () => ({ fetchAll, fetch }),
      Utilities: () => ({ sleep }),
      Utils: () => utils,
      Validate: () => Validate,
    };
    return { BaseRequestManager, llmPath, restore, globals, scriptCache };
  }

  const validBody = JSON.stringify({
    completeness: { score: 4, reasoning: 'valid' },
    accuracy: { score: 3, reasoning: 'valid' },
    spag: { score: 2, reasoning: 'valid' },
  });

  /**
   * Builds the real request graph for a stop row. The first submission carries one
   * item per task; those are the phase-1 seeds (one parallel round). A second
   * submission adds one extra item for the first task, which becomes the sole
   * phase-2 remainder and is never dispatched once the phase-1 stop latches.
   */
  function createModelRequests(manager) {
    const assignment = createSlidesAssignment({
      courseId: 'course-stop',
      assignmentId: 'assignment-stop',
      referenceDocumentId: 'reference-stop',
      templateDocumentId: 'template-stop',
      assignmentName: 'Stop response test',
    });
    const tasks = {};
    [1, 2, 3].forEach((index) => {
      const task = createTextTask(index, `Reference ${index}`, `Template ${index}`);
      tasks[task.getId()] = task;
    });
    assignment.setTasks(tasks);
    const taskList = Object.values(tasks);
    const submission = assignment.addStudent({ id: 'student-stop', name: 'Student' });
    submission.documentId = 'document-stop';
    taskList.forEach((task, index) => {
      submission.upsertItemFromExtraction(task, { content: `Response ${index}` });
    });
    const laterSubmission = assignment.addStudent({ id: 'student-later', name: 'Later Student' });
    laterSubmission.documentId = 'document-later';
    laterSubmission.upsertItemFromExtraction(taskList[0], { content: 'Response later' });
    const requests = manager.generateRequestObjects(assignment);
    return { assignment, requests };
  }

  /**
   * Captures the retained source identity for every generated stop-row request
   * before processing, so later terminal expectations can prove artefact
   * identity, detached full snapshots and each request's parent document ID are
   * preserved. The parent comes from the request's own route entry, so each
   * track records the submission that produced it.
   */
  function captureStopRowSources(manager, requests) {
    return requests.map((request) => {
      const route = manager.uidIndex[request.uid];
      const item = route.item;
      return {
        request,
        item,
        artefact: item.artifact,
        artefactSnapshot: structuredClone(item.artifact.toJSON()),
        documentId: route.submission.documentId,
      };
    });
  }

  it.each(['INITIAL', 'RETRY'].flatMap((mode) => [401, 403, 404].map((status) => [mode, status])))(
    'stops subsequent dispatch in %s mode on HTTP %i after a valid sibling is applied',
    (mode, stopStatus) => {
      const events = [];
      const tracker = createProgressTracker();
      const response = (status, body) => ({
        getResponseCode: () => status,
        getContentText: vi.fn(() => body),
      });
      const nativeValidResponse = response(200, validBody);
      const invalidResponse = response(200, '{}');
      const firstBatchResponse = response(mode === 'INITIAL' ? stopStatus : 500, '{}');
      // Three phase-1 seeds: stop target, invalid sibling and valid sibling.
      const batchResponses = [firstBatchResponse, invalidResponse, nativeValidResponse];
      const fetchAll = vi.fn((requests) => {
        events.push(`fetchAll:${requests.map(({ url }) => url).join(',')}`);
        if (requests.length === batchResponses.length) return batchResponses;
        return requests.map(() => response(200, validBody));
      });
      const fetchedStopResponse = response(stopStatus, '{}');
      const fetch = vi.fn((url) => {
        events.push(`fetch:${url}`);
        return fetchedStopResponse;
      });
      const sleep = vi.fn();
      const context = loadManager({
        fetchAll,
        fetch,
        tracker,
        batchSize: 3,
        sleep,
        utils: createMockUtils(vi),
      });
      try {
        withTemporaryGlobals(context.globals, () => {
          delete require.cache[context.llmPath];
          const manager = new (require(context.llmPath))();
          manager.progressTracker = tracker;
          manager.configManager = {
            getBackendUrl: () => 'https://llm.test',
            getApiKey: () => 'key',
            getBackendAssessorBatchSize: () => 3,
          };
          const { assignment, requests } = createModelRequests(manager);
          expect(requests).toHaveLength(4);
          expect(new Set(requests.map(({ uid }) => uid)).size).toBe(4);
          expect(manager.configManager.getBackendAssessorBatchSize()).toBe(3);
          const validRequest = requests[2];
          const validation = vi.spyOn(manager, 'validateAssessmentData');
          const processResponse = manager._processSingleResponse.bind(manager);
          // Routed native identity proofs (executed passes under both the
          // current and the reconciled contract): each received outcome reaches
          // _processSingleResponse with its exact original response object.
          const routedStopResponse = mode === 'INITIAL' ? firstBatchResponse : fetchedStopResponse;
          const validProcessing = vi
            .spyOn(manager, '_processSingleResponse')
            .mockImplementation((nativeResponse, request, attempts) => {
              if (request === validRequest) expect(nativeResponse).toBe(nativeValidResponse);
              if (request === requests[0]) expect(nativeResponse).toBe(routedStopResponse);
              if (request === requests[1]) expect(nativeResponse).toBe(invalidResponse);
              return processResponse(nativeResponse, request, attempts);
            });
          requests.forEach((request, index) => {
            request.url = `https://llm.test/${['stop', 'invalid', 'valid', 'later'][index]}`;
          });
          const sourceTracks = captureStopRowSources(manager, requests);
          let caught = null;
          try {
            manager.processStudentResponses(requests, assignment);
          } catch (error) {
            caught = error;
          }
          // No stop row ever reads the stop/initial-server body — an executed
          // pass before the stop-domain assertions in every row.
          expect(firstBatchResponse.getContentText).not.toHaveBeenCalled();
          expect(fetchedStopResponse.getContentText).not.toHaveBeenCalled();
          // The stop is handled as domain completion-with-errors: the process
          // returns normally, the valid seed is applied and the remainder is
          // terminalised without a phase-2 dispatch.
          expect(caught).toBe(null);
          expect(validProcessing).toHaveBeenCalledWith(nativeValidResponse, validRequest, 1);
          expect(validation).toHaveBeenCalledWith({});
          expect(validation.mock.results[0].value).toBe(false);
          expect(context.scriptCache.get).toHaveBeenCalled();
          expect(context.scriptCache.put).toHaveBeenCalled();
          const validItem = manager.uidIndex[validRequest.uid].item;
          expect(validItem.assessments).toMatchObject({
            completeness: { score: 4, reasoning: 'valid' },
            accuracy: { score: 3, reasoning: 'valid' },
            spag: { score: 2, reasoning: 'valid' },
          });
          expect({
            fetchAllCalls: fetchAll.mock.calls.length,
            fetchCalls: fetch.mock.calls.length,
          }).toEqual({
            fetchAllCalls: 1,
            fetchCalls: mode === 'INITIAL' ? 0 : 1,
          });
          expect(sleep.mock.calls).toEqual(mode === 'RETRY' ? [[5000]] : []);
          expect(events[0]).toBe(
            'fetchAll:https://llm.test/stop,https://llm.test/invalid,https://llm.test/valid'
          );
          expect(events).not.toContain('fetchAll:https://llm.test/later');
          expect(events).not.toContain('fetch:https://llm.test/later');
          expect(batchResponses).toHaveLength(3);
          // The phase-1 stop target (requests[0]) and the never-dispatched
          // remainder (requests[3]) must each terminalise with the canonical
          // LLM_RUN_STOPPED map while their sources are preserved.
          const canonical = canonicalRunStoppedAssessments();
          [sourceTracks[0], sourceTracks[3]].forEach((track) => {
            expect(track.item.artifact).toBe(track.artefact);
            expect(track.item.artifact.toJSON()).toEqual(track.artefactSnapshot);
            expect(track.item.getAssessment()).toEqual(canonical);
          });
          expect(assignment.submissions[0].documentId).toBe(sourceTracks[0].documentId);
        });
      } finally {
        vi.restoreAllMocks();
        context.restore();
      }
    }
  );

  it('validates missing public LLM assignment before native dispatch', () => {
    const tracker = createProgressTracker();
    const fetchAll = vi.fn((requests) =>
      requests.map(() => ({ getResponseCode: () => 200, getContentText: () => '{}' }))
    );
    const fetch = vi.fn();
    const context = loadManager({
      fetchAll,
      fetch,
      tracker,
      batchSize: 2,
      sleep: vi.fn(),
      utils: createMockUtils(vi),
    });
    const validation = vi.spyOn(Validate, 'requireParams');
    try {
      withTemporaryGlobals(context.globals, () => {
        delete require.cache[context.llmPath];
        const manager = new (require(context.llmPath))();
        manager.configManager = { getBackendAssessorBatchSize: () => 2 };
        expect(() => manager.processStudentResponses([], undefined)).not.toThrow();
        expect(fetchAll).not.toHaveBeenCalled();
        let thrown;
        try {
          manager.processStudentResponses(
            [{ uid: 'missing-assignment', url: 'https://llm.test/missing-assignment' }],
            undefined
          );
        } catch (error) {
          thrown = error;
        }
        expect(
          validation.mock.calls.some(
            ([parameters, contextName]) =>
              Object.hasOwn(parameters, 'assignment') &&
              parameters.assignment === undefined &&
              contextName.includes('processStudentResponses')
          )
        ).toBe(true);
        expect(thrown).toBeInstanceOf(Error);
        expect({
          fetchAllCalls: fetchAll.mock.calls.length,
          fetchCalls: fetch.mock.calls.length,
        }).toEqual({
          fetchAllCalls: 0,
          fetchCalls: 0,
        });
        expect(() => manager.processStudentResponses([], undefined)).not.toThrow();
        expect(fetchAll).not.toHaveBeenCalled();
      });
    } finally {
      validation.mockRestore();
      context.restore();
    }
  });
});
