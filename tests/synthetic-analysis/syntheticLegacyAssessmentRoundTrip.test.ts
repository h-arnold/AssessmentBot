import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type GoogleScriptRunApiHandler } from '@/test/googleScriptRunHarness';
import { createSyntheticApiRoundTripRunner } from '@/test/syntheticApiRoundTripAdapter';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import { deriveLegacyAssignmentScenario } from '#synthetic-data/deriveLegacyAssignmentScenario.js';
import { restoreGlobals, saveGlobals } from '#test-helpers/globalMockManager.js';
import {
  loadApiHandlerModule,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} from '../helpers/apiHandlerTestUtils.js';
import { getAssignment } from '@/services/assignmentAssessment/assignmentAssessmentService';
import { getABClass } from '@/services/googleClassrooms/classDetail/classDetailService';

/**
 * Legacy read cross-layer round trip.
 *
 * The script-owned `apiHandlerTestUtils` seams are composed with the real
 * `ABClassController` transport wrappers over a fake `DbManager`, then layered
 * with the existing GAS harness/frontend round-trip adapter and the real
 * frontend `getAssignment`/`getABClass` service schemas. Only the fake
 * `DbManager` record store is faked; the transport wrappers, controllers,
 * controllers' record stores and service schemas are the production code paths.
 *
 * The stored views are the canonical `small` selection with the selected
 * assignment's marker removed (the Section 1 stored scenario), and the linked
 * Section 1 `read` scenario supplies the expected `'legacy'` full-read content.
 * Reads must return real legacy scores/content behind the `'legacy'` marker
 * with no storage writes, and a later ordinary save must not persist the
 * read-time `'legacy'` marker or any read-time E.
 *
 * The backend's read projector once returned a `null` marker with detached
 * REASSESSMENT_REQUIRED placeholders; the landed backend instead emits the
 * `'legacy'` marker and restores real scores and content, so every case below
 * passes end to end. The full-read contract tests drive the real frontend
 * services. The two backend-side guard tests (no storage writes, no persisted
 * read-time state) deliberately invoke the dispatcher seam via
 * `bridge.invokeRequest` to stay backend-scoped; that split is the permanent
 * design of this suite.
 */
type Runner = GoogleScriptRunApiHandler;
type JsonRecord = Record<string, any>;

const PROFILE = 'small';
const CLASS_ID = 'class-0';
const ASSIGNMENT_ID = 'assignment-0-1';
const STORE_WRITE_OPS = ['insertOne', 'replaceOne', 'updateOne', 'deleteOne', 'save'] as const;

const ABClassControllerClass = require('#backend/y_controllers/ABClassController/index.js');
const ABClassModel = require('#backend/Models/ABClass.js').ABClass;
const TeacherModel = require('#backend/Models/Teacher.js').Teacher;
const ABClassPersistence = require('#backend/y_controllers/ABClassController/ABClassPersistence.js');
const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');
const abclassRead = require('#backend/z_Api/abclass/abclassRead.js');
const assignmentAssessmentApi = require('#backend/z_Api/assignmentAssessment.js');

/** Creates a record store whose reads clone rows and whose writes are observable. */
function createStore(seed: JsonRecord[]) {
  let rows = structuredClone(seed);
  return {
    findOne: vi.fn((query: JsonRecord) =>
      structuredClone(
        rows.find((row) => Object.entries(query).every(([k, v]) => row[k] === v)) ?? null
      )
    ),
    find: vi.fn(() => structuredClone(rows)),
    insertOne: vi.fn(),
    replaceOne: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
    save: vi.fn(),
    rows: () => structuredClone(rows),
  };
}

/** Clones the canonical class document and removes the selected assignment's stored marker. */
function storedLegacyClassDocument(): JsonRecord {
  const document = structuredClone(
    loadBackendModelInputs(PROFILE).classesById[CLASS_ID]
  ) as JsonRecord;
  const embedded = document.assignments.find(
    (entry: JsonRecord) => entry.assignmentId === ASSIGNMENT_ID
  );
  Reflect.deleteProperty(embedded, 'assessmentContractVersion');
  return document;
}

/** Clones the canonical standalone full record and removes its stored marker. */
function storedLegacyFullRecord(): JsonRecord {
  const record = structuredClone(
    loadBackendModelInputs(PROFILE).assignmentsByKey[ASSIGNMENT_ID]
  ) as JsonRecord;
  Reflect.deleteProperty(record, 'assessmentContractVersion');
  return record;
}

