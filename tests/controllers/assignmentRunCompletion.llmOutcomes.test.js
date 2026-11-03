/**
 * Connected completion coverage for the remaining LLM terminal outcomes.
 *
 * `assignmentRunCompletion.test.js` already connects the real `LLMRequestManager`
 * run-stop generation to the real completion/persistence chain. This companion
 * covers the two terminal outcomes it does not: an invalid successful response
 * (`LLM_INVALID_RESPONSE`) and retryable exhaustion (`LLM_UNAVAILABLE`). Each row
 * runs the real manager over hermetic native `UrlFetchApp` stubs, then feeds the
 * manager's own model into the real `AssignmentController.processSelectedAssignment`
 * and the real `ABClassController` persistence chain over in-memory collections.
 *
 * The selected pairs come from the same canonical run-stop fixture builder the
 * owner suite uses, so the two companions agree on which canonical TEXT items are
 * dispatchable and which carry the genuine template-copy `N` signature.
 *
 * CHARACTERISATION: Sections 1–8 already deliver both terminal outcomes, so these
 * rows pin existing behaviour rather than recording a missing boundary. They fail
 * for the intended reason if the outcome catalogue, the three-criteria coverage,
 * the marker stamping or the distinct-item completion feedback regresses.
 *
 * Proof limits: hermetic native stubs and in-memory collections only. Nothing here
 * proves live GAS/network behaviour, deployed logging fidelity or durable
 * JsonDbApp persistence.
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
  VALID_RESULT_DATA,
  canonicalRunStoppedAssessments,
  catalogueHTTPAssessments,
  loadManager,
} from '#test-helpers/llmRequestManagerHarness.js';

const AssignmentController = require('#backend/y_controllers/AssignmentController.js');
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');

const ERRORS_MESSAGE = 'Assessment run completed with errors.';
const CRITERIA = ['completeness', 'accuracy', 'spag'];

let progress;
let toast;
let savedGlobals;

const matchesFilter = (document, filter) =>
  Object.entries(filter ?? {}).every(([key, value]) => document[key] === value);

/** Hermetic per-name in-memory collections recording every store operation. */
function createMockDb() {
  const collections = new Map();
  const instance = {
    getCollection(name) {
      if (!collections.has(name)) {
        const docs = [];
        collections.set(name, {
          docs,
          findOne: vi.fn((filter) => docs.find((doc) => matchesFilter(doc, filter)) ?? null),
          insertOne: vi.fn((doc) => docs.push(doc)),
          replaceOne: vi.fn((filter, doc) => {
            const index = docs.findIndex((stored) => matchesFilter(stored, filter));
            if (index >= 0) docs.splice(index, 1, doc);
            else docs.push(doc);
          }),
          updateOne: vi.fn((filter, patch) => {
            const stored = docs.find((doc) => matchesFilter(doc, filter));
            if (stored && patch?.$set) Object.assign(stored, patch.$set);
          }),
          save: vi.fn(),
        });
      }
      return collections.get(name);
    },
  };
  return { collections, instance };
}

/** Counts distinct submission items by whether any criterion carries an explicit E. */
function countItems(fullRecord, failed) {
  let count = 0;
  for (const submission of fullRecord.submissions) {
    for (const item of Object.values(submission.items ?? {})) {
      const hasError = Object.values(item.assessments ?? {}).some((entry) => entry.score === 'E');
      if (hasError === failed) count += 1;
    }
  }
  return count;
}

/** Wires the completion run's hermetic stores and the production seams it needs. */
function wireRunStores(courseId, classDocument, definition) {
  const db = createMockDb();
  globalThis.DbManager = { getInstance: () => db.instance };
  db.instance.getCollection(courseId).docs.push(classDocument);
  globalThis.DriveManager = {
    getFileModifiedTime: vi.fn((id) =>
      id === definition.referenceDocumentId
        ? definition.referenceLastModified
        : definition.templateLastModified
    ),
  };
  globalThis.ClassroomApiClient = {
    fetchCourse: vi.fn(() => ({
      id: courseId,
      name: classDocument.className,
      ownerId: classDocument.classOwner?.userId ?? null,
    })),
    fetchTeachers: vi.fn(() => structuredClone(classDocument.teachers)),
    fetchAllStudents: vi.fn(() => structuredClone(classDocument.students)),
  };
  globalThis.AssignmentDefinitionController = class {
    getDefinitionByKey() {
      return structuredClone(definition);
    }
  };
  return db;
}

/** Installs the Assignment.create seam and the no-op pipeline stage spies. */
function wireRunAssignment(assignment, stages) {
  vi.spyOn(Assignment, 'create').mockReturnValue(assignment);
  for (const stage of ['fetchSubmittedDocuments', 'processAllSubmissions', 'assessResponses']) {
    stages[stage] = vi.spyOn(assignment, stage).mockImplementation(() => {});
  }
  if (typeof assignment.processImages === 'function') {
    stages.processImages = vi.spyOn(assignment, 'processImages').mockImplementation(() => {});
  }
}

