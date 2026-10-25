import { describe, expect, it, vi } from 'vitest';
import smallAssignmentsRaw from '@synthetic/small/assignmentsByKey.json?raw';
import { AssignmentFullSchema } from './assignmentAssessment.zod';
import { normaliseAssignmentRead } from './assignmentReadNormalisation';

type RawRecord = Record<string, unknown>;
type RawItem = {
  id: string;
  taskId: string;
  artifact: RawRecord;
  assessments: RawRecord;
  feedback: RawRecord;
};
type RawSubmission = {
  studentId: string;
  studentName: string | null;
  assignmentId: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
  items: Record<string, RawItem>;
};
type RawAssignment = RawRecord & {
  assignmentId: string;
  createdAt: string;
  updatedAt: string | null;
  tasks: Record<string, RawRecord>;
  assessmentContractVersion: unknown;
  submissions: RawSubmission[];
  assignmentDefinition: {
    definitionKey?: unknown;
    tasks: Record<string, RawRecord>;
  };
};

const source = JSON.parse(smallAssignmentsRaw) as Record<string, RawRecord>;
const baseline = structuredClone(source['assignment-0-0']);
const criteria = ['completeness', 'accuracy', 'spag'] as const;
const corruptResult = {
  score: 'E',
  reasoning: 'The stored assessment data for this task is invalid. Reassess the assignment.',
  error: { stage: 'validation', code: 'CORRUPT_RECORD' },
};
const corruptAssessments = {
  completeness: corruptResult,
  accuracy: corruptResult,
  spag: corruptResult,
};
const reassessmentResult = {
  score: 'E',
  reasoning: 'Reassessment required',
  error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' },
};
const assessmentErrorResult = {
  score: 'E',
  reasoning: 'The assessment service rejected the request.',
  error: { stage: 'assessment', code: 'LLM_HTTP_FAILED' },
};
const assessmentErrorAssessments = {
  completeness: assessmentErrorResult,
  accuracy: assessmentErrorResult,
  spag: assessmentErrorResult,
};
const numericAssessments = Object.fromEntries(
  criteria.map((criterion) => [criterion, { score: 3, reasoning: 'private reasoning' }])
);

/**
 * Build a coherent current-format probe from the committed assignment task graph.
 * @returns {RawAssignment} A detached full assignment payload with linked known-task items.
 */
function currentProbe(): RawAssignment {
  const result = structuredClone(baseline) as unknown as RawAssignment;
  result.assessmentContractVersion = 1;
  result.submissions = [
    {
      studentId: 'student-1',
      studentName: 'Private Student',
      assignmentId: result.assignmentId,
      documentId: 'submission-doc',
      createdAt: result.createdAt,
      updatedAt: result.updatedAt ?? result.createdAt,
      items: Object.fromEntries(
        Object.keys(result.tasks).map((taskId): [string, RawItem] => {
          return [
            taskId,
            {
              id: `item-${taskId}`,
              taskId,
              artifact: {
                taskId,
                role: 'submission',
                pageId: null,
                documentId: 'submission-doc',
                uid: `uid-${taskId}`,
                contentHash: 'body-hash',
                metadata: {},
                type: 'TEXT',
                content: 'private source body',
              },
              assessments: Object.fromEntries(
                criteria.map(function (criterion): [string, RawRecord] {
                  return [criterion, { score: 3, reasoning: 'private reasoning' }];
                })
              ),
              feedback: {},
            } satisfies RawItem,
          ];
        })
      ),
    },
  ];
  return result;
}

/**
 * Build a canonical null-source acquisition error item.
 * @param {string} taskId Known task identity.
 * @returns {RawItem} An all-three SOURCE_UNREADABLE placeholder.
 */
function acquisitionErrorItem(taskId: string): RawItem {
  return {
    id: `item-${taskId}`,
    taskId,
    artifact: {
      taskId,
      role: 'submission',
      pageId: null,
      documentId: null,
      uid: `uid-${taskId}`,
      contentHash: null,
      metadata: {},
      type: 'base',
      content: null,
    },
    assessments: Object.fromEntries(
      criteria.map((criterion) => {
        return [
          criterion,
          {
            score: 'E',
            reasoning: 'The submitted document could not be accessed.',
            error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
          },
        ];
      })
    ),
    feedback: {},
  };
}

