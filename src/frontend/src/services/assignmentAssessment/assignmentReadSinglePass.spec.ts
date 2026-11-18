/**
 * Single-pass item validation contract for the assignment and class reads.
 *
 * Pins the #349 contract: across a whole `getABClass` / `getAssignment` call,
 * each submission item receives exactly one item-schema evaluation attempt, with
 * the expected outcome mix (valid → one success; schema-corrupt → one failure and
 * no success; contextually corrupt → one success followed by contextual
 * rejection). A stored `__proto__` item key must be dropped before any item
 * evaluation.
 *
 * The counting is test-only: the schema modules are rebuilt around an
 * attempt-recording wrapper (see `itemSchemaEvaluationCounter`), so no production
 * code exists to support these assertions.
 *
 * The existing `assignmentReadNormalisation.*.spec.ts` suites,
 * `classDetailService.spec.ts` and `assignmentAssessmentService.spec.ts` remain
 * the output-equivalence contract and are deliberately not modified here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import smallAssignmentsRaw from '@synthetic/small/assignmentsByKey.json?raw';
import smallClassesRaw from '@synthetic/small/classesById.json?raw';
import {
  itemSchemaEvaluationCount,
  itemSchemaKey,
  itemSchemaTally,
  resetItemSchemaEvaluations,
  type ItemEvaluationTally,
} from '@/test/assignmentAssessment/itemSchemaEvaluationCounter';
import type {
  RawAssignment,
  RawRecord,
  WireAssignment,
  WireClass,
} from '@/test/assignmentAssessment/assignmentReadNormalisation.fixtures';
import type * as ApiServiceModule from '@/services/apiService';
import type * as ClassDetailSchemas from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type * as AssignmentAssessmentSchemas from './assignmentAssessment.zod';
import { getAssignment } from './assignmentAssessmentService';
import { getABClass } from '@/services/googleClassrooms/classDetail/classDetailService';

const CLASS_ASSIGNMENT_ID = 'assignment-0-1';
const PROTO_ITEM_KEY = '__proto__::item-proto';

const callApiMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiServiceModule>();
  return { ...actual, callApi: callApiMock };
});

vi.mock('./assignmentAssessment.zod', async (importOriginal) => {
  const actual = await importOriginal<typeof AssignmentAssessmentSchemas>();
  const { rebuildFullReadSchemas } =
    await import('@/test/assignmentAssessment/itemSchemaEvaluationCounter');
  return { ...actual, ...rebuildFullReadSchemas(actual) };
});

vi.mock(
  '@/services/googleClassrooms/classDetail/classDetailService.zod',
  async (importOriginal) => {
    const actual = await importOriginal<typeof ClassDetailSchemas>();
    const { rebuildPartialReadSchemas } =
      await import('@/test/assignmentAssessment/itemSchemaEvaluationCounter');
    return { ...actual, ...rebuildPartialReadSchemas(actual) };
  }
);

const classes = JSON.parse(smallClassesRaw) as Record<string, RawRecord>;
const assignments = JSON.parse(smallAssignmentsRaw) as Record<string, RawRecord>;

/** One item identity plus its mutable wire record. */
type ItemReference = {
  key: string;
  item: Record<string, unknown>;
};

type Submission = WireAssignment['submissions'][number];

/** A class probe carrying an own `__proto__` item key beside legitimate items. */
type UnsafeKeyProbe = {
  input: WireClass;
  studentId: string;
  references: ItemReference[];
  legitimateKeys: string[];
};

/** Compares strings alphabetically for deterministic tally ordering.
 * @param {string} left - Left value.
 * @param {string} right - Right value.
 * @returns {number} Locale comparison result.
 */
function alphabetical(left: string, right: string): number {
  return left.localeCompare(right);
}

/** Returns a detached canonical class probe.
 * @returns {WireClass} A mutable small-profile class view.
 */
function classProbe(): WireClass {
  const source = classes['class-0'];
  if (!source) throw new Error('Expected canonical small class-0');
  return structuredClone(source) as unknown as WireClass;
}

/** Returns a detached canonical full assignment probe.
 * @returns {RawAssignment} A mutable small-profile full assignment.
 */
function assignmentProbe(): RawAssignment {
  const source = assignments[CLASS_ASSIGNMENT_ID];
  if (!source) throw new Error('Expected canonical small assignment-0-1');
  return structuredClone(source) as unknown as RawAssignment;
}

/** Selects the canonical class-embedded assignment or fails loudly.
 * @param {WireClass} input - The class wire payload.
 * @returns {WireAssignment} The selected assignment.
 */
function selectedAssignment(input: WireClass): WireAssignment {
  const assignment = input.assignments.find((entry) => entry.assignmentId === CLASS_ASSIGNMENT_ID);
  if (!assignment) throw new Error('Expected canonical assignment-0-1');
  return assignment;
}

/** Selects the first document-bearing submission from an assignment.
 * @param {WireAssignment} assignment - Assignment to inspect.
 * @returns {Submission} The selected submission.
 */
function documentSubmission(assignment: WireAssignment): Submission {
  const submission = assignment.submissions.find((entry) => entry.documentId !== null);
  if (!submission) throw new Error('Expected a document-bearing submission');
  return submission;
}

