/**
 * Connected run-completion coverage for AssignmentController.processSelectedAssignment.
 *
 * Drives the real controller orchestration, real models and the real ABClassController
 * persistence chain (ABClassAssignmentOps + ABClassPersistence) over hermetic in-memory
 * collections seeded from canonical synthetic profiles. loadClass runs for real including
 * its roster refresh, backed by a ClassroomApiClient seam derived from the canonical class
 * document. The document-level pipeline stages (fetchSubmittedDocuments,
 * processAllSubmissions, processImages, assessResponses) are stubbed as no-ops on the
 * restored instance so the canonical completed state stands in for the parser/LLM stages;
 * the mixed-E outcomes are pre-established canonical records, not live dispatches.
 *
 * Proof limits: nothing here proves live GAS/Classroom/LLM service behaviour, durable
 * JsonDbApp persistence, deployed logging fidelity or real completion-time stamping
 * (stamping is the behaviour under test). The real-LLM-stop rows exercise the real
 * LLMRequestManager stop generation over hermetic native stubs and real canonical
 * models, not live network calls or GAS hosting; their seams are reported in place.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { ABClass } from '#backend/Models/ABClass.js';
import { Teacher } from '#backend/Models/Teacher.js';
import {
  saveGlobals,
  restoreGlobals,
  withTemporaryGlobals,
} from '#test-helpers/globalMockManager.js';
import { createRunStopAssignment } from '#test-helpers/llmRunStopHarness.js';
import {
  canonicalRunStoppedAssessments,
  loadManager,
  VALID_RESULT_DATA,
} from '#test-helpers/llmRequestManagerHarness.js';
import {
  countItems,
  createRun,
  narrowDefinitionTasks,
  wireRunAssignment,
  wireRunStores,
} from './assignmentRunCompletionTestHelpers.js';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');

const SUCCESS_MESSAGE = 'Assessment run completed successfully.';
const ERRORS_MESSAGE = 'Assessment run completed with errors.';

let progress;
let toast;
let savedGlobals;

/**
 * Builds one connected run: a canonical restored completed assignment whose result marker
 * is removed (so marker assertions can only be satisfied by completion-time stamping), the
 * canonical class restored through the real loadClass path, and the real persistence chain
 * over in-memory collections.
 */
function createCompletedRun(profileName, assignmentId, mutateRecord) {
  const inputs = loadBackendModelInputs(profileName);
  const record = structuredClone(inputs.assignmentsByKey[assignmentId]);
  const classDocument = structuredClone(inputs.classesById[record.courseId]);
  if (mutateRecord) mutateRecord(record);
  const db = wireRunStores(record.courseId, classDocument, record.assignmentDefinition);
  const assignment = Assignment.fromJSON(record, 'full');
  delete assignment.assessmentContractVersion;
  const stages = {};
  wireRunAssignment(assignment, stages);
  const run = createRun(assignment);
  return { record, db, stages, run, assignment };
}

function fullRecordOf(flow) {
  return flow.db.collections.get(`assign_full_${flow.record.courseId}_${flow.record.assignmentId}`)
    .docs[0];
}

function storedClassOf(flow) {
  return flow.db.collections.get(flow.record.courseId).docs[0];
}