/**
 * Derived linked read scenario: the expected `'legacy'` full and class
 * responses, taken from the canonical views with only the read marker applied.
 */
function linkedReadScenario(): { full: JsonRecord; classEmbedded: JsonRecord } {
  return deriveLegacyAssignmentScenario({
    profileName: PROFILE,
    assignmentId: ASSIGNMENT_ID,
    variant: 'read',
    sources: {
      classesById: loadSyntheticAnalysisProfile(PROFILE, 'classesById') as Record<string, object>,
      assignmentsByKey: loadSyntheticAnalysisProfile(PROFILE, 'assignmentsByKey') as Record<
        string,
        object
      >,
    },
  }) as { full: JsonRecord; classEmbedded: JsonRecord };
}

/** Replaces one item's assessment map with a malformed entry; returns its task ID. */
function seedCorruptItem(record: JsonRecord): string {
  const item = Object.values(record.submissions[0].items)[0] as JsonRecord;
  item.assessments = { ...item.assessments, completeness: { score: 'not-a-score' } };
  return item.taskId as string;
}

type Bridge = {
  invokeRequest: (request: unknown, callbacks: any) => void;
  stores: { classStore: ReturnType<typeof createStore>; fullStore: ReturnType<typeof createStore> };
  classDocument: JsonRecord;
  fullRecord: JsonRecord;
  corruptTaskId: string | null;
  persistence: any;
};

// Mirrors the script-owned bridge: caller-owned spies survive seam teardown.
const bridgeVi = { fn: vi.fn.bind(vi), restoreAllMocks: () => {} };

// Bridge global writes go through a typed alias: globalThis has no index signature.
const globalScope = globalThis as unknown as Record<string, unknown>;

/** Composes the shared dispatcher seams with the real controllers over fake stores. */
function createLegacyReadBridge(corruptFullRecord = false): Bridge {
  const classDocument = storedLegacyClassDocument();
  const fullRecord = storedLegacyFullRecord();
  // Corruption is seeded before the store snapshots its rows, so reads see it.
  const corruptTaskId = corruptFullRecord ? seedCorruptItem(fullRecord) : null;
  const classStore = createStore([classDocument]);
  const fullStore = createStore([fullRecord]);
  const dbManager = {
    getCollection: vi.fn((name: string) =>
      name.startsWith('assign_full_') ? fullStore : classStore
    ),
  };

  return {
    invokeRequest(request, callbacks) {
      const context = setupApiHandlerTestContext(bridgeVi, { installLogger: true });
      const saved = saveGlobals(['ABClassController', 'DbManager']);
      try {
        globalScope.ABClassController = ABClassControllerClass;
        globalScope.DbManager = { getInstance: () => dbManager };
        // The shared seam helper stubs the transport wrappers; restore the real
        // read wrappers so both reads drive the production controller paths.
        globalScope.getABClass_ = abclassRead.getABClass_;
        globalScope.getAssignment_ = assignmentAssessmentApi.getAssignment_;
        callbacks.successHandler?.(loadApiHandlerModule().apiHandler(request));
      } catch (error) {
        callbacks.failureHandler?.(error);
      } finally {
        restoreGlobals(saved);
        teardownApiHandlerTestContext(bridgeVi, context);
      }
    },
    stores: { classStore, fullStore },
    classDocument,
    fullRecord,
    corruptTaskId,
    persistence: new ABClassPersistence({ dbManager, validation: new ABClassValidation() }),
  };
}

function installRunner(bridge: Bridge): void {
  vi.stubGlobal('google', {
    script: { run: createSyntheticApiRoundTripRunner(bridge.invokeRequest) as Runner },
  });
}

/**
 * Invokes the real dispatcher seam directly (the same seam the GAS harness
 * runner wraps), without the frontend services. Used by the backend-side
 * guard tests only.
 */
function invokeBackendRead(activeBridge: Bridge, request: JsonRecord): Promise<unknown> {
  return new Promise((resolve, reject) => {
    activeBridge.invokeRequest(request, {
      successHandler: (value: unknown) => resolve(value),
      failureHandler: (error: unknown) => reject(error),
    });
  });
}

function collectResults(submissions: JsonRecord[]): any[] {
  return submissions.flatMap((submission: JsonRecord) =>
    Object.values(submission.items).flatMap((item: any) => Object.values(item.assessments))
  );
}