/** Wraps an item record with its evaluation identity.
 * @param {unknown} item - Candidate item.
 * @returns {ItemReference} The item identity and its mutable record.
 */
function itemReference(item: unknown): ItemReference {
  if (typeof item !== 'object' || item === null) throw new TypeError('Expected an item record');
  return { key: itemSchemaKey(item), item: item as Record<string, unknown> };
}

/** Collects every item reference in a class payload.
 * @param {WireClass} input - The class wire payload.
 * @returns {ItemReference[]} Every item identity and record.
 */
function classItemReferences(input: WireClass): ItemReference[] {
  const references: ItemReference[] = [];
  for (const assignment of input.assignments) {
    for (const submission of assignment.submissions) {
      for (const item of Object.values(submission.items)) {
        references.push(itemReference(item));
      }
    }
  }
  return references;
}

/** Collects every item reference in a full assignment payload.
 * @param {RawAssignment} input - The full assignment payload.
 * @returns {ItemReference[]} Every item identity and record.
 */
function assignmentItemReferences(input: RawAssignment): ItemReference[] {
  const references: ItemReference[] = [];
  for (const submission of input.submissions) {
    for (const item of Object.values(submission.items)) {
      references.push(itemReference(item));
    }
  }
  return references;
}

/** Fails loudly when a required string field is absent from a fixture.
 * @param {unknown} value - Candidate fixture field.
 * @param {string} label - Field name for the diagnostic.
 * @returns {string} The validated string.
 */
function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`Expected a string ${label}`);
  return value;
}

/** Replaces one assessment criterion with an out-of-range score probe.
 * @param {Record<string, unknown>} item - The item to corrupt.
 */
function corruptItemSchema(item: Record<string, unknown>): void {
  const assessments = item.assessments;
  if (typeof assessments !== 'object' || assessments === null) {
    throw new TypeError('Expected an item assessment map');
  }
  item.assessments = { ...assessments, completeness: { score: 6 } };
}

/** Replaces one item artefact with a schema-valid non-submission probe.
 * @param {Record<string, unknown>} item - The item to corrupt.
 */
function corruptItemContext(item: Record<string, unknown>): void {
  const artifact = item.artifact;
  if (typeof artifact !== 'object' || artifact === null) {
    throw new TypeError('Expected an item artefact');
  }
  item.artifact = { ...artifact, role: 'reference' };
}

/** Builds the expected one-attempt tally for every item.
 * @param {ItemReference[]} references - Every evaluated item identity.
 * @param {string | null} schemaCorruptKey - Item expected to fail its only evaluation.
 * @returns {Record<string, ItemEvaluationTally>} Expected tallies keyed by item identity.
 */
function expectedTallies(
  references: ItemReference[],
  schemaCorruptKey: string | null
): Record<string, ItemEvaluationTally> {
  const expected: Record<string, ItemEvaluationTally> = {};
  for (const { key } of references) {
    expected[key] = { attempts: 1, successes: key === schemaCorruptKey ? 0 : 1 };
  }
  return expected;
}

/** Sums every recorded attempt for one read path.
 * @param {Record<string, ItemEvaluationTally>} tally - Recorded tallies.
 * @returns {number} Total evaluation attempts.
 */
function totalAttempts(tally: Record<string, ItemEvaluationTally>): number {
  return Object.values(tally).reduce((sum, entry) => sum + entry.attempts, 0);
}

/** Selects an item identity outside the named corruption probes.
 * @param {ItemReference[]} references - Every item identity.
 * @param {string[]} excluded - Probe identities to skip.
 * @returns {string} A valid item identity.
 */
function validItemKey(references: ItemReference[], excluded: string[]): string {
  const reference = references.find(({ key }) => !excluded.includes(key));
  if (!reference) throw new Error('Expected a valid item');
  return reference.key;
}

/** Builds a class probe whose first assignment carries an own `__proto__` item key.
 * @returns {UnsafeKeyProbe} The probe and its legitimate item identities.
 */
