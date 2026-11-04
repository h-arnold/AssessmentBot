import { afterEach, describe, expect, it, vi } from 'vitest';
import smallClassesRaw from '@synthetic/small/classesById.json?raw';
import * as apiService from '@/services/apiService';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { normaliseClassRead } from './assignmentReadNormalisation';

type Raw = Record<string, unknown>;
type WireItem = {
  id: string;
  taskId: string;
  artifact: Raw;
  assessments?: Raw;
  feedback?: Raw;
};
type WireSubmission = {
  studentId: string;
  studentName: string | null;
  assignmentId: string;
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
  items: Record<string, WireItem>;
};
type WireAssignment = Raw & {
  assignmentId: string;
  assessmentContractVersion?: unknown;
  submissions: WireSubmission[];
};
type WireClass = Raw & { assignments: WireAssignment[] };

const classes = JSON.parse(smallClassesRaw) as Record<string, Raw>;
const canonical = structuredClone(classes['class-0']) as unknown as WireClass;
const criteria = ['completeness', 'accuracy', 'spag'] as const;
const corruptResult = {
  score: 'E',
  reasoning: 'The stored assessment data for this task is invalid. Reassess the assignment.',
  error: { stage: 'validation', code: 'CORRUPT_RECORD' },
};

/** Clones the canonical class and adapts the selected real two-task assignment.
 * @returns {WireClass} A mutable version-1 class probe.
 */
function probe(): WireClass {
  const result = structuredClone(canonical);
  const assignment = result.assignments.find((entry) => entry.assignmentId === 'assignment-0-1');
  if (!assignment) throw new Error('Canonical class assignment is missing');
  result.assignments = [assignment];
  assignment.assessmentContractVersion = 1;
  assignment.submissions = assignment.submissions.filter((submission) => {
    return (
      submission.studentId === '100000000000000000000' ||
      submission.studentId === '100000000000000000002'
    );
  });
  for (const submission of assignment.submissions) {
    for (const item of Object.values(submission.items)) {
      const hasDocument = submission.documentId !== null;
      item.assessments = hasDocument
        ? {
            completeness: { score: 1 },
            accuracy: { score: 2 },
            spag: { score: 'N' },
          }
        : Object.fromEntries(
            criteria.map((key) => {
              return [
                key,
                {
                  score: 'E',
                  reasoning: 'The submitted document could not be accessed.',
                  error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
                },
              ];
            })
          );
      if (hasDocument) continue;
      item.artifact = {
        ...item.artifact,
        type: 'base',
        role: 'submission',
        pageId: null,
        documentId: null,
        content: null,
        contentHash: null,
        metadata: {},
      };
      item.feedback = {};
    }
  }
  return result;
}

afterEach(() => vi.restoreAllMocks());

/** Builds the expected all-criterion corruption replacement.
 * @returns {Record<string, typeof corruptResult>} The catalogue corruption result for each criterion.
 */
function allCorrupt() {
  return {
    completeness: corruptResult,
    accuracy: corruptResult,
    spag: corruptResult,
  };
}

/** Finds the selected assignment or fails with a fixture-specific diagnostic.
 * @param {WireClass} input - The class wire payload.
 * @returns {WireAssignment} The selected assignment.
 */
function selectedAssignment(input: WireClass): WireAssignment {
  const assignment = input.assignments.find((entry) => entry.assignmentId === 'assignment-0-1');
  if (!assignment) throw new Error('Expected assignment');
  return assignment;
}

/** Parses normaliser output before selecting the known assignment.
 * @param {unknown} output - The untrusted normaliser output.
 * @returns {WireAssignment} The validated selected assignment.
 */
function selectedNormalisedAssignment(output: unknown): WireAssignment {
  const parsed = ClassFullSchema.parse(output);
  const assignment: WireAssignment | undefined = parsed.assignments.find(
    (entry) => entry.assignmentId === 'assignment-0-1'
  );
  if (!assignment) throw new Error('Expected normalised assignment');
  return assignment;
}