describe('AssignmentController processSelectedAssignment run completion', () => {
  beforeEach(() => {
    savedGlobals = saveGlobals([
      'ProgressTracker',
      'Utils',
      'DriveManager',
      'DbManager',
      'AssignmentDefinitionController',
      'ABClassController',
      'ABClass',
      'ClassroomApiClient',
      'Teacher',
    ]);
    progress = {
      startTracking: vi.fn(),
      updateProgress: vi.fn(),
      complete: vi.fn(),
      logError: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
    globalThis.ProgressTracker = { getInstance: () => progress };
    toast = vi.fn();
    globalThis.Utils = { ...globalThis.Utils, toastMessage: toast };
    globalThis.Teacher = Teacher;
    globalThis.ABClass = ABClass;
    globalThis.ABClassController = ABClassController;
  });

  afterEach(() => {
    restoreGlobals(savedGlobals);
    vi.restoreAllMocks();
  });

  it('stamps assessmentContractVersion 1 on the persisted full record and the class-embedded partial of a fresh completed run', () => {
    const flow = createCompletedRun('small', 'assignment-0-1');
    expect(flow.assignment.assessmentContractVersion).toBeUndefined();
    flow.run();
    expect(fullRecordOf(flow).assessmentContractVersion).toBe(1);
    const embedded = storedClassOf(flow).assignments.find(
      (entry) => entry.assignmentId === flow.record.assignmentId
    );
    expect(embedded.assessmentContractVersion).toBe(1);
  });

  it('persists canonical medium mixed-E items beside numeric and N success through the real persistence chain', () => {
    const flow = createCompletedRun('medium', 'assignment-0-4');
    flow.run();
    const stored = fullRecordOf(flow);
    expect(countItems(stored, true)).toBe(4);
    expect(countItems(stored, false)).toBe(6);
  });

  it('reports the exact completion-with-errors message as the final progress update and toast', () => {
    const flow = createCompletedRun('medium', 'assignment-0-4');
    flow.run();
    const messages = progress.updateProgress.mock.calls.map((call) => call[0]);
    expect(messages.at(-1)).toBe(ERRORS_MESSAGE);
    expect(progress.complete).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toBe(ERRORS_MESSAGE);
  });

  it('reports the failed-task count as a separate progress detail before the exact final errors sentence', () => {
    const flow = createCompletedRun('medium', 'assignment-0-4');
    flow.run();
    const failed = countItems(fullRecordOf(flow), true);
    const messages = progress.updateProgress.mock.calls.map((call) => call[0]);
    expect(messages).toContain(`${failed} tasks failed.`);
    expect(messages.indexOf(`${failed} tasks failed.`)).toBeLessThan(messages.length - 1);
    expect(messages.at(-1)).toBe(ERRORS_MESSAGE);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toBe(ERRORS_MESSAGE);
  });

  it('keeps normal success feedback with zero failed items for a healthy run with genuine no-submissions', () => {
    const flow = createCompletedRun('small', 'assignment-0-1', (record) => {
      record.submissions = record.submissions.filter(
        (submission) =>
          !Object.values(submission.items).some((item) =>
            Object.values(item.assessments).some((entry) => entry.score === 'E')
          )
      );
    });
    flow.run();
    const stored = fullRecordOf(flow);
    expect(countItems(stored, true)).toBe(0);
    const noSubmissions = stored.submissions.filter((submission) => submission.documentId === null);
    expect(noSubmissions).toHaveLength(2);
    for (const submission of noSubmissions) expect(submission.items).toEqual({});
    const messages = progress.updateProgress.mock.calls.map((call) => call[0]);
    expect(messages.at(-1)).toBe(SUCCESS_MESSAGE);
    expect(toast.mock.calls[0]).toEqual([SUCCESS_MESSAGE, 'Success', 5]);
    expect(progress.logError).not.toHaveBeenCalled();
  });

  it('completes progress and shows the toast only after the final successful store save', () => {
    const flow = createCompletedRun('small', 'assignment-0-1');
    flow.run();
    const saveOrders = [...flow.db.collections.values()].flatMap(
      (collection) => collection.save.mock.invocationCallOrder
    );
    const lastSave = Math.max(...saveOrders);
    expect(progress.complete).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(progress.complete.mock.invocationCallOrder[0]).toBeGreaterThan(lastSave);
    expect(toast.mock.invocationCallOrder[0]).toBeGreaterThan(lastSave);
  });

  it('propagates a pipeline stage failure by identity without persisting or completing the run', () => {
    const flow = createCompletedRun('small', 'assignment-0-1');
    const fault = new Error('extractor stage fault');
    flow.stages.processAllSubmissions.mockImplementation(() => {
      throw fault;
    });
    const persistSpy = vi.spyOn(ABClassController.prototype, 'persistAssignmentRun');
    let caught;
    try {
      flow.run();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(fault);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(progress.complete).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(progress.logError).not.toHaveBeenCalled();
  });

  it('propagates a class-store save failure without false completion after the full record committed', () => {
    const flow = createCompletedRun('small', 'assignment-0-1');
    const fault = new Error('class collection save failed');
    flow.db.collections
      .get(flow.record.courseId)
      .save.mockImplementationOnce(() => {})
      .mockImplementation(() => {
        throw fault;
      });
    let caught;
    try {
      flow.run();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(fault);
    expect(fullRecordOf(flow)).toBeDefined();
    expect(progress.complete).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([
    ['earlier-batch', 1],
    ['same-batch', 2],
  ])(
    'persists real LLM_RUN_STOPPED maps beside the exact %s success (batch size %s) through the real completion chain',
    (_successKind, batchSize) => {
      const collected = createConnectedStopRun(batchSize);
      const stopped = collected.fixture.numeric.filter((entry) => entry.role !== 'healthy');
      const success = collected.fixture.numeric.find((entry) => entry.role === 'healthy');
      const signature = collected.fixture.signature;
      collected.run();
      expect(collected.stages.assessResponses).toHaveBeenCalledTimes(1);

      const stored = fullRecordOf(collected);
      const embedded = storedClassOf(collected).assignments.find(
        (entry) => entry.assignmentId === collected.assignment.assignmentId
      );
      for (const entry of stopped) {
        expect(persistedItemOf(stored, entry).assessments).toEqual(
          canonicalRunStoppedAssessments()
        );
        expect(persistedItemOf(embedded, entry).assessments).toEqual(
          canonicalRunStoppedAssessments()
        );
      }
      for (const [entry, body] of [
        [success, VALID_RESULT_DATA],
        [signature, signature.item.getAssessment()],
      ]) {
        expect(persistedItemOf(stored, entry).assessments).toEqual(body);
        expect(persistedItemOf(embedded, entry).assessments).toEqual(scoreOnly(body));
      }
      for (const entry of [...stopped, success]) {
        const item = persistedItemOf(stored, entry);
        expect(item.artifact.content).toBe(entry.artifactSnapshot.content);
        expect(item.artifact.contentHash).toBe(entry.artifactSnapshot.contentHash);
      }
      expectStopCompletionBoundaries(stored, embedded);
    }
  );
});

/**
 * Connected real-LLM-stop composition. The first step is real stop generation: the real
 * LLMRequestManager (real Base transport over native stubs, real cache seams) runs the
 * existing canonical run-stop fixture builder's medium model; the stopped E maps come
 * from the manager's own outcome routing, nothing is synthesised. The second step feeds
 * the stopped model into the real completion flow (its assess stage observed as a no-op),
 * with the model's definition task map narrowed to the pairs' one canonical task for
 * coverage-completeness at the completed-write boundary.
 */

/** Score-only partial projection of one complete canonical result body. */
const scoreOnly = (body) =>
  Object.fromEntries(
    Object.keys(body).map((criterion) => [criterion, { score: body[criterion].score }])
  );

/**
 * Builds one connected stop run. Batch size 1 stops the second member, so the first
 * survives as an earlier-batch success; batch size 2 stops the first member of its only
 * batch, so the second survives as a same-batch success; the last numeric item is never
 * dispatched in either arrangement and is terminalised LLM_RUN_STOPPED by the manager.
 */
function createConnectedStopRun(batchSize) {
  const stopResponse = { getResponseCode: () => 401, getContentText: vi.fn(() => 'Stop body.') };
  const healthyResponse = {
    getResponseCode: () => 200,
    getContentText: vi.fn(() => JSON.stringify(VALID_RESULT_DATA)),
  };
  const responsesBySource = new Map();
  const unexpectedNativePayloads = [];
  const fetchAll = vi.fn((nativeRequests) =>
    nativeRequests.map((nativeRequest) => {
      const configured = responsesBySource.get(JSON.parse(nativeRequest.payload).studentResponse);
      if (!configured) {
        unexpectedNativePayloads.push('fetchAll');
        return { getResponseCode: () => 600, getContentText: () => 'guard' };
      }
      return configured;
    })
  );
  const fetch = vi.fn(() => ({ getResponseCode: () => 600 }));
  const context = loadManager({ fetchAll, fetch, sleep: vi.fn() });
  let fixture = null;
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      const stopped = createRunStopAssignment('medium', 3);
      const template = stopped.notAttempted.task.getPrimaryTemplate();
      stopped.notAttempted.item.artifact.content = template.content;
      stopped.notAttempted.item.artifact.contentHash = template.contentHash;
      const stopIndex = batchSize === 1 ? 1 : 0;
      const healthyIndex = batchSize === 1 ? 0 : 1;
      stopped.numeric.forEach((pair, index) => {
        if (index === healthyIndex)
          responsesBySource.set(pair.item.artifact.content, healthyResponse);
        else if (index === stopIndex)
          responsesBySource.set(pair.item.artifact.content, stopResponse);
      });
      vi.spyOn(manager.configManager, 'getBackendAssessorBatchSize').mockImplementation(
        () => batchSize
      );
      const requests = manager.generateRequestObjects(stopped.assignment);
      let caught = null;
      try {
        manager.processStudentResponses(requests, stopped.assignment);
      } catch (error) {
        caught = error;
      }
      // Owned run-stop proof mapped onto this model: the stop is completion-with-errors,
      // the later batch is never dispatched and no stray native dispatch occurs.
      const expectedBatches = batchSize === 1 ? [1, 1] : [2];
      expect(caught).toBe(null);
      expect(unexpectedNativePayloads).toEqual([]);
      expect(fetchAll.mock.calls.map((call) => call[0].length)).toEqual(expectedBatches);
      fixture = {
        assignment: stopped.assignment,
        numeric: stopped.numeric.map((pair, index) => ({
          ...pair,
          role: index === stopIndex ? 'target' : index === healthyIndex ? 'healthy' : 'unprocessed',
          artifactSnapshot: structuredClone(pair.item.artifact.toJSON()),
        })),
        signature: stopped.notAttempted,
      };
    });
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }

  // Completion-flow wiring runs outside the harness scope so these seams survive its restore.
  const assignment = fixture.assignment;
  const inputs = loadBackendModelInputs('medium');
  const record = inputs.assignmentsByKey[assignment.assignmentId];
  const classDocument = structuredClone(inputs.classesById[assignment.courseId]);
  const selectedTaskIds = new Set(
    [fixture.signature, ...fixture.numeric].map((pair) => pair.item.taskId)
  );
  narrowDefinitionTasks(assignment.assignmentDefinition, selectedTaskIds);
  const db = wireRunStores(assignment.courseId, classDocument, assignment.assignmentDefinition);
  delete assignment.assessmentContractVersion;
  const stages = {};
  wireRunAssignment(assignment, stages);
  const run = createRun(assignment);
  return { record, db, stages, run, assignment, fixture };
}

/** Locates one persisted item for a fixture-selected (submission, task) pair. */
function persistedItemOf(record, entry) {
  const submission = record.submissions.find((s) => s.studentId === entry.submission.studentId);
  return submission.items[entry.item.taskId];
}

/** Asserts the completion-time marker, truthful errors feedback and distinct-item count. */
function expectStopCompletionBoundaries(stored, embedded) {
  expect(stored.assessmentContractVersion).toBe(1);
  expect(embedded.assessmentContractVersion).toBe(1);
  const messages = progress.updateProgress.mock.calls.map((call) => call[0]);
  expect(progress.complete).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast.mock.calls[0][0]).toBe(ERRORS_MESSAGE);
  const failedCount = countItems(stored, true);
  expect(messages).toContain(`${failedCount} tasks failed.`);
  expect(messages.indexOf(`${failedCount} tasks failed.`)).toBeLessThan(messages.length - 1);
  expect(messages.at(-1)).toBe(ERRORS_MESSAGE);
}