const fullRecordOf = (flow) =>
  flow.db.collections.get(`assign_full_${flow.record.courseId}_${flow.record.assignmentId}`)
    .docs[0];

const storedClassOf = (flow) => flow.db.collections.get(flow.record.courseId).docs[0];

/** Locates one persisted item for a fixture-selected (submission, task) pair. */
function persistedItemOf(record, entry) {
  const submission = record.submissions.find((s) => s.studentId === entry.submission.studentId);
  return submission.items[entry.item.taskId];
}

/** Score-only partial projection of one complete canonical result body. */
const scoreOnly = (body) =>
  Object.fromEntries(CRITERIA.map((criterion) => [criterion, { score: body[criterion].score }]));

/** The canonical N map a genuine template copy produces. */
const NOT_ATTEMPTED = Object.fromEntries(
  CRITERIA.map((criterion) => [criterion, { score: 'N', reasoning: 'Task not attempted' }])
);

/**
 * Native response fixtures for the two terminal outcomes. The invalid row returns
 * HTTP 200 with an unparseable body (one dispatch, no retry); the exhaustion row
 * returns three retryable 500s through the shared transport budget.
 */
const OUTCOME_FIXTURES = {
  invalid: {
    responses: [{ getResponseCode: () => 200, getContentText: () => '{' }],
    retries: [],
    sleeps: [],
    expected: catalogueHTTPAssessments(
      'The assessment service returned an invalid result.',
      'LLM_INVALID_RESPONSE'
    ),
  },
  unavailable: {
    responses: [{ getResponseCode: () => 500, getContentText: () => 'Service 500 initial.' }],
    retries: [
      { getResponseCode: () => 500, getContentText: () => 'Service 500 second.' },
      { getResponseCode: () => 500, getContentText: () => 'Service 500 third.' },
    ],
    sleeps: [5000, 7500],
    expected: catalogueHTTPAssessments(
      'The assessment service could not complete the request after retries.',
      'LLM_UNAVAILABLE'
    ),
  },
};

/**
 * Builds one connected outcome run. Phase 1 runs the real `LLMRequestManager` over
 * the row's native stubs so the E maps come from the manager's own routing. Phase 2
 * feeds that same model into the real completion flow, with its assess stage
 * observed as a no-op, and narrows the definition task map to the dispatched pair
 * plus one genuine template-copy N sibling so completed-item coverage holds.
 */
function createConnectedOutcomeRun(kind) {
  const row = OUTCOME_FIXTURES[kind];
  const natives = {
    fetchAll: vi.fn((nativeRequests) => nativeRequests.map(() => row.responses[0])),
    fetch: vi.fn(() => row.retries.shift()),
    sleep: vi.fn(),
  };
  const context = loadManager(natives);
  let collected = null;
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      // One canonical numeric TEXT candidate plus one canonical template-signature
      // TEXT candidate, both real committed pairs with their own associations.
      const stopped = createRunStopAssignment('medium', 1);
      const [dispatched] = stopped.numeric;
      const signature = stopped.notAttempted;
      const template = signature.task.getPrimaryTemplate();
      signature.item.artifact.content = template.content;
      signature.item.artifact.contentHash = template.contentHash;

      const requests = manager.generateRequestObjects(stopped.assignment);
      expect(requests.map((request) => request.uid)).toEqual([dispatched.item.artifact.getUid()]);
      let caught = null;
      try {
        manager.processStudentResponses(requests, stopped.assignment);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(null);
      // Exact dispatch shape: one batch of the single request, then only the
      // retries this outcome allows, with the shared backoff budget.
      expect(natives.fetchAll.mock.calls.map((call) => call[0].length)).toEqual([1]);
      expect(natives.fetch).toHaveBeenCalledTimes(row.sleeps.length);
      expect(natives.sleep.mock.calls.map((call) => call[0])).toEqual(row.sleeps);
      expect(dispatched.item.getAssessment()).toEqual(row.expected);
      expect(signature.item.getAssessment()).toEqual(NOT_ATTEMPTED);
      collected = {
        assignment: stopped.assignment,
        dispatched,
        signature,
        artifactSnapshot: structuredClone(dispatched.item.artifact.toJSON()),
      };
    });
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }

  // Phase 2 wiring runs outside the harness scope so these seams survive its restore.
  const { assignment, dispatched, signature } = collected;
  const inputs = loadBackendModelInputs('medium');
  const classDocument = structuredClone(inputs.classesById[assignment.courseId]);
  const selectedTaskIds = new Set([dispatched.item.taskId, signature.item.taskId]);
  assignment.assignmentDefinition.tasks = Object.fromEntries(
    Object.entries(assignment.assignmentDefinition.tasks).filter(([id]) => selectedTaskIds.has(id))
  );
  const db = wireRunStores(assignment.courseId, classDocument, assignment.assignmentDefinition);
  delete assignment.assessmentContractVersion;
  const stages = {};
  wireRunAssignment(assignment, stages);
  const controller = new AssignmentController();
  const run = () =>
    controller.processSelectedAssignment({
      assignmentId: assignment.assignmentId,
      definitionKey: assignment.assignmentDefinition.definitionKey,
      courseId: assignment.courseId,
    });
  return {
    record: inputs.assignmentsByKey[assignment.assignmentId],
    db,
    stages,
    run,
    row,
    ...collected,
  };
}