/** Verifies malformed criterion data is isolated from a canonical task sibling. */
function assertMalformedCriterionIsolation(): void {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const input = probe();
  const submission = selectedAssignment(input).submissions[0];
  if (!submission) throw new Error('Expected document-bearing submission');
  const [badCriterion, healthy] = Object.entries(submission.items);
  if (!badCriterion || !healthy) throw new Error('Expected two canonical tasks');
  badCriterion[1].assessments = {
    ...badCriterion[1].assessments,
    spag: {
      score: 'E',
      reasoning: 'bad',
      error: { stage: 'assessment', code: 'SOURCE_UNREADABLE' },
    },
  };
  const output = normaliseClassRead(input);
  const resultItems = selectedNormalisedAssignment(output).submissions[0]?.items;
  if (!resultItems) throw new Error('Expected normalised submission items');
  expect(resultItems[badCriterion[0]].assessments).toEqual(allCorrupt());
  expect(resultItems[healthy[0]].assessments).toEqual(healthy[1].assessments);
  const taskConflict = probe();
  const [taskKey, taskItem] = Object.entries(
    selectedAssignment(taskConflict).submissions[0]!.items
  )[0]!;
  taskItem.taskId = 'other-task';
  warn.mockClear();
  expect.soft(() => normaliseClassRead(taskConflict)).not.toThrow();
  expect.soft(JSON.stringify(warn.mock.calls)).toContain(`items.${taskKey}.taskId`);
  const extraCriterion = probe();
  const [criterionKey, criterionItem] = Object.entries(
    selectedAssignment(extraCriterion).submissions[0]!.items
  )[0]!;
  const privateCriterionKey = 'PRIVATE_STUDENT_RESPONSE_SENTINEL';
  criterionItem.assessments = { ...criterionItem.assessments, [privateCriterionKey]: {} };
  delete criterionItem.artifact.contentHash;
  delete criterionItem.artifact.content;
  warn.mockClear();
  expect.soft(() => normaliseClassRead(extraCriterion)).not.toThrow();
  const unexpectedKeyDiagnostics = JSON.stringify(warn.mock.calls);
  expect.soft(unexpectedKeyDiagnostics).not.toContain(privateCriterionKey);
  expect.soft(unexpectedKeyDiagnostics).toContain(`items.${criterionKey}.assessments`);
  expect.soft(unexpectedKeyDiagnostics).not.toContain('contentHash');
  warn.mockRestore();
}
/** Verifies task identity isolation. */
function assertTaskIdentityIsolation(): void {
  const input = probe();
  const submission = selectedAssignment(input).submissions[0];
  if (!submission) throw new Error('Expected document-bearing submission');
  const [mismatched, healthy] = Object.entries(submission.items);
  if (!mismatched || !healthy) throw new Error('Expected two canonical tasks');
  mismatched[1].taskId = healthy[0];
  const output = normaliseClassRead(input);
  const resultItems = selectedNormalisedAssignment(output).submissions[0]?.items;
  if (!resultItems) throw new Error('Expected normalised submission items');
  expect(resultItems[mismatched[0]].assessments).toEqual(allCorrupt());
  expect(resultItems[healthy[0]].assessments).toEqual(healthy[1].assessments);
}
/** Verifies partial normalisation retains only supplied entries without fetching more data. */
function assertProvidedEntryOnly(): void {
  const input = probe();
  const assignment = selectedAssignment(input);
  const providedStudentIds = assignment.submissions.map((entry) => entry.studentId);
  const submission = assignment.submissions.find((entry) => entry.documentId === null);
  if (!submission) throw new Error('Expected existing null-document submission');
  const [retained, absent] = Object.keys(submission.items);
  if (!retained || !absent) throw new Error('Expected canonical items');
  delete submission.items[absent];
  const providedTaskIds = new Map(
    assignment.submissions.map((entry) => [entry.studentId, Object.keys(entry.items)])
  );
  const redacted = submission.items[retained];
  redacted.artifact.content = null;
  redacted.artifact.contentHash = null;
  const transport = vi.spyOn(apiService, 'callApi');
  const output = normaliseClassRead(input);
  const normalised = selectedNormalisedAssignment(output);
  const result = normalised.submissions.find(
    (entry) => entry.studentId === submission.studentId
  )?.items;
  if (!result) throw new Error('Expected normalised submission items');
  expect(normalised.submissions.map((entry) => entry.studentId)).toEqual(providedStudentIds);
  for (const entry of normalised.submissions) {
    expect(Object.keys(entry.items)).toEqual(providedTaskIds.get(entry.studentId));
  }
  expect(Object.keys(result)).toEqual([retained]);
  expect(result[retained].assessments).toEqual(redacted.assessments);
  assertRawRedaction(output, submission.studentId, retained);
  expect(transport).not.toHaveBeenCalled();
}
/** Checks raw output fields.
 * @param {unknown} output - The normaliser's unparsed result.
 * @param {string} studentId - The provided student's identity.
 * @param {string} taskId - The retained task key.
 */