describe('normaliseAssignmentRead full payload', () => {
  it('preserves healthy numeric/N and explicit E results, nullable names, and input immutability', () => {
    const input = currentProbe();
    input.submissions[0].studentName = null;
    const [taskId] = Object.keys(input.tasks);
    input.submissions[0].items[taskId].assessments.completeness = { score: 'N', reasoning: '' };
    input.submissions[0].items[taskId].assessments.accuracy = {
      score: 'E',
      reasoning: 'Reassessment required',
      error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' },
    };
    const original = structuredClone(input);
    const output = normaliseAssignmentRead(input);
    expect(input).toEqual(original);
    expect(output).not.toBeNull();
    expect(output).toEqual(input);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);

    const legacy = currentProbe();
    legacy.assessmentContractVersion = null;
    legacy.submissions[0].documentId = null;
    legacy.submissions[0].items = Object.fromEntries(
      Object.keys(legacy.tasks).map((id) => {
        const item = acquisitionErrorItem(id);
        item.assessments = Object.fromEntries(
          criteria.map((criterion) => [criterion, reassessmentResult])
        );
        return [id, item];
      })
    );
    const legacyOutput = normaliseAssignmentRead(legacy);
    expect(legacyOutput?.assessmentContractVersion).toBeNull();
    expect(legacyOutput?.submissions[0].items).toEqual(legacy.submissions[0].items);
    expect(AssignmentFullSchema.safeParse(legacyOutput).success).toBe(true);

    const unmarkedSuccess = currentProbe();
    unmarkedSuccess.assessmentContractVersion = null;
    const unmarkedTask = Object.keys(unmarkedSuccess.tasks)[0]!;
    unmarkedSuccess.submissions[0].items[unmarkedTask].assessments = assessmentErrorAssessments;
    const unmarkedOutput = normaliseAssignmentRead(unmarkedSuccess);
    expect(unmarkedOutput?.assessmentContractVersion).toBeNull();
    expect(unmarkedOutput?.submissions[0].studentId).toBe(unmarkedSuccess.submissions[0].studentId);
    expect(unmarkedOutput?.submissions[0].items).toHaveProperty(
      Object.keys(unmarkedSuccess.tasks)[0]
    );
    const unmarkedItems = Object.values(unmarkedOutput!.submissions[0].items);
    for (const item of unmarkedItems) expect.soft(item.assessments).toEqual(corruptAssessments);
  });

  it('isolates invalid items as exact catalogue corruption while preserving a healthy sibling', () => {
    const input = currentProbe();
    const [invalidTask, healthyTask] = Object.keys(input.tasks);
    input.submissions[0].items[invalidTask].assessments.accuracy = { score: 'E', reasoning: 'bad' };
    const output = normaliseAssignmentRead(input);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
    expect(output).not.toBeNull();
    if (output === null) throw new Error('Expected identifiable items to be isolated');
    const invalid = output.submissions[0].items[invalidTask];
    expect(invalid.assessments).toEqual(corruptAssessments);
    const healthy = output.submissions[0].items[healthyTask];
    expect(healthy).toEqual(currentProbe().submissions[0].items[healthyTask]);

    const missingHash = currentProbe();
    delete missingHash.submissions[0].items[invalidTask].artifact.contentHash;
    const missingHashOutput = normaliseAssignmentRead(missingHash);
    expect(missingHashOutput?.submissions[0].items[invalidTask].assessments).toEqual(
      corruptAssessments
    );
    expect(missingHashOutput?.submissions[0].items[healthyTask]).toEqual(
      currentProbe().submissions[0].items[healthyTask]
    );
    expect(AssignmentFullSchema.safeParse(missingHashOutput).success).toBe(true);

    const missingArtifact = currentProbe();
    Reflect.deleteProperty(missingArtifact.submissions[0].items[invalidTask], 'artifact');

    const nullArtifact = currentProbe();
    nullArtifact.submissions[0].items[invalidTask].artifact = null as unknown as RawRecord;
    const wrongArtifactTask = currentProbe();
    wrongArtifactTask.submissions[0].items[invalidTask].artifact.taskId = healthyTask;
    const wrongArtifactRole = currentProbe();
    wrongArtifactRole.submissions[0].items[invalidTask].artifact.role = 'reference';
    const blankArtifactUid = currentProbe();
    blankArtifactUid.submissions[0].items[invalidTask].artifact.uid = '  ';
    expect
      .soft(() => {
        const output = normaliseAssignmentRead(missingArtifact);
        expect(output?.submissions[0].items[invalidTask].assessments).toEqual(corruptAssessments);
        expect(output?.submissions[0].items[healthyTask]).toEqual(
          currentProbe().submissions[0].items[healthyTask]
        );
        expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
      })
      .not.toThrow();
    expect
      .soft(() => {
        const output = normaliseAssignmentRead(nullArtifact);
        expect(output?.submissions[0].items[invalidTask].assessments).toEqual(corruptAssessments);
        expect(output?.submissions[0].items[healthyTask]).toEqual(
          currentProbe().submissions[0].items[healthyTask]
        );
        expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
      })
      .not.toThrow();
    for (const invalidArtifact of [wrongArtifactTask, wrongArtifactRole, blankArtifactUid]) {
      expect
        .soft(() => {
          const output = normaliseAssignmentRead(invalidArtifact);
          expect(output?.submissions[0].items[invalidTask].assessments).toEqual(corruptAssessments);
          const expectedHealthy = currentProbe().submissions[0].items[healthyTask];
          expect(output?.submissions[0].items[healthyTask]).toEqual(expectedHealthy);
          expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
        })
        .not.toThrow();
    }
  });

  it('fills known missing tasks and fails loudly for unknown tasks or untrustworthy identity', () => {
    const input = currentProbe();
    const [presentTask, missingTask] = Object.keys(input.tasks);
    delete input.submissions[0].items[missingTask];
    const original = structuredClone(input);
    const output = normaliseAssignmentRead(input);
    expect(input).toEqual(original);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
    expect(output?.submissions[0].items[missingTask].assessments).toEqual(corruptAssessments);
    input.submissions[0].items.unknown = structuredClone(input.submissions[0].items[presentTask]);
    expect(() => normaliseAssignmentRead(input)).toThrow();
    const badIdentity = currentProbe();
    badIdentity.submissions[0].studentId = '';
    expect(() => normaliseAssignmentRead(badIdentity)).toThrow();
  });

  it('isolates contradictory source records and preserves canonical acquisition errors', function () {
    const contradictory = currentProbe();
    const [taskId] = Object.keys(contradictory.tasks);
    contradictory.submissions[0].items[taskId].artifact.content = null;
    contradictory.submissions[0].items[taskId].artifact.contentHash = null;
    let output = normaliseAssignmentRead(contradictory);
    expect(output?.submissions[0].items[taskId].assessments).toEqual(corruptAssessments);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);

    const acquisition = currentProbe();
    acquisition.submissions[0].documentId = null;
    acquisition.submissions[0].items = Object.fromEntries(
      Object.keys(acquisition.tasks).map((id) => [id, acquisitionErrorItem(id)])
    );
    output = normaliseAssignmentRead(acquisition);
    expect(output).not.toBeNull();
    expect(output?.submissions[0].items).toEqual(acquisition.submissions[0].items);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);

    const nullParentContradiction = structuredClone(acquisition);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [badTask, healthyTask] = Object.keys(nullParentContradiction.tasks);
    nullParentContradiction.submissions[0].items[badTask].artifact.documentId =
      'contradictory-document';
    nullParentContradiction.submissions[0].items[badTask].artifact.pageId = 'contradictory-page';
    nullParentContradiction.submissions[0].items[badTask].assessments = numericAssessments;
    const numericNullParentOutput = normaliseAssignmentRead(nullParentContradiction);
    expect(numericNullParentOutput?.submissions[0].items[badTask].assessments).toEqual(
      corruptAssessments
    );
    expect(AssignmentFullSchema.safeParse(numericNullParentOutput).success).toBe(true);
    nullParentContradiction.submissions[0].items[badTask].assessments = assessmentErrorAssessments;
    const nullParentOutput = normaliseAssignmentRead(nullParentContradiction);
    expect(nullParentOutput?.submissions[0].items[badTask].assessments).toEqual(corruptAssessments);
    expect(nullParentOutput?.submissions[0].items[healthyTask]).toEqual(
      nullParentContradiction.submissions[0].items[healthyTask]
    );
    const repairedArtifact = nullParentOutput!.submissions[0].items[badTask].artifact;
    expect.soft(repairedArtifact).toMatchObject({
      type: 'base',
      role: 'submission',
      documentId: null,
      pageId: null,
      metadata: {},
    });
    expect.soft(repairedArtifact.content).toBeNull();
    expect.soft(repairedArtifact.contentHash).toBeNull();
    expect(AssignmentFullSchema.safeParse(nullParentOutput).success).toBe(true);
    warn.mockClear();
    const repairedAgain = normaliseAssignmentRead(nullParentOutput);
    expect.soft(repairedAgain).toEqual(nullParentOutput);
    expect.soft(warn).not.toHaveBeenCalled();
    warn.mockRestore();

    const documentParentContradiction = currentProbe();
    documentParentContradiction.submissions[0].items[badTask].artifact.content = null;
    documentParentContradiction.submissions[0].items[badTask].artifact.contentHash = null;
    documentParentContradiction.submissions[0].items[badTask].assessments =
      assessmentErrorAssessments;
    const documentParentOutput = normaliseAssignmentRead(documentParentContradiction);
    expect(documentParentOutput!.submissions[0].items[badTask].assessments).toEqual(
      corruptAssessments
    );
    expect(AssignmentFullSchema.safeParse(documentParentOutput).success).toBe(true);

    const noSubmission = currentProbe();
    noSubmission.submissions[0].documentId = null;
    noSubmission.submissions[0].items = {};
    const noSubmissionOutput = normaliseAssignmentRead(noSubmission);
    expect(noSubmissionOutput?.submissions[0].items).toEqual({});
  });

  it('rejects invalid roots and definitions loudly while reserving null for not-found', () => {
    const unsupported = currentProbe();
    unsupported.assessmentContractVersion = 2;
    expect(() => normaliseAssignmentRead(unsupported)).toThrow();
    const missingMarker = currentProbe();
    delete missingMarker.assessmentContractVersion;
    expect(() => normaliseAssignmentRead(missingMarker)).toThrow();
    const invalidDefinition = currentProbe();
    invalidDefinition.tasks = null as unknown as Record<string, RawRecord>;
    expect(() => normaliseAssignmentRead(invalidDefinition)).toThrow();

    const flattenedTasksConflict = currentProbe();
    flattenedTasksConflict.submissions = [];
    flattenedTasksConflict.tasks = {};
    expect.soft(() => normaliseAssignmentRead(flattenedTasksConflict)).toThrow();

    const keyedTaskMismatch = currentProbe();
    keyedTaskMismatch.submissions = [];
    const definitionTasks = keyedTaskMismatch.assignmentDefinition.tasks;
    const [canonicalTaskKey] = Object.keys(definitionTasks);
    const canonicalTask = canonicalTaskKey ? definitionTasks[canonicalTaskKey] : undefined;
    if (!canonicalTaskKey || canonicalTask === undefined) {
      throw new Error('Expected a canonical definition task');
    }
    canonicalTask.id = 'different-task-id';
    keyedTaskMismatch.tasks[canonicalTaskKey].id = 'different-task-id';
    expect.soft(() => normaliseAssignmentRead(keyedTaskMismatch)).toThrow();

    const blankCourseId = currentProbe();
    blankCourseId.submissions = [];
    blankCourseId.courseId = ' ';
    expect.soft(() => normaliseAssignmentRead(blankCourseId)).toThrow();

    const blankAssignmentId = currentProbe();
    blankAssignmentId.submissions = [];
    blankAssignmentId.assignmentId = '';
    expect.soft(() => normaliseAssignmentRead(blankAssignmentId)).toThrow();

    const blankDefinitionKey = currentProbe();
    blankDefinitionKey.submissions = [];
    blankDefinitionKey.assignmentDefinition.definitionKey = '  ';
    expect.soft(() => normaliseAssignmentRead(blankDefinitionKey)).toThrow();
    const sentinel = new Error('programming sentinel');
    const throwingItem = currentProbe();
    const [taskId] = Object.keys(throwingItem.tasks);
    Object.defineProperty(throwingItem.submissions[0].items[taskId], 'artifact', {
      get() {
        throw sentinel;
      },
    });
    expect(() => normaliseAssignmentRead(throwingItem)).toThrow(sentinel);
    expect(normaliseAssignmentRead(null)).toBeNull();
  });

  it('logs safe contextual identifiers and paths without source, reasoning, or names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const input = currentProbe();
      const [taskId] = Object.keys(input.tasks);
      input.submissions[0].items[taskId].assessments.accuracy = {
        score: 'E',
        reasoning: 'private reasoning',
      };
      normaliseAssignmentRead(input);
      const diagnostics = JSON.stringify(warn.mock.calls);
      for (const secret of [
        'private source body',
        'private reasoning',
        'Private Student',
        'submission-doc',
      ]) {
        expect(diagnostics).not.toContain(secret);
      }
      expect(diagnostics).toContain('class-0');
      expect(diagnostics).toContain('assignment-0-0');
      expect(diagnostics).toContain('student-1');
      expect(diagnostics).toContain(taskId);
      expect(diagnostics).toContain('assessments.accuracy');

      const missingHash = currentProbe();
      const [missingHashTask] = Object.keys(missingHash.tasks);
      delete missingHash.submissions[0].items[missingHashTask].artifact.contentHash;
      warn.mockClear();
      expect.soft(() => normaliseAssignmentRead(missingHash)).not.toThrow();
      expect
        .soft(JSON.stringify(warn.mock.calls))
        .toContain(`items.${missingHashTask}.artifact.contentHash`);

      const taskConflict = currentProbe();
      const [conflictTask] = Object.keys(taskConflict.tasks);
      taskConflict.submissions[0].items[conflictTask].artifact.taskId = 'other-task';
      warn.mockClear();
      expect.soft(() => normaliseAssignmentRead(taskConflict)).not.toThrow();
      expect
        .soft(JSON.stringify(warn.mock.calls))
        .toContain(`items.${conflictTask}.artifact.taskId`);

      const extraCriterion = currentProbe();
      const [extraTask] = Object.keys(extraCriterion.tasks);
      extraCriterion.submissions[0].items[extraTask].assessments.formulaComparison = {};
      warn.mockClear();
      expect.soft(() => normaliseAssignmentRead(extraCriterion)).not.toThrow();
      expect
        .soft(JSON.stringify(warn.mock.calls))
        .toContain(`items.${extraTask}.assessments.formulaComparison`);

      const privateCriterionKey = 'PRIVATE_STUDENT_RESPONSE_SENTINEL';
      extraCriterion.submissions[0].items[extraTask].assessments = {
        completeness: { score: 3, reasoning: 'private reasoning' },
        accuracy: { score: 3, reasoning: 'private reasoning' },
        spag: { score: 3, reasoning: 'private reasoning' },
        [privateCriterionKey]: {},
      };
      warn.mockClear();
      expect.soft(() => normaliseAssignmentRead(extraCriterion)).not.toThrow();
      const unexpectedKeyDiagnostics = JSON.stringify(warn.mock.calls);
      expect.soft(unexpectedKeyDiagnostics).not.toContain(privateCriterionKey);
      expect.soft(unexpectedKeyDiagnostics).toContain(`items.${extraTask}.assessments`);
    } finally {
      warn.mockRestore();
    }
  });
});