describe('AssignmentController processSelectedAssignment LLM terminal outcomes', () => {
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
    toast = vi.fn();
    Object.assign(globalThis, {
      ProgressTracker: { getInstance: () => progress },
      Utils: { ...globalThis.Utils, toastMessage: toast },
      Teacher,
      ABClass,
      ABClassController,
    });
  });

  afterEach(() => {
    restoreGlobals(savedGlobals);
    vi.restoreAllMocks();
  });

  it.each([
    ['LLM_INVALID_RESPONSE', 'invalid'],
    ['LLM_UNAVAILABLE', 'unavailable'],
  ])(
    'persists the real %s maps beside a genuine N sibling with the marker and three-criteria coverage',
    (_label, kind) => {
      const flow = createConnectedOutcomeRun(kind);
      flow.run();

      // The completion run's assess stage is observed, not re-executed: the E maps
      // under test came from the real manager in phase 1.
      expect(flow.stages.assessResponses).toHaveBeenCalledTimes(1);

      const stored = fullRecordOf(flow);
      const embedded = storedClassOf(flow).assignments.find(
        (entry) => entry.assignmentId === flow.assignment.assignmentId
      );
      const items = {
        storedFailed: persistedItemOf(stored, flow.dispatched),
        storedSignature: persistedItemOf(stored, flow.signature),
        embeddedFailed: persistedItemOf(embedded, flow.dispatched),
        embeddedSignature: persistedItemOf(embedded, flow.signature),
      };

      // Exactly three terminal criteria, all carrying the manager's own cause.
      for (const item of [items.storedFailed, items.embeddedFailed]) {
        expect(Object.keys(item.assessments).sort()).toEqual(['accuracy', 'completeness', 'spag']);
        expect(item.assessments).toEqual(flow.row.expected);
        for (const entry of Object.values(item.assessments)) {
          expect(entry.score).toBe('E');
          expect(entry.error.stage).toBe('assessment');
        }
      }
      // The genuine N sibling keeps its three terminal N criteria on both projections.
      for (const item of [items.storedSignature, items.embeddedSignature]) {
        expect(Object.keys(item.assessments).sort()).toEqual(['accuracy', 'completeness', 'spag']);
        expect(Object.values(item.assessments).map(({ score }) => score)).toEqual(['N', 'N', 'N']);
      }
      // The partial projection keeps E reasoning/cause and strips only numeric/N reasoning.
      expect(items.embeddedFailed.assessments).toEqual(flow.row.expected);
      expect(items.embeddedSignature.assessments).toEqual(
        scoreOnly(items.storedSignature.assessments)
      );
      // Extraction succeeded, so the source survives beside the assessment error.
      expect(items.storedFailed.artifact.content).toBe(flow.artifactSnapshot.content);
      expect(items.storedFailed.artifact.contentHash).toBe(flow.artifactSnapshot.contentHash);

      // Completion-time marker stamping on both projections.
      expect(stored.assessmentContractVersion).toBe(1);
      expect(embedded.assessmentContractVersion).toBe(1);

      // Truthful completion-with-errors feedback with a distinct-item count.
      const messages = progress.updateProgress.mock.calls.map((call) => call[0]);
      const failedCount = countItems(stored, true);
      expect(failedCount).toBe(1);
      expect(messages).toContain(`${failedCount} tasks failed.`);
      expect(messages.indexOf(`${failedCount} tasks failed.`)).toBeLessThan(messages.length - 1);
      expect(messages.at(-1)).toBe(ERRORS_MESSAGE);
      expect(progress.complete).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenCalledTimes(1);
      expect(toast.mock.calls[0][0]).toBe(ERRORS_MESSAGE);
    }
  );

  it('keeps the run-stop map distinct from the invalid and exhausted outcomes', () => {
    // Guard: the two rows above must not be satisfied by the run-stop catalogue.
    expect(OUTCOME_FIXTURES.invalid.expected).not.toEqual(canonicalRunStoppedAssessments());
    expect(OUTCOME_FIXTURES.unavailable.expected).not.toEqual(canonicalRunStoppedAssessments());
    expect(OUTCOME_FIXTURES.invalid.expected.completeness.error.code).toBe('LLM_INVALID_RESPONSE');
    expect(OUTCOME_FIXTURES.unavailable.expected.completeness.error.code).toBe('LLM_UNAVAILABLE');
    expect(VALID_RESULT_DATA.accuracy.score).toBe(2.5);
  });
});