function unsafeKeyProbe(): UnsafeKeyProbe {
  const input = classProbe();
  const submission = documentSubmission(selectedAssignment(input));
  const references = classItemReferences(input);
  const [siblingKey] = Object.keys(submission.items);
  if (!siblingKey) throw new Error('Expected a canonical sibling task');
  const sibling = submission.items[siblingKey];
  if (!sibling) throw new Error('Expected a canonical sibling item');
  const protoItem = { ...structuredClone(sibling), id: 'item-proto', taskId: '__proto__' };
  Object.defineProperty(submission.items, '__proto__', {
    value: protoItem,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return {
    input,
    studentId: submission.studentId,
    references,
    legitimateKeys: Object.keys(submission.items).filter((key) => key !== '__proto__'),
  };
}

beforeEach(() => {
  resetItemSchemaEvaluations();
  callApiMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getABClass single-pass item evaluation', () => {
  it('evaluates each class-read item once with the expected success outcome', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = classProbe();
    const submission = documentSubmission(selectedAssignment(input));
    const [firstTaskKey, secondTaskKey] = Object.keys(submission.items);
    if (!firstTaskKey || !secondTaskKey) throw new Error('Expected two canonical class items');
    const schemaCorrupt = itemReference(submission.items[firstTaskKey]);
    const contextCorrupt = itemReference(submission.items[secondTaskKey]);
    corruptItemSchema(schemaCorrupt.item);
    corruptItemContext(contextCorrupt.item);

    const references = classItemReferences(input);
    callApiMock.mockResolvedValueOnce(input);
    const result = await getABClass({ classId: requireString(input.classId, 'classId') });
    expect(result).not.toBeNull();

    expect
      .soft(
        itemSchemaEvaluationCount(
          'partial',
          validItemKey(references, [schemaCorrupt.key, contextCorrupt.key])
        ),
        'every valid class-read item should pass exactly one evaluation'
      )
      .toEqual({ attempts: 1, successes: 1 });
    expect
      .soft(
        itemSchemaEvaluationCount('partial', schemaCorrupt.key),
        `schema-corrupt item ${schemaCorrupt.key} should fail exactly once`
      )
      .toEqual({ attempts: 1, successes: 0 });
    expect
      .soft(
        itemSchemaEvaluationCount('partial', contextCorrupt.key),
        `contextually-corrupt item ${contextCorrupt.key} should pass its single evaluation`
      )
      .toEqual({ attempts: 1, successes: 1 });
    const tally = itemSchemaTally('partial');
    expect
      .soft(totalAttempts(tally), 'total item-schema evaluations across the whole getABClass call')
      .toBe(references.length);
    expect(tally).toEqual(expectedTallies(references, schemaCorrupt.key));
  });
});

describe('getAssignment single-pass item evaluation', () => {
  it('evaluates each full-read item once with the expected success outcome', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = assignmentProbe();
    const [firstSubmission, secondSubmission] = input.submissions;
    if (!firstSubmission || !secondSubmission) {
      throw new Error('Expected two canonical full submissions');
    }
    const [firstTaskKey] = Object.keys(firstSubmission.items);
    const [, secondTaskKey] = Object.keys(secondSubmission.items);
    if (!firstTaskKey || !secondTaskKey) throw new Error('Expected two canonical full items');
    const schemaCorrupt = itemReference(firstSubmission.items[firstTaskKey]);
    const contextCorrupt = itemReference(secondSubmission.items[secondTaskKey]);
    corruptItemSchema(schemaCorrupt.item);
    corruptItemContext(contextCorrupt.item);

    const references = assignmentItemReferences(input);
    callApiMock.mockResolvedValueOnce(input);
    const result = await getAssignment({
      courseId: requireString(input.courseId, 'courseId'),
      assignmentId: requireString(input.assignmentId, 'assignmentId'),
    });
    expect(result).not.toBeNull();

    expect
      .soft(
        itemSchemaEvaluationCount(
          'full',
          validItemKey(references, [schemaCorrupt.key, contextCorrupt.key])
        ),
        'every valid full-read item should pass exactly one evaluation'
      )
      .toEqual({ attempts: 1, successes: 1 });
    expect
      .soft(
        itemSchemaEvaluationCount('full', schemaCorrupt.key),
        `schema-corrupt item ${schemaCorrupt.key} should fail exactly once`
      )
      .toEqual({ attempts: 1, successes: 0 });
    expect
      .soft(
        itemSchemaEvaluationCount('full', contextCorrupt.key),
        `contextually-corrupt item ${contextCorrupt.key} should pass its single evaluation`
      )
      .toEqual({ attempts: 1, successes: 1 });
    const tally = itemSchemaTally('full');
    expect
      .soft(
        totalAttempts(tally),
        'total item-schema evaluations across the whole getAssignment call'
      )
      .toBe(references.length);
    expect(tally).toEqual(expectedTallies(references, schemaCorrupt.key));
  });
});

describe('class-read unsafe item keys', () => {
  it('drops a stored __proto__ item key before any item evaluation', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const probe = unsafeKeyProbe();

    callApiMock.mockResolvedValueOnce(probe.input);
    const result = await getABClass({ classId: requireString(probe.input.classId, 'classId') });

    expect(
      itemSchemaEvaluationCount('partial', PROTO_ITEM_KEY),
      'unsafe-keyed dictionary entry should receive zero item-schema evaluations'
    ).toEqual({ attempts: 0, successes: 0 });
    const tally = itemSchemaTally('partial');
    expect(tally).toEqual(expectedTallies(probe.references, null));
    expect(Object.keys(tally)).not.toContain(PROTO_ITEM_KEY);

    const outputSubmission = result?.assignments
      .find((entry) => entry.assignmentId === CLASS_ASSIGNMENT_ID)
      ?.submissions.find((entry) => entry.studentId === probe.studentId);
    expect(outputSubmission).toBeDefined();
    expect(Object.hasOwn(outputSubmission?.items ?? {}, '__proto__')).toBe(false);
    expect(Object.keys(outputSubmission?.items ?? {}).toSorted(alphabetical)).toEqual(
      probe.legitimateKeys.toSorted(alphabetical)
    );
  });
});
