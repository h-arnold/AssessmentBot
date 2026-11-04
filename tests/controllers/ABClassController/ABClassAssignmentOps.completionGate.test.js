import { describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { Teacher } from '#backend/Models/Teacher.js';
import { ABClass } from '#backend/Models/ABClass.js';
import {
  setupControllerTestMocks,
  cleanupControllerTestMocks,
} from '#test-helpers/mockFactories.js';
import {
  buildCompletedRun,
  captureRunWithDiagnostics,
  captureThrown,
  clone,
  findDiagnosticEntry,
  FIXTURE_ASSIGNMENT_ID,
  FIXTURE_CLASS_ID,
  HEAD_TASK_ID,
  persistedFullPayload,
  SIBLING_TASK_ID,
  TEACHER_GLOBAL,
  writeEvents,
} from './abclassPersistenceTestHelpers.js';

const MODULE_PATH = '#backend/y_controllers/ABClassController/ABClassAssignmentOps.js';
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');
const {
  StudentSubmissionItem,
} = require('#backend/Models/StudentSubmission/00_StudentSubmissionItem.js');
const BaseTaskArtifact = require('#backend/Models/Artifacts/0_BaseTaskArtifact.js');

const NULL_PARENT_SUBMISSION_INDEX = 2;

const headItem = (assignment) => assignment.submissions[0].items[HEAD_TASK_ID];

/**
 * Marker-1 graph/source contradictions the completed-write gate must reject
 * itself, before marker certification, any projection and any collection
 * mutation. Each row restores the healthy canonical model first, then mutates
 * one local invariant with real model instances.
 *
 * Safety evidence is asserted with `expect.soft` before the hard rejection
 * assertion, so an unexpectedly accepted corrupt graph still reports the
 * no-write/marker/projection evidence instead of hiding it behind the first
 * hard failure.
 */
function captureSelectedEmbeddedEntry(abClass, assignment) {
  const index = abClass.findAssignmentIndex((a) => a.assignmentId === assignment.assignmentId);
  return index < 0 ? null : abClass.assignments[index];
}

function expectRejectedBeforeAnyMutation({ label, mutate }) {
  const { assignment, abClass, ops, db } = buildCompletedRun();
  // Prove the gate, not the later partial construction, owns the rejection:
  // no marker may be certified and no projection may run.
  delete assignment.assessmentContractVersion;
  const selectedBefore = captureSelectedEmbeddedEntry(abClass, assignment);
  const serializerSpies = [
    vi.spyOn(assignment, 'toJSON'),
    vi.spyOn(assignment, 'toPartialJSON'),
    vi.spyOn(abClass, 'toJSON'),
    vi.spyOn(abClass, 'toPartialJSON'),
  ];
  mutate(assignment, abClass);

  const thrown = captureThrown(() => ops.persistAssignmentRun(abClass, assignment));

  expect.soft(writeEvents(db), `${label}: store operations`).toEqual([]);
  expect.soft(Object.hasOwn(assignment, 'assessmentContractVersion')).toBe(false);
  for (const spy of serializerSpies) expect.soft(spy).not.toHaveBeenCalled();
  expect
    .soft(captureSelectedEmbeddedEntry(abClass, assignment), `${label}: embedded entry`)
    .toBe(selectedBefore);
  expect(thrown, `${label}: expected a rejection`).toBeInstanceOf(Error);
  expect(thrown.message, `${label}: contextual reason`).toMatch(
    /Completed assignment run is invalid/
  );
  return thrown;
}

describe('persistAssignmentRun completion gate — marker-1 graph contradictions', () => {
  it('rejects a known dictionary key whose real item task identity differs from its key', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G1-a',
      mutate: (assignment) => {
        assignment.submissions[0].items[HEAD_TASK_ID].taskId = 'wrong-task';
      },
    });
    expect(thrown.message).toMatch(HEAD_TASK_ID);
    expect(thrown.message).toMatch(/task|identity|association|mismatch/i);
  });

  it('rejects an extra real item under an unknown dictionary key', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G1-b',
      mutate: (assignment) => {
        const artifact = new BaseTaskArtifact({
          taskId: 'unknown-task',
          role: 'submission',
          content: 'extra',
          contentHash: 'hash-extra',
          uid: 'uid-unknown-task',
        });
        assignment.submissions[0].items['unknown-task'] = new StudentSubmissionItem({
          taskId: 'unknown-task',
          artifact,
        });
      },
    });
    expect(thrown.message).toMatch(/unknown-task|task universe|unknown/i);
  });

  it('rejects a real submission whose assignment identity differs from the assignment root', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G1-c',
      mutate: (assignment) => {
        assignment.submissions[0].assignmentId = 'other-assignment';
      },
    });
    expect(thrown.message).toMatch(/submission|identity|association|assignment/i);
  });

  it('rejects an emptied embedded definition task universe beside present submissions', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G1-d',
      mutate: (assignment) => {
        assignment.assignmentDefinition.tasks = {};
      },
    });
    expect(thrown.message).toMatch(/task universe|task|empty|untrustworthy/i);
  });

  it('rejects a missing submissions structure as a structure fault', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G1-e',
      mutate: (assignment) => {
        delete assignment.submissions;
      },
    });
    expect(thrown.message).toMatch(/submission|structure|missing/i);
  });

  it('rejects a missing item structure as a structure fault, not a coverage failure', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G1-f',
      mutate: (assignment) => {
        delete assignment.submissions[0].items;
      },
    });
    expect(thrown.message).toMatch(/item|structure|missing/i);
  });
});