function assertRawRedaction(output: unknown, studentId: string, taskId: string): void {
  const raw = output as {
    assignments: Array<{
      submissions: Array<{ studentId: string; items: Record<string, unknown> }>;
    }>;
  };
  const rawSubmission = raw.assignments[0]!.submissions.find(
    (entry) => entry.studentId === studentId
  );
  if (!rawSubmission) throw new Error('Expected raw provided submission');
  const rawItem = rawSubmission.items[taskId] as
    { artifact?: { content?: unknown; contentHash?: unknown } } | undefined;
  if (!rawItem?.artifact) throw new Error('Expected retained raw item artefact');
  expect(rawItem.artifact.content == null).toBe(true);
  expect(rawItem.artifact.contentHash == null).toBe(true);
  expect(Object.keys(rawSubmission.items)).toEqual([taskId]);
}
describe('normaliseClassRead partial payload', () => {
  it('preserves score-only numeric/fractional/N results and materialised E without mutating input', () => {
    const input = probe();
    const assignment = selectedAssignment(input);
    const submission = assignment.submissions[0];
    const [first, second] = Object.values(submission.items);
    if (!first || !second) throw new Error('Expected two canonical tasks');
    first.assessments = {
      completeness: { score: 1.5 },
      accuracy: { score: 'N' },
      spag: { score: 0 },
    };
    second.assessments = Object.fromEntries(
      criteria.map((key) => {
        return [
          key,
          {
            score: 'E',
            reasoning: 'The assessment service rejected the request.',
            error: { stage: 'assessment', code: 'LLM_HTTP_FAILED' },
          },
        ];
      })
    );
    submission.studentName = null;
    const expectedMaps = Object.fromEntries(
      Object.entries(submission.items).map(([id, item]) => [id, structuredClone(item.assessments)])
    );
    const original = structuredClone(input);
    const output = normaliseClassRead(input);
    expect(input).toEqual(original);
    const normalised = selectedNormalisedAssignment(output);
    expect(normalised.assessmentContractVersion).toBe(1);
    expect(normalised.submissions[0]?.studentName).toBeNull();
    expect(
      Object.fromEntries(
        Object.entries(normalised.submissions[0]!.items).map(([id, item]) => [id, item.assessments])
      )
    ).toEqual(expectedMaps);

    const unmarked = structuredClone(assignment);
    unmarked.assessmentContractVersion = null;
    const documentSubmission = unmarked.submissions.find((entry) => entry.documentId !== null);
    unmarked.submissions = [documentSubmission!];
    const nonReassessmentMap = structuredClone(
      Object.values(documentSubmission!.items)[1]!.assessments
    );
    const [nonReassessmentTask] = Object.keys(documentSubmission!.items);
    if (!nonReassessmentTask) throw new Error('Expected a canonical task');
    documentSubmission!.items[nonReassessmentTask].assessments = {
      completeness: { score: 1 },
      accuracy: { score: 2 },
      spag: { score: 'N' },
    };
    documentSubmission!.items[Object.keys(documentSubmission!.items)[1]!].assessments =
      nonReassessmentMap;
    const unmarkedOutput = selectedNormalisedAssignment(
      normaliseClassRead({ ...structuredClone(input), assignments: [unmarked] })
    );
    expect(unmarkedOutput.assessmentContractVersion).toBeNull();
    const unmarkedAssessmentMaps = unmarkedOutput.submissions.flatMap((entry) =>
      Object.values(entry.items).map((item) => item.assessments)
    );
    expect.soft(unmarkedAssessmentMaps).toEqual([allCorrupt(), allCorrupt()]);

    const legacy = structuredClone(assignment);
    legacy.assessmentContractVersion = null;
    const reassessment = {
      score: 'E',
      reasoning: 'Reassessment required',
      error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' },
    };
    for (const entry of legacy.submissions) {
      for (const item of Object.values(entry.items)) {
        item.artifact = {
          ...item.artifact,
          type: 'base',
          role: 'submission',
          content: null,
          contentHash: null,
          documentId: null,
          pageId: null,
          metadata: {},
        };
        item.feedback = {};
        item.assessments = Object.fromEntries(criteria.map((key) => [key, reassessment]));
      }
    }
    const legacyInput = { ...structuredClone(input), assignments: [legacy] };
    const legacyExpected = legacy.submissions.map((entry) => {
      return Object.fromEntries(
        Object.entries(entry.items).map(
          ([taskId, item]) => [taskId, structuredClone(item.assessments)] as const
        )
      );
    });
    const legacyOutput = selectedNormalisedAssignment(normaliseClassRead(legacyInput));
    expect(legacyOutput.assessmentContractVersion).toBeNull();
    expect(
      legacyOutput.submissions.map((entry) => {
        return Object.fromEntries(
          Object.entries(entry.items).map(([taskId, item]) => [taskId, item.assessments])
        );
      })
    ).toEqual(legacyExpected);
  });

  it('isolates malformed criteria and a dictionary-key identity mismatch without harming a sibling', () => {
    assertMalformedCriterionIsolation();
    assertTaskIdentityIsolation();

    const [taskId, healthyTask] = Object.keys(selectedAssignment(probe()).submissions[0]!.items);
    if (!taskId || !healthyTask) throw new Error('Expected canonical tasks');
    const expectedHealthy =
      ClassFullSchema.parse(probe()).assignments[0]!.submissions[0]!.items[healthyTask];
    const wrongArtifactTask = probe();
    selectedAssignment(wrongArtifactTask).submissions[0]!.items[taskId].artifact.taskId =
      healthyTask;
    const wrongArtifactRole = probe();
    selectedAssignment(wrongArtifactRole).submissions[0]!.items[taskId].artifact.role = 'reference';
    const blankArtifactUid = probe();
    selectedAssignment(blankArtifactUid).submissions[0]!.items[taskId].artifact.uid = ' ';
    const unsupportedArtifactType = probe();
    selectedAssignment(unsupportedArtifactType).submissions[0]!.items[taskId].artifact.type =
      'UNKNOWN';
    for (const input of [
      wrongArtifactTask,
      wrongArtifactRole,
      blankArtifactUid,
      unsupportedArtifactType,
    ]) {
      expect
        .soft(() => {
          const output = normaliseClassRead(input);
          const items = selectedNormalisedAssignment(output).submissions[0]!.items;
          expect(items[taskId].assessments).toEqual(allCorrupt());
          expect(items[healthyTask]).toEqual(expectedHealthy);
        })
        .not.toThrow();
    }
  });

  it('does not treat partial redaction as unavailable or infer absent tasks from roster or registry', () => {
    assertProvidedEntryOnly();
  });

  it('isolates null-parent contradictions while preserving canonical acquisition errors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = probe();
    const assignment = selectedAssignment(input);
    const submission = assignment.submissions.find((entry) => entry.documentId !== null);
    if (!submission) throw new Error('Expected document-bearing submission');
    const [badId, controlId] = Object.keys(submission.items);
    if (!badId || !controlId) throw new Error('Expected canonical items');
    submission.documentId = null;
    submission.items[badId].assessments = Object.fromEntries(
      criteria.map((key) => [key, { score: 2 }])
    );
    const control = submission.items[controlId];
    control.artifact = {
      ...control.artifact,
      type: 'base',
      role: 'submission',
      documentId: null,
      pageId: null,
      content: null,
      contentHash: null,
      metadata: {},
    };
    control.feedback = {};
    control.assessments = Object.fromEntries(
      criteria.map((key) => {
        return [
          key,
          {
            score: 'E',
            reasoning: 'The submitted document could not be accessed.',
            error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
          },
        ];
      })
    );
    const output = normaliseClassRead(input);
    const result = selectedNormalisedAssignment(output).submissions[0];
    if (!result) throw new Error('Expected normalised submission');
    expect.soft(result.items[badId].assessments).toEqual(allCorrupt());
    expect.soft(result.items[badId].artifact).toMatchObject({
      type: 'base',
      role: 'submission',
      documentId: null,
      pageId: null,
      metadata: {},
    });
    expect.soft(result.items[badId].feedback).toEqual({});
    expect(result.items[controlId].assessments).toEqual(
      Object.fromEntries(
        criteria.map((key) => {
          return [
            key,
            {
              score: 'E',
              reasoning: 'The submitted document could not be accessed.',
              error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
            },
          ];
        })
      )
    );
    warn.mockClear();
    const repairedAgain = normaliseClassRead(output);
    expect.soft(repairedAgain).toEqual(output);
    expect.soft(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rejects malformed roots, marker and identities, while preserving not-found null', () => {
    const unsupported = probe();
    selectedAssignment(unsupported).assessmentContractVersion = 2;
    expect(() => normaliseClassRead(unsupported)).toThrow();
    const missingMarker = probe();
    delete selectedAssignment(missingMarker).assessmentContractVersion;
    expect(() => normaliseClassRead(missingMarker)).toThrow();
    const badIdentity = probe();
    selectedAssignment(badIdentity).submissions[0]!.studentId = '';
    expect(() => normaliseClassRead(badIdentity)).toThrow();
    const validBaseline = normaliseClassRead(probe());
    expect(ClassFullSchema.safeParse(validBaseline).success).toBe(true);
    const blankTaskKey = probe();
    const submission = selectedAssignment(blankTaskKey).submissions[0]!;
    const [taskKey, item] = Object.entries(submission.items)[0]!;
    delete submission.items[taskKey];
    submission.items[''] = { ...item, taskId: '' };
    expect.soft(() => expect(() => normaliseClassRead(blankTaskKey)).toThrow()).not.toThrow();
    expect(() => normaliseClassRead({ ...probe(), className: undefined })).toThrow();
    const missingMetadata = probe();
    delete missingMetadata.metadata;
    expect(() => normaliseClassRead(missingMetadata)).toThrow();
    const malformedMetadata = probe();
    malformedMetadata.metadata = {};
    expect(() => normaliseClassRead(malformedMetadata)).toThrow();

    const blankClassId = probe();
    blankClassId.classId = ' ';
    expect.soft(() => normaliseClassRead(blankClassId)).toThrow();

    const blankAssignmentId = probe();
    const blankAssignment = selectedAssignment(blankAssignmentId);
    blankAssignment.assignmentId = '';
    for (const submission of blankAssignment.submissions) {
      submission.assignmentId = blankAssignment.assignmentId;
    }
    expect.soft(() => normaliseClassRead(blankAssignmentId)).toThrow();

    const blankDefinitionKey = probe();
    selectedAssignment(blankDefinitionKey).assignmentDefinitionKey = '  ';
    expect.soft(() => normaliseClassRead(blankDefinitionKey)).toThrow();
    expect(normaliseClassRead(null)).toBeNull();
  });
});
