/**
 * Shared wire types and corruption-catalogue fixtures for the
 * `assignmentReadNormalisation` spec family.
 *
 * The four normaliser specs (`assignmentReadNormalisation.full.spec.ts`,
 * `.partial.spec.ts`, `.legacyFull.spec.ts` and `.legacyPartial.spec.ts`)
 * probe the same wire shapes and assert against the same `CORRUPT_RECORD`
 * catalogue replacement, so the raw full-read types (`Raw*`), the
 * class-embedded partial types (`Wire*`) and the corruption constants live
 * here once. Probe builders stay spec-local because each spec selects and
 * adapts a different canonical record.
 *
 * This module is runner-neutral test support: pure types, constants and one
 * pure factory, with no Vitest, transport or production imports.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

/** One raw wire record as decoded from the committed canonical JSON. */
export type RawRecord = Record<string, unknown>;

/** Raw full-read submission item with required assessment and feedback maps. */
export type RawItem = {
  id: string;
  taskId: string;
  artifact: RawRecord;
  assessments: RawRecord;
  feedback: RawRecord;
};

/** Raw full-read submission with a required source document identity. */
type RawSubmission = {
  studentId: string;
  studentName: string | null;
  assignmentId: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
  items: Record<string, RawItem>;
};

/** Raw full-read assignment payload with its task graph and version marker. */
export type RawAssignment = RawRecord & {
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

/** Raw class-embedded item whose assessment and feedback maps may be redacted. */
type WireItem = {
  id: string;
  taskId: string;
  artifact: RawRecord;
  assessments?: RawRecord;
  feedback?: RawRecord;
};

/** Raw class-embedded submission whose source identity may be redacted. */
type WireSubmission = {
  studentId: string;
  studentName: string | null;
  assignmentId: string;
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
  items: Record<string, WireItem>;
};

/** Raw class-embedded assignment with an optional version marker. */
export type WireAssignment = RawRecord & {
  assignmentId: string;
  assessmentContractVersion?: unknown;
  submissions: WireSubmission[];
};

/** Raw class-read payload embedding the partial assignments. */
export type WireClass = RawRecord & { assignments: WireAssignment[] };

/** The three scored criteria used to build all-criterion assessment maps. */
export const criteria = ['completeness', 'accuracy', 'spag'] as const;

/** The catalogue `CORRUPT_RECORD` replacement for one criterion. */
const corruptResult = {
  score: 'E',
  reasoning: 'The stored assessment data for this task is invalid. Reassess the assignment.',
  error: { stage: 'validation', code: 'CORRUPT_RECORD' },
};

/**
 * Builds the expected all-criterion corruption replacement.
 * @returns {Record<string, typeof corruptResult>} A detached corruption map with one entry per criterion.
 */
export function allCorrupt(): Record<string, typeof corruptResult> {
  return {
    completeness: corruptResult,
    accuracy: corruptResult,
    spag: corruptResult,
  };
}

/**
 * Requires two item keys or fails with a fixture-specific diagnostic.
 * @param {object} submission - Candidate submission.
 * @param {Record<string, unknown>} submission.items - The submission's items.
 * @returns {[string, string]} The first and second canonical task keys.
 */
export function twoItemKeys(submission: { items: Record<string, unknown> }): [string, string] {
  const [first, second] = Object.keys(submission.items);
  if (!first || !second) throw new Error('Expected two canonical tasks');
  return [first, second];
}