describe('legacy assessment real dispatcher round trip', () => {
  let bridge: Bridge;

  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('ABClass', ABClassModel);
    vi.stubGlobal('Teacher', TeacherModel);
    bridge = createLegacyReadBridge();
    installRunner(bridge);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads real legacy scores and content behind the legacy marker on the full read', async () => {
    const result = await getAssignment({
      courseId: bridge.fullRecord.courseId,
      assignmentId: ASSIGNMENT_ID,
    });

    expect(result?.assessmentContractVersion).toBe('legacy');
    expect(result!.submissions).toEqual(linkedReadScenario().full.submissions);
    const results = collectResults(result!.submissions);
    expect(results.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
    expect(
      result!.submissions.some((submission) =>
        Object.values(submission.items).some((item: any) => item.artifact.content !== null)
      )
    ).toBe(true);
  });

  it('reads real legacy scores behind the legacy marker on the class read', async () => {
    const result = await getABClass({ classId: CLASS_ID });

    const assignment = result!.assignments.find((entry) => entry.assignmentId === ASSIGNMENT_ID)!;
    expect(assignment.assessmentContractVersion).toBe('legacy');
    const results = collectResults(assignment.submissions);
    expect(results.some((entry) => typeof entry.score === 'number' || entry.score === 'N')).toBe(
      true
    );
  });

  it('yields per-task E for a seeded corrupt item while healthy rows keep real values', async () => {
    vi.unstubAllGlobals();
    bridge = createLegacyReadBridge(true);
    installRunner(bridge);
    const taskId = bridge.corruptTaskId!;
    const result = await getAssignment({
      courseId: bridge.fullRecord.courseId,
      assignmentId: ASSIGNMENT_ID,
    });

    const item = result!.submissions[0].items[taskId] as JsonRecord;
    for (const criterion of ['completeness', 'accuracy', 'spag']) {
      expect(item.assessments[criterion].score).toBe('E');
      expect(item.assessments[criterion].error).toEqual({
        stage: 'validation',
        code: 'CORRUPT_RECORD',
      });
    }
    const sibling = Object.entries(result!.submissions[0].items).find(
      ([key]) => key !== taskId
    )![1];
    expect(
      Object.values(sibling.assessments).some((entry: any) => typeof entry.score === 'number')
    ).toBe(true);
    expect(result!.assessmentContractVersion).toBe('legacy');
  });

  it('writes nothing on either read and leaves the stored documents unchanged', async () => {
    const classBefore = structuredClone(bridge.stores.classStore.rows());
    const fullBefore = structuredClone(bridge.stores.fullStore.rows());

    await invokeBackendRead(bridge, {
      method: 'getAssignment',
      params: { courseId: bridge.fullRecord.courseId, assignmentId: ASSIGNMENT_ID },
    });
    await invokeBackendRead(bridge, { method: 'getABClass', params: { classId: CLASS_ID } });

    expect(bridge.stores.classStore.rows()).toEqual(classBefore);
    expect(bridge.stores.fullStore.rows()).toEqual(fullBefore);
    for (const op of STORE_WRITE_OPS) {
      expect(bridge.stores.classStore[op]).not.toHaveBeenCalled();
      expect(bridge.stores.fullStore[op]).not.toHaveBeenCalled();
    }
  });

  it('never persists the read-time legacy marker or read-time E on a later ordinary save', async () => {
    const classRecord = bridge.classDocument;
    const before = structuredClone(classRecord);
    await invokeBackendRead(bridge, {
      method: 'getAssignment',
      params: { courseId: bridge.fullRecord.courseId, assignmentId: ASSIGNMENT_ID },
    });
    await invokeBackendRead(bridge, { method: 'getABClass', params: { classId: CLASS_ID } });

    const restored = ABClassModel.fromJSON(bridge.stores.classStore.rows()[0]);
    bridge.persistence.persistClassAndPartial(restored);

    // The seeded class row already exists, so persistence replaces it.
    const written = bridge.stores.classStore.replaceOne.mock.calls[0][1] as JsonRecord;
    const saved = written.assignments.find(
      (entry: JsonRecord) => entry.assignmentId === ASSIGNMENT_ID
    );
    expect(Object.hasOwn(saved, 'assessmentContractVersion')).toBe(false);
    const rawClass = classRecord.assignments.find(
      (entry: JsonRecord) => entry.assignmentId === ASSIGNMENT_ID
    );
    expect(saved.submissions).toEqual(rawClass.submissions);
    expect(bridge.stores.classStore.replaceOne).toHaveBeenCalled();
    expect(before.assignments.map((entry: JsonRecord) => entry.assignmentId)).toContain(
      ASSIGNMENT_ID
    );
  });
});