describe('persistAssignmentRun completion gate — null-source and association invariants', () => {
  const nullSourceItem = (assignment, taskId = HEAD_TASK_ID) => {
    const item = assignment.submissions[0].items[taskId];
    item.setError('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
    item.artifact.content = null;
    return item;
  };

  it('rejects null artefact content beside a stale non-null content hash', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G2-a',
      mutate: (assignment) => {
        nullSourceItem(assignment).artifact.contentHash = 'stale-hash';
      },
    });
    expect(thrown.message).toMatch(HEAD_TASK_ID);
    expect(thrown.message).toMatch(/hash|content|source/i);
  });

  it('rejects null artefact content when the content hash property is deleted', () => {
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G2-b',
      mutate: (assignment) => {
        delete nullSourceItem(assignment).artifact.contentHash;
      },
    });
    expect(thrown.message).toMatch(HEAD_TASK_ID);
    expect(thrown.message).toMatch(/hash|content|source/i);
  });

  it('rejects an artefact whose task identity differs from its item task', () => {
    // Mirrors StudentSubmissionItem._hasValidCurrentArtifactIdentity
    // (artifact.taskId !== knownTaskId) reached from
    // validateCurrentRawArtifact, the existing marker-1 read rule.
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G2-c task identity',
      mutate: (assignment) => {
        headItem(assignment).artifact.taskId = SIBLING_TASK_ID;
      },
    });
    expect(thrown.message).toMatch(HEAD_TASK_ID);
    expect(thrown.message).toMatch(/task|identity|association/i);
  });

  it('rejects an artefact whose role is not submission', () => {
    // Mirrors StudentSubmissionItem._hasValidCurrentArtifactIdentity
    // (artifact.role !== 'submission') reached from validateCurrentRawArtifact.
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'G2-c role',
      mutate: (assignment) => {
        headItem(assignment).artifact.role = 'reference';
      },
    });
    expect(thrown.message).toMatch(HEAD_TASK_ID);
    expect(thrown.message).toMatch(/role|association|artefact/i);
  });

  it('rejects a null-parent placeholder carrying artefact metadata', () => {
    // Mirrors AssignmentCurrentRestoration._hasConsistentCurrentSource: a
    // null-document placeholder must carry empty artefact metadata.
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'null-parent metadata',
      mutate: (assignment) => {
        assignment.submissions[NULL_PARENT_SUBMISSION_INDEX].items[HEAD_TASK_ID].artifact.metadata =
          { sourceUrl: 'https://example.test/export' };
      },
    });
    expect(thrown.message).toMatch(HEAD_TASK_ID);
    expect(thrown.message).toMatch(/metadata|placeholder|source|document/i);
  });

  it('rejects a null-parent placeholder carrying item feedback', () => {
    // Mirrors AssignmentCurrentRestoration._hasConsistentCurrentSource: a
    // null-document placeholder must carry empty item feedback.
    const thrown = expectRejectedBeforeAnyMutation({
      label: 'null-parent feedback',
      mutate: (assignment) => {
        assignment.submissions[NULL_PARENT_SUBMISSION_INDEX].items[HEAD_TASK_ID].feedback = {
          general: { text: 'noise' },
        };
      },
    });
    expect(thrown.message).toMatch(HEAD_TASK_ID);
    expect(thrown.message).toMatch(/feedback|placeholder|source|document/i);
  });
});

