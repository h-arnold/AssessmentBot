/**
 * Legacy class-embedded partial read normalisation.
 *
 * Pins the read contract for class assignments whose marker is `'legacy'`
 * rather than `1`: healthy legacy numeric/`N` and explicit `E` results are
 * accepted without the marker-1 reassessment placeholder, per-item corruption
 * is still isolated, and non-array roots keep their existing frontend
 * rejection. Current-format cases stay in
 * `assignmentReadNormalisation.partial.spec.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import smallClassesRaw from '@synthetic/small/classesById.json?raw';
import mediumClassesRaw from '@synthetic/medium/classesById.json?raw';
import * as apiService from '@/services/apiService';
import {
  AssignmentPartialSchema,
  ClassFullSchema,
} from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import {
  allCorrupt,
  criteria,
  twoItemKeys,
  type RawRecord,
  type WireAssignment,
  type WireClass,
} from '@/test/assignmentAssessment/assignmentReadNormalisation.fixtures';
import { normaliseClassRead } from './assignmentReadNormalisation';

const smallClasses = JSON.parse(smallClassesRaw) as Record<string, RawRecord>;
const mediumClasses = JSON.parse(mediumClassesRaw) as Record<string, RawRecord>;

afterEach(() => vi.restoreAllMocks());

/**
 * Clone a canonical class and mark its selected assignment legacy.
 * @param {Record<string, RawRecord>} source - Canonical classes-by-id view.
 * @param {string} assignmentId - Assignment to keep and mark.
 * @returns {WireClass} A detached legacy-marked class probe.
 */
function legacyProbe(source: Record<string, RawRecord>, assignmentId: string): WireClass {
  const result = structuredClone(source['class-0']) as unknown as WireClass;
  const assignment = result.assignments.find((entry) => entry.assignmentId === assignmentId);
  if (!assignment) throw new Error('Canonical class assignment is missing');
  result.assignments = [assignment];
  assignment.assessmentContractVersion = 'legacy';
  return result;
}

/** Finds the selected assignment or fails with a fixture-specific diagnostic.
 * @param {WireClass} input - The class wire payload.
 * @returns {WireAssignment} The selected assignment.
 */
function selectedAssignment(input: WireClass): WireAssignment {
  const assignment = input.assignments[0];
  if (!assignment) throw new Error('Expected assignment');
  return assignment;
}

/** Parses normaliser output before selecting the known assignment.
 * @param {unknown} output - The untrusted normaliser output.
 * @returns {WireAssignment} The validated selected assignment.
 */
function selectedNormalisedAssignment(output: unknown): WireAssignment {
  const parsed = ClassFullSchema.parse(output);
  const assignment = parsed.assignments[0];
  if (!assignment) throw new Error('Expected normalised assignment');
  return assignment;
}

