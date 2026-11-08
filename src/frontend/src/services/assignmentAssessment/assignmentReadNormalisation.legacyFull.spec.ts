/**
 * Legacy full-assignment read normalisation.
 *
 * Pins the read contract for assignments whose marker is `'legacy'` rather than
 * `1`: healthy legacy numeric/`N` and explicit `E` results are accepted without
 * the marker-1 reassessment placeholder, per-item corruption is still isolated,
 * and the browser-side missing-task coverage does not materialise for legacy
 * reads. Current-format cases stay in `assignmentReadNormalisation.full.spec.ts`.
 */

import { describe, expect, it } from 'vitest';
import smallAssignmentsRaw from '@synthetic/small/assignmentsByKey.json?raw';
import mediumAssignmentsRaw from '@synthetic/medium/assignmentsByKey.json?raw';
import {
  allCorrupt,
  criteria,
  twoItemKeys,
  type RawAssignment,
  type RawRecord,
} from '@/test/assignmentAssessment/assignmentReadNormalisation.fixtures';
import { UNSUPPORTED_MARKERS } from '@/test/assignmentAssessment/assignmentAssessment.zod.fixtures';
import { AssignmentFullSchema } from './assignmentAssessment.zod';
import { normaliseAssignmentRead } from './assignmentReadNormalisation';

const smallSource = JSON.parse(smallAssignmentsRaw) as Record<string, RawRecord>;
const mediumSource = JSON.parse(mediumAssignmentsRaw) as Record<string, RawRecord>;

/**
 * Clone the canonical healthy full assignment and mark it legacy.
 * @returns {RawAssignment} A detached legacy-marked healthy assignment.
 */
function legacyProbe(): RawAssignment {
  const result = structuredClone(smallSource['assignment-0-1']) as unknown as RawAssignment;
  result.assessmentContractVersion = 'legacy';
  return result;
}

