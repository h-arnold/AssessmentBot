/**
 * Typed, no-`any` builders for the raw ABClass metadata record matrices.
 *
 * The schema deliberately validates raw-value record shapes before Zod can
 * conceal prototype or own-key problems, so its specs construct prototypes,
 * class instances and symbol-keyed records by hand. These helpers keep those
 * matrices as typed descriptors: every returned record carries a runtime
 * `AverageScore`-shaped typing, and the only escape hatches (record scratch
 * pads and sparse arrays) are explicit, lint-clean primitives.
 *
 * @remarks Test-only: import exclusively from spec files or other modules in
 * the shared `src/test` helpers tree.
 */
import type { AverageScore, ABClassMetadata } from '@/services/abClass/abClassMetadata.zod';

/** Scalar value usable in one of the four average-score fields. */
export type CandidateScore = AverageScore | undefined;

/** The four mutable average-score field names, in canonical order. */
export type AverageScoreField = 'completeness' | 'accuracy' | 'spag' | 'overall';

/** An average-score record whose values may still contain deliberate invalid probes. */
export type AverageScoreValues = {
  completeness: unknown;
  accuracy: unknown;
  spag: unknown;
  overall: unknown;
};

/** One recent assignment record whose scores may still be deliberate probes. */
export type RecentAssignmentValues = {
  assignmentId: string;
  assignmentDefinitionKey: string;
  averages: AverageScoreValues;
  updatedAt: string;
};

/** Raw candidate metadata whose field values may still be deliberate probes. */
export type MetadataCandidateValues = {
  classAverages: AverageScoreValues & { updatedAt: string };
  recentAssignments: RecentAssignmentValues[];
};

/** Scratch pad for setting own symbol keys or extra string keys on a record. */
export type RecordScratchPad = Record<string | symbol, unknown>;

/** Canonical timestamp accepted by every valid default in this domain. */
export const CANONICAL_METADATA_TIMESTAMP = '2026-10-19T09:33:28.588Z';

/** Valid default average scores that survive the schema untouched. */
export const DEFAULT_SCORES: AverageScoreValues = {
  completeness: 0,
  accuracy: 2.25,
  spag: 5,
  overall: 'N',
};

/** Default class-average record, stamped with the canonical timestamp. */
export const DEFAULT_CLASS_AVERAGES: AverageScoreValues & { updatedAt: string } = {
  ...DEFAULT_SCORES,
  updatedAt: CANONICAL_METADATA_TIMESTAMP,
};

/** Entry average scores that survive the schema untouched. */
export const DEFAULT_ENTRY_AVERAGES: AverageScoreValues = {
  completeness: 0,
  accuracy: 'E',
  spag: 'excluded',
  overall: 2.5,
};

/**
 * Builds one raw recent-assignment candidate with replaceable scores.
 * @param {string} assignmentId - Assignment identifier for the entry.
 * @param {string} updatedAt - Canonical assignment timestamp.
 * @param {AverageScoreValues} averages - Replaceable entry average scores.
 * @returns {RecentAssignmentValues} A raw recent-assignment candidate.
 */
export function recentAssignment(
  assignmentId: string,
  updatedAt: string,
  averages: AverageScoreValues
): RecentAssignmentValues {
  return {
    assignmentId,
    assignmentDefinitionKey: 'reused',
    averages: { ...averages },
    updatedAt,
  };
}

/**
 * Builds a raw metadata candidate with replaceable class-average scores.
 * @param {AverageScoreValues & { updatedAt: string }} classAverages - Class-average record, including its timestamp.
 * @param {RecentAssignmentValues[]} recentAssignments - Recent entries to carry.
 * @returns {MetadataCandidateValues} A raw metadata candidate.
 */
export function metadataCandidate(
  classAverages: AverageScoreValues & { updatedAt: string },
  recentAssignments: RecentAssignmentValues[]
): MetadataCandidateValues {
  return {
    classAverages: { ...classAverages },
    recentAssignments,
  };
}

