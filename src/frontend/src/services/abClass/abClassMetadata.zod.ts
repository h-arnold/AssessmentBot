import { z } from 'zod';

const METRICS = ['completeness', 'accuracy', 'spag', 'overall'] as const;
const AVERAGE_KEYS = [...METRICS, 'updatedAt'] as const;
const RECENT_ASSIGNMENT_KEYS = [
  'assignmentId',
  'assignmentDefinitionKey',
  'averages',
  'updatedAt',
] as const;
const METADATA_KEYS = ['classAverages', 'recentAssignments'] as const;
const MAX_SCORE = 5;
const MAX_RECENT_ASSIGNMENTS = 3;

/**
 * Validates the canonical UTC timestamp used by ABClass metadata.
 * @remarks This contract is narrower than the broader ISO timestamp schemas used elsewhere.
 */
export const CanonicalMetadataTimestampSchema = z.string().refine(isCanonicalMetadataTimestamp);

/** Validates a finite score in range or one of the exact backend markers. */
export const AverageScoreSchema = z.union([
  z.number().min(0).max(MAX_SCORE),
  z.literal('N'),
  z.literal('E'),
  z.literal('excluded'),
]);

const averageScoresShape = {
  completeness: AverageScoreSchema,
  accuracy: AverageScoreSchema,
  spag: AverageScoreSchema,
  overall: AverageScoreSchema,
};

const isAverageScoresRawRecord = (value: unknown): boolean => isExactRecord(value, METRICS);

/** Validates exact, plain average-score records before Zod parses them. */
export const AverageScoresSchema = z
  .custom<unknown>(isAverageScoresRawRecord)
  .pipe(z.object(averageScoresShape).strict());

const classAveragesShape = {
  ...averageScoresShape,
  updatedAt: CanonicalMetadataTimestampSchema,
};

const isClassAveragesRawRecord = (value: unknown): boolean => isExactRecord(value, AVERAGE_KEYS);

/** Validates exact class averages, including their canonical update timestamp. */
export const ClassAveragesSchema = z
  .custom<unknown>(isClassAveragesRawRecord)
  .pipe(z.object(classAveragesShape).strict());

const recentAssignmentShape = {
  assignmentId: z.string().min(1).refine(isTrimmed),
  assignmentDefinitionKey: z.string().min(1).refine(isTrimmed),
  averages: AverageScoresSchema,
  updatedAt: CanonicalMetadataTimestampSchema,
};

const isRecentAssignmentRawRecord = (value: unknown): boolean =>
  isExactRecord(value, RECENT_ASSIGNMENT_KEYS);

/** Validates one exact recent-assignment snapshot. */
export const RecentAssignmentSchema = z
  .custom<unknown>(isRecentAssignmentRawRecord)
  .pipe(z.object(recentAssignmentShape).strict());

/**
 * Checks bounded array density and rejects unexpected own array keys.
 * @param {unknown} value - Candidate array.
 * @returns {boolean} Whether the array is dense and has no extra own properties.
 */
function isRecentAssignmentsRawArray(value: unknown): boolean {
  if (
    !Array.isArray(value) ||
    value.length > MAX_RECENT_ASSIGNMENTS ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  return Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).every(
    Boolean
  );
}

const isMetadataRawRecord = (value: unknown): boolean => isExactRecord(value, METADATA_KEYS);

const metadataShape = {
  classAverages: ClassAveragesSchema,
  recentAssignments: z
    .custom<unknown>(isRecentAssignmentsRawArray)
    .pipe(z.array(RecentAssignmentSchema).max(MAX_RECENT_ASSIGNMENTS)),
};

const metadataSchema = z
  .custom<unknown>(isMetadataRawRecord)
  .pipe(z.object(metadataShape).strict())
  .superRefine((metadata, context) => {
    validateRecentAssignmentOrdering(metadata.recentAssignments, context);
  });

/**
 * Validates a nullable, complete ABClass metadata snapshot.
 * @remarks Required fields and exact plain-record keys are checked before Zod copies input; this mirrors the backend metadata boundary.
 */
export const ABClassMetadataSchema = z.union([z.null(), metadataSchema]);

export type AverageScore = z.infer<typeof AverageScoreSchema>;
export type AverageScores = z.infer<typeof AverageScoresSchema>;
export type ClassAverages = z.infer<typeof ClassAveragesSchema>;
export type RecentAssignment = z.infer<typeof RecentAssignmentSchema>;
export type ABClassMetadata = z.infer<typeof ABClassMetadataSchema>;

/**
 * Checks that a candidate has precisely the expected own keys and plain prototype.
 * @param {unknown} value - Candidate record value.
 * @param {readonly string[]} keys - Required and permitted own string keys.
 * @returns {boolean} Whether the candidate is an exact ordinary or null-prototype record.
 */
function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !hasPlainPrototype(value)
  )
    return false;
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === keys.length &&
    hasRequiredOwnKeys(value, keys) &&
    ownKeys.every((key) => typeof key === 'string' && keys.includes(key))
  );
}

/**
 * Checks whether an object uses an ordinary or null prototype.
 * @param {object} value - Candidate object.
 * @returns {boolean} Whether the prototype is permitted.
 */
function hasPlainPrototype(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Checks that every required key is an own property.
 * @param {object} value - Candidate record.
 * @param {readonly string[]} keys - Required property names.
 * @returns {boolean} Whether all required keys are own properties.
 */
function hasRequiredOwnKeys(value: object, keys: readonly string[]): boolean {
  return keys.every((key) => Object.hasOwn(value, key));
}

/**
 * Checks that an identifier is already trimmed.
 * @param {string} value - Candidate identifier.
 * @returns {boolean} Whether the string contains no surrounding whitespace.
 */
function isTrimmed(value: string): boolean {
  return value.trim() === value;
}

/**
 * Checks canonical UTC syntax and real date-time validity without normalisation.
 * @param {string} value - Candidate timestamp.
 * @returns {boolean} Whether the timestamp is an exact canonical UTC value.
 */
function isCanonicalMetadataTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

/**
 * Adds ordering and duplicate-ID validation to parsed recent assignments.
 * @param {readonly { assignmentId: string; updatedAt: string }[]} assignments - Parsed recent-assignment snapshots.
 * @param {z.RefinementCtx} context - Zod refinement context.
 * @returns {void} Adds validation issues to the context when needed.
 */
function validateRecentAssignmentOrdering(
  assignments: readonly { assignmentId: string; updatedAt: string }[],
  context: z.RefinementCtx
): void {
  const identifiers = new Set<string>();
  assignments.forEach((entry, index) => {
    if (identifiers.has(entry.assignmentId)) {
      context.addIssue({
        code: 'custom',
        path: ['recentAssignments', index, 'assignmentId'],
        message: 'assignmentId must be unique',
      });
    }
    identifiers.add(entry.assignmentId);
    if (index > 0 && entry.updatedAt > assignments[index - 1].updatedAt) {
      context.addIssue({
        code: 'custom',
        path: ['recentAssignments', index, 'updatedAt'],
        message: 'recentAssignments must be newest first',
      });
    }
  });
}