describe('normaliseAssignmentRead legacy full payload', () => {
  it('accepts healthy legacy numeric/N results without the reassessment placeholder', () => {
    const input = legacyProbe();
    const original = structuredClone(input);
    const output = normaliseAssignmentRead(input);
    expect(input).toEqual(original);
    expect(output).not.toBeNull();
    if (output === null) throw new Error('Expected a legacy assignment');
    expect(output.assessmentContractVersion).toBe('legacy');
    expect(output.submissions).toEqual(input.submissions);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
  });

  it('keeps an explicit valid E entry while accepting its healthy sibling', () => {
    const input = legacyProbe();
    const [firstSubmission] = input.submissions;
    if (!firstSubmission) throw new Error('Expected canonical submissions');
    const [taskId, siblingId] = twoItemKeys(firstSubmission);
    const explicitE = {
      score: 'E',
      reasoning: 'The assessment service rejected the request.',
      error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
    };
    firstSubmission.items[taskId].assessments = Object.fromEntries(
      criteria.map((criterion) => [criterion, explicitE])
    );
    const sibling = structuredClone(firstSubmission.items[siblingId].assessments);
    const output = normaliseAssignmentRead(input);
    expect(output).not.toBeNull();
    if (output === null) throw new Error('Expected a legacy assignment');
    const resultItems = output.submissions[0]?.items;
    if (!resultItems) throw new Error('Expected normalised items');
    expect(resultItems[taskId].assessments).toEqual(
      Object.fromEntries(criteria.map((criterion) => [criterion, explicitE]))
    );
    expect(resultItems[siblingId].assessments).toEqual(sibling);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
  });

  it('isolates a corrupt legacy item on both output forms without touching healthy siblings', () => {
    const input = legacyProbe();
    const [firstSubmission] = input.submissions;
    if (!firstSubmission) throw new Error('Expected canonical submissions');
    const [corruptTask, healthyTask] = twoItemKeys(firstSubmission);
    // A non-placeholder invalid criterion must be isolated, not blanket-replaced.
    firstSubmission.items[corruptTask].assessments.accuracy = { score: 'E', reasoning: 'bad' };
    const healthy = structuredClone(firstSubmission.items[healthyTask]);
    const output = normaliseAssignmentRead(input);
    expect(output).not.toBeNull();
    if (output === null) throw new Error('Expected a legacy assignment');
    const resultItems = output.submissions[0]?.items;
    if (!resultItems) throw new Error('Expected normalised items');
    expect(resultItems[corruptTask].assessments).toEqual(allCorrupt());
    expect(resultItems[healthyTask]).toEqual(healthy);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
  });

  it('does not materialise missing known-task coverage for a legacy read', () => {
    const input = legacyProbe();
    const [firstSubmission] = input.submissions;
    if (!firstSubmission) throw new Error('Expected canonical submissions');
    const [remainingTask, missingTask] = twoItemKeys(firstSubmission);
    delete firstSubmission.items[missingTask];
    const original = structuredClone(input);
    const output = normaliseAssignmentRead(input);
    expect(input).toEqual(original);
    expect(output).not.toBeNull();
    if (output === null) throw new Error('Expected a legacy assignment');
    const resultItems = output.submissions[0]?.items;
    if (!resultItems) throw new Error('Expected normalised items');
    // The browser-side fallback is marker-1 only; legacy coverage is backend-owned.
    expect(Object.keys(resultItems)).toEqual([remainingTask]);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
  });

  it('keeps marker-1 missing-task coverage unchanged as a regression', () => {
    const input = structuredClone(smallSource['assignment-0-1']) as unknown as RawAssignment;
    input.assessmentContractVersion = 1;
    const [firstSubmission] = input.submissions;
    if (!firstSubmission) throw new Error('Expected canonical submissions');
    const [, missingTask] = twoItemKeys(firstSubmission);
    delete firstSubmission.items[missingTask];
    const output = normaliseAssignmentRead(input);
    expect(output?.submissions[0]?.items[missingTask].assessments).toEqual(allCorrupt());
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
  });

  it('isolates a corrupt legacy item from the canonical mixed healthy/E assignment', () => {
    const input = structuredClone(mediumSource['assignment-0-2']) as unknown as RawAssignment;
    input.assessmentContractVersion = 'legacy';
    const [healthySubmission, failedSubmission] = input.submissions;
    if (!healthySubmission || !failedSubmission) throw new Error('Expected mixed submissions');
    const [corruptTask, healthyTask] = twoItemKeys(healthySubmission);
    healthySubmission.items[corruptTask].artifact.role = 'reference';
    const healthy = structuredClone(healthySubmission.items[healthyTask]);
    const failedItems = structuredClone(failedSubmission.items);
    const output = normaliseAssignmentRead(input);
    expect(output).not.toBeNull();
    if (output === null) throw new Error('Expected a legacy assignment');
    const [healthyOutput, failedOutput] = output.submissions;
    if (!healthyOutput || !failedOutput) throw new Error('Expected normalised submissions');
    expect(healthyOutput.items[corruptTask].assessments).toEqual(allCorrupt());
    expect(healthyOutput.items[healthyTask]).toEqual(healthy);
    // The canonical assessment-failure E entries survive legacy preparation.
    expect(failedOutput.items).toEqual(failedItems);
    expect(AssignmentFullSchema.safeParse(output).success).toBe(true);
  });

  it.each([null, ...UNSUPPORTED_MARKERS])('rejects a %s legacy marker', (marker) => {
    const input = legacyProbe();
    input.assessmentContractVersion = marker;
    expect(() => normaliseAssignmentRead(input)).toThrow();
  });

  it('rejects an absent version marker', () => {
    const input = legacyProbe();
    delete input.assessmentContractVersion;
    expect(() => normaliseAssignmentRead(input)).toThrow();
  });

  it('rejects a non-array submissions root while reserving root null for not-found', () => {
    const input = legacyProbe();
    (input as { submissions: unknown }).submissions = { 'task-1-0': {} };
    expect(() => normaliseAssignmentRead(input)).toThrow('Invalid assignment submissions root');
    expect(normaliseAssignmentRead(null)).toBeNull();
  });
});