/**
 * Builds a complete valid candidate: one canonical recent entry plus the defaults.
 * @returns {MetadataCandidateValues} A candidate with a single canonical entry.
 */
export function metadataWithSingleEntry(): MetadataCandidateValues {
  return metadataCandidate(DEFAULT_CLASS_AVERAGES, [
    recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
  ]);
}

/**
 * Reads a scratch pad view of a record so probe tests can attach extra keys.
 * @param {object} record - Record to widen.
 * @returns {RecordScratchPad} The same record as a mutable property pad.
 */
export function asScratchPad(record: object): RecordScratchPad {
  return record as RecordScratchPad;
}

/**
 * Attaches one unexpected own symbol key to a record clone.
 * @param {MetadataCandidateValues} candidate - Candidate to clone.
 * @param {symbol} key - Symbol the schema should reject.
 * @param {boolean} hasMarker - Truthy marker stored under the symbol key.
 * @returns {MetadataCandidateValues} Cloned candidate carrying the symbol key.
 */
export function withRootSymbolKey(
  candidate: MetadataCandidateValues,
  key: symbol,
  hasMarker: boolean
): MetadataCandidateValues {
  const scratch = asScratchPad({ ...candidate });
  scratch[key] = hasMarker;
  return scratch as unknown as MetadataCandidateValues;
}

/**
 * Creates an empty array with one genuine hole via the length setter, which
 * `Array.from` and array literals cannot express.
 * @returns {unknown[]} One-entry sparse array whose single slot is missing.
 */
export function createSparseArray(): unknown[] {
  const sparseTarget: unknown[] = [];
  sparseTarget.length = 1;
  return sparseTarget;
}

/**
 * Creates an empty array object carrying one extra own property, either a
 * string or a symbol key.
 * @param {string | symbol} propertyName - Extra own property key.
 * @param {boolean} hasMarker - Truthy marker stored under that property key.
 * @returns {unknown[]} Empty array with one unexpected own property.
 */
export function createArrayWithExtraOwnProperty(
  propertyName: string | symbol,
  hasMarker: boolean
): unknown[] {
  return Object.assign([], { [propertyName]: hasMarker });
}

/** Non-null metadata snapshot returned by a successful schema parse. */
type NonNullMetadata = Exclude<ABClassMetadata, null>;

/**
 * Narrows a null-parsed schema result; the non-null branch must be explicit
 * instead of hiding behind an `any` assertion.
 * @param {ABClassMetadata} parsed - Parsed schema value.
 * @returns {NonNullMetadata} The same value narrowed to the non-null metadata type.
 */
export function requireMetadataObject(parsed: ABClassMetadata): NonNullMetadata {
  if (parsed === null) throw new Error('Expected a metadata object, received null');
  return parsed;
}

/**
 * Reads one average-score field from a parsed candidate for marker assertions.
 * @param {NonNullMetadata} parsed - Parsed schema value.
 * @param {AverageScoreField} field - Class-average field to read.
 * @returns {AverageScore} The untouched field value after parsing.
 */
export function readClassAverage(parsed: NonNullMetadata, field: AverageScoreField): AverageScore {
  return parsed.classAverages[field];
}

/**
 * Runs a mutation on the single parsed recent entry, if one exists; typing
 * keeps these probes off `any`.
 * @typeParam Entry - Recent-assignment entry type of the parsed snapshot.
 * @param {Object} parsed - Parsed schema value with a recent-assignments list.
 * @param {Entry[]} parsed.recentAssignments - Recent entries carrying the first entry to mutate.
 * @param {function} mutate - Mutation to apply to the first recent entry.
 * @returns {void} Mutates the parsed value in place.
 */
export function mutateFirstRecentEntry<Entry>(
  parsed: { recentAssignments: Entry[] },
  mutate: (entry: Entry) => void
): void {
  mutate(parsed.recentAssignments[0]);
}