describe('normaliseClassRead legacy partial payload', () => {
  it('accepts healthy legacy numeric/N results without the reassessment placeholder', () => {
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    const original = structuredClone(input);
    const output = normaliseClassRead(input);
    expect(input).toEqual(original);
    const normalised = selectedNormalisedAssignment(output);
    expect(normalised.assessmentContractVersion).toBe('legacy');
    const assignment = selectedAssignment(input);
    const expectedMaps = assignment.submissions.map((entry) => {
      return Object.fromEntries(
        Object.entries(entry.items).map(([taskId, item]) => [taskId, item.assessments])
      );
    });
    expect(
      normalised.submissions.map((entry) => {
        return Object.fromEntries(
          Object.entries(entry.items).map(([taskId, item]) => [taskId, item.assessments])
        );
      })
    ).toEqual(expectedMaps);
    expect(ClassFullSchema.safeParse(output).success).toBe(true);
  });

  it('keeps an explicit valid E entry beside the healthy legacy sibling', () => {
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    const submission = selectedAssignment(input).submissions[0];
    if (!submission) throw new Error('Expected canonical submission');
    const [taskId, siblingId] = twoItemKeys(submission);
    const explicitE = {
      score: 'E',
      reasoning: 'The submitted document could not be accessed.',
      error: { stage: 'acquisition', code: 'SOURCE_UNREADABLE' },
    };
    submission.items[taskId].assessments = Object.fromEntries(
      criteria.map((criterion) => [criterion, explicitE])
    );
    const sibling = structuredClone(submission.items[siblingId].assessments);
    const normalised = selectedNormalisedAssignment(normaliseClassRead(input));
    const items = normalised.submissions[0]?.items;
    if (!items) throw new Error('Expected normalised items');
    expect(items[taskId].assessments).toEqual(
      Object.fromEntries(criteria.map((criterion) => [criterion, explicitE]))
    );
    expect(items[siblingId].assessments).toEqual(sibling);
    expect(AssignmentPartialSchema.safeParse(normalised).success).toBe(true);
  });

  it('isolates a corrupt legacy item without harming its healthy sibling', () => {
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    const submission = selectedAssignment(input).submissions[0];
    if (!submission) throw new Error('Expected canonical submission');
    const [corruptTask, healthyTask] = twoItemKeys(submission);
    // A task/artefact identity mismatch is invalid but not a placeholder.
    submission.items[corruptTask].taskId = healthyTask;
    const expectedHealthy = ClassFullSchema.parse(structuredClone(input)).assignments[0]!
      .submissions[0]!.items[healthyTask];
    const normalised = selectedNormalisedAssignment(normaliseClassRead(input));
    const items = normalised.submissions[0]?.items;
    if (!items) throw new Error('Expected normalised items');
    expect(items[corruptTask].assessments).toEqual(allCorrupt());
    expect(items[healthyTask]).toEqual(expectedHealthy);
    expect(AssignmentPartialSchema.safeParse(normalised).success).toBe(true);
  });

  it('keeps marker-1 per-item isolation unchanged as a regression', () => {
    const input = structuredClone(smallClasses['class-0']) as unknown as WireClass;
    const assignment = input.assignments.find((entry) => entry.assignmentId === 'assignment-0-1');
    if (!assignment) throw new Error('Canonical class assignment is missing');
    input.assignments = [assignment];
    assignment.assessmentContractVersion = 1;
    const [corruptTask, healthyTask] = Object.keys(assignment.submissions[0]!.items);
    if (!corruptTask || !healthyTask) throw new Error('Expected two canonical tasks');
    assignment.submissions[0]!.items[corruptTask].artifact.role = 'reference';
    const expectedHealthy = ClassFullSchema.parse(structuredClone(input)).assignments[0]!
      .submissions[0]!.items[healthyTask];
    const normalised = selectedNormalisedAssignment(normaliseClassRead(input));
    const items = normalised.submissions[0]?.items;
    if (!items) throw new Error('Expected normalised items');
    expect(items[corruptTask].assessments).toEqual(allCorrupt());
    expect(items[healthyTask]).toEqual(expectedHealthy);
  });

  it('accepts healthy legacy items on the canonical mixed healthy/E class assignment', () => {
    const input = legacyProbe(mediumClasses, 'assignment-0-2');
    const assignment = selectedAssignment(input);
    const documentSubmission = assignment.submissions.find((entry) => entry.documentId !== null);
    if (!documentSubmission) throw new Error('Expected a document-bearing submission');
    const expectedMaps = Object.fromEntries(
      Object.entries(documentSubmission.items).map(([taskId, item]) => [taskId, item.assessments])
    );
    const normalised = selectedNormalisedAssignment(normaliseClassRead(input));
    const target = normalised.submissions.find(
      (entry) => entry.studentId === documentSubmission.studentId
    );
    if (!target) throw new Error('Expected the healthy submission');
    expect(
      Object.fromEntries(
        Object.entries(target.items).map(([taskId, item]) => [taskId, item.assessments])
      )
    ).toEqual(expectedMaps);
    expect(AssignmentPartialSchema.safeParse(normalised).success).toBe(true);
  });

  it('accepts backend-prepared redacted bodies under a full definition key without corruption', () => {
    // The backend validates a full-definition class record as full and
    // serialises partial output with redacted bodies; the frontend accepts the
    // prepared output instead of re-demanding content the class read redacts.
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    const submission = selectedAssignment(input).submissions.find(
      (entry) => entry.documentId !== null
    );
    if (!submission) throw new Error('Expected a document-bearing submission');
    const [taskId, siblingId] = Object.keys(submission.items);
    if (!taskId || !siblingId) throw new Error('Expected two canonical tasks');
    for (const item of [submission.items[taskId], submission.items[siblingId]]) {
      item.artifact.content = null;
      item.artifact.contentHash = null;
    }
    const normalised = selectedNormalisedAssignment(normaliseClassRead(input));
    const items = normalised.submissions.find(
      (entry) => entry.studentId === submission.studentId
    )?.items;
    if (!items) throw new Error('Expected normalised items');
    expect(items[taskId].assessments).toEqual(submission.items[taskId].assessments);
    expect(items[siblingId].assessments).toEqual(submission.items[siblingId].assessments);
    expect(AssignmentPartialSchema.safeParse(normalised).success).toBe(true);
  });

  it('normalises only provided entries without inferring absent tasks for legacy', () => {
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    const assignment = selectedAssignment(input);
    const submission = assignment.submissions[0];
    if (!submission) throw new Error('Expected a canonical submission');
    const [retained, absent] = twoItemKeys(submission);
    delete submission.items[absent];
    const providedTaskIds = assignment.submissions.map((entry) => Object.keys(entry.items));
    const transport = vi.spyOn(apiService, 'callApi');
    const normalised = selectedNormalisedAssignment(normaliseClassRead(input));
    expect(normalised.submissions.map((entry) => Object.keys(entry.items))[0]).toEqual([retained]);
    for (const [index, entry] of normalised.submissions.entries()) {
      expect(Object.keys(entry.items)).toEqual(providedTaskIds[index]);
    }
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['unsupported zero', 0],
    ['unsupported draft', 'draft'],
  ])('rejects a %s legacy marker', (_label, marker) => {
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    selectedAssignment(input).assessmentContractVersion = marker;
    expect(() => normaliseClassRead(input)).toThrow();
  });

  it('rejects an absent version marker', () => {
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    delete selectedAssignment(input).assessmentContractVersion;
    expect(() => normaliseClassRead(input)).toThrow();
  });

  it('rejects a non-array partial submissions root while preserving not-found null', () => {
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    (selectedAssignment(input) as { submissions: unknown }).submissions = { 'task-1-0': {} };
    expect(() => normaliseClassRead(input)).toThrow('Invalid partial submissions');
    expect(normaliseClassRead(null)).toBeNull();
  });

  it('reports the submissions root before the version parse when both are invalid', () => {
    // Both checks fail here, so the message pins the order: the submissions
    // array is examined before the version-bearing parse.
    const input = legacyProbe(smallClasses, 'assignment-0-1');
    const assignment = selectedAssignment(input) as {
      submissions: unknown;
      assessmentContractVersion: unknown;
    };
    assignment.assessmentContractVersion = null;
    assignment.submissions = { 'task-1-0': {} };
    expect(() => normaliseClassRead(input)).toThrow('Invalid partial submissions');
  });

  it('rejects a non-record class root while preserving not-found null', () => {
    // The class root schema rejects non-record roots before any assignment is
    // read; null stays the reserved not-found result.
    expect(() => normaliseClassRead(['class-0'])).toThrow();
    expect(() => normaliseClassRead('class-0')).toThrow();
    expect(normaliseClassRead(null)).toBeNull();
  });
});