describe('persistAssignmentRun completion gate — validity controls', () => {
  it('persists extraction E with null content and an exactly-null hash, keeping its recorded cause', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    const item = headItem(assignment);
    item.setError('extraction', 'SOURCE_CONTENT_UNAVAILABLE');
    item.artifact.content = null;
    item.artifact.contentHash = null;
    expect(() => ops.persistAssignmentRun(abClass, assignment)).not.toThrow();
    const stored = persistedFullPayload(db, assignment).submissions[0].items[HEAD_TASK_ID];
    expect(stored.artifact.content).toBeNull();
    expect(stored.artifact.contentHash).toBeNull();
    for (const entry of Object.values(stored.assessments)) {
      expect(entry.error).toEqual({ stage: 'extraction', code: 'SOURCE_CONTENT_UNAVAILABLE' });
    }
  });

  it('persists a sourced assessment E with its valid content and hash', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    const item = headItem(assignment);
    const content = item.artifact.content;
    const contentHash = item.artifact.contentHash;
    item.setError('assessment', 'ASSESSMENT_FAILED');
    expect(() => ops.persistAssignmentRun(abClass, assignment)).not.toThrow();
    const stored = persistedFullPayload(db, assignment).submissions[0].items[HEAD_TASK_ID];
    expect(stored.artifact.content).toBe(content);
    expect(stored.artifact.contentHash).toBe(contentHash);
    for (const entry of Object.values(stored.assessments)) {
      expect(entry.error).toEqual({ stage: 'assessment', code: 'ASSESSMENT_FAILED' });
    }
  });
});

/**
 * The existing `ABClassValidation._validateClassForSave` must run during
 * preparation, before the first collection mutation, so an invalid class
 * cannot commit the full assignment and then fail outside both persistence
 * owners' diagnostics. The original validator error identity is retained.
 */
describe('persistAssignmentRun pre-write class-save validation', () => {
  const UNSAFE_CLASS_ID = '../unsafe';

  it('rejects an unsafe classId during preparation with the original validator error', () => {
    const { assignment, abClass, ops, db } = buildCompletedRun();
    abClass.classId = UNSAFE_CLASS_ID;
    delete assignment.assessmentContractVersion;
    const selectedBefore = captureSelectedEmbeddedEntry(abClass, assignment);
    const serializerSpies = [
      vi.spyOn(assignment, 'toJSON'),
      vi.spyOn(assignment, 'toPartialJSON'),
      vi.spyOn(abClass, 'toJSON'),
      vi.spyOn(abClass, 'toPartialJSON'),
    ];

    const { thrown, errorCalls } = captureRunWithDiagnostics(() =>
      ops.persistAssignmentRun(abClass, assignment)
    );

    expect.soft(writeEvents(db), 'store operations').toEqual([]);
    expect.soft(Object.hasOwn(assignment, 'assessmentContractVersion')).toBe(false);
    for (const spy of serializerSpies) expect.soft(spy).not.toHaveBeenCalled();
    expect.soft(captureSelectedEmbeddedEntry(abClass, assignment)).toBe(selectedBefore);

    expect(thrown).toBeInstanceOf(TypeError);
    expect(thrown.message).toBe('saveClass: invalid classId format');
    const entry = findDiagnosticEntry(errorCalls, thrown);
    expect(entry, 'expected a failed-phase diagnostic for the rejection').toBeDefined();
    expect(entry.failedPhase).toBe('completed-write-validation');
    expect(entry.fullWriteCommitted).toBe(false);
  });

  it('propagates the original error through the real facade with no full-store mutation', () => {
    setupControllerTestMocks(vi);
    try {
      const inputs = loadBackendModelInputs('small');
      const assignment = Assignment.fromJSON(
        clone(inputs.assignmentsByKey[FIXTURE_ASSIGNMENT_ID]),
        'full'
      );
      const abClass = withTemporaryGlobals(TEACHER_GLOBAL, () =>
        ABClass.fromJSON(clone(inputs.classesById[FIXTURE_CLASS_ID]))
      );
      abClass.classId = UNSAFE_CLASS_ID;
      const controller = new ABClassController();
      const collection = globalThis.DbManager.getInstance().getCollection('unused');

      const thrown = captureThrown(() => controller.persistAssignmentRun(abClass, assignment));

      expect(thrown).toBeInstanceOf(TypeError);
      expect(thrown.message).toBe('saveClass: invalid classId format');
      expect(collection.insertOne).not.toHaveBeenCalled();
      expect(collection.replaceOne).not.toHaveBeenCalled();
      expect(collection.save).not.toHaveBeenCalled();
    } finally {
      cleanupControllerTestMocks();
    }
  });
});
