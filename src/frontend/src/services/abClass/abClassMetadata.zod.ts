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
const NEW_METADATA_KEYS = ['baselineAverages', 'allTaskStandings', 'baselineStandings'] as const;
const STANDINGS_KEYS = ['top', 'bottom'] as const;
const STUDENT_STANDING_KEYS = [
  'studentId',
  'studentName',
  'scores',
  'recentAssignmentScores',
] as const;
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

/** Validates exact baseline averages, reusing the class-average score and timestamp rules. */
export const BaselineAveragesSchema = ClassAveragesSchema;

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
function isBoundedDenseArray(value: unknown): boolean {
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

const recentAssignmentsSchema = z
  .custom<unknown>(isBoundedDenseArray)
  .pipe(z.array(RecentAssignmentSchema).max(MAX_RECENT_ASSIGNMENTS));

const recentAssignmentScoresSchema = z
  .custom<unknown>(isBoundedDenseArray)
  .pipe(z.array(AverageScoresSchema).max(MAX_RECENT_ASSIGNMENTS));

const studentStandingShape = {
  studentId: z.string().min(1).refine(isTrimmed),
  studentName: z.string().min(1).refine(isTrimmed),
  scores: AverageScoresSchema,
  recentAssignmentScores: recentAssignmentScoresSchema,
};

const isStudentStandingRawRecord = (value: unknown): boolean =>
  isExactRecord(value, STUDENT_STANDING_KEYS);

/** Validates one exact student-standing entry, with no timestamp of its own. */
export const StudentStandingSchema = z
  .custom<unknown>(isStudentStandingRawRecord)
  .pipe(z.object(studentStandingShape).strict());

const standingListSchema = z
  .custom<unknown>(isBoundedDenseArray)
  .pipe(z.array(StudentStandingSchema).max(MAX_RECENT_ASSIGNMENTS));

const standingsShape = {
  top: standingListSchema,
  bottom: standingListSchema,
};

/**
 * Validates a standings basis.
 * @remarks Disjointness between `top` and `bottom` is a producer rule owned by the
 * Section 3 analyser; the persisted-metadata validators on both sides deliberately
 * allow duplicates so frontend and backend acceptance stay aligned.
 */
export const StudentStandingsSchema = z
  .custom<unknown>((value: unknown): boolean => isExactRecord(value, STANDINGS_KEYS))
  .pipe(z.object(standingsShape).strict());

const legacyMetadataShape = {
  classAverages: ClassAveragesSchema,
  recentAssignments: recentAssignmentsSchema,
};

const currentMetadataShape = {
  ...legacyMetadataShape,
  baselineAverages: BaselineAveragesSchema.nullable(),
  allTaskStandings: StudentStandingsSchema.nullable(),
  baselineStandings: StudentStandingsSchema.nullable(),
};

const currentMetadataKeys = [...METADATA_KEYS, ...NEW_METADATA_KEYS] as const;

/** Exact five-field snapshot shape used as the emitted non-null output contract. */
const fiveFieldSnapshotSchema = z.object(currentMetadataShape).strict();

const legacySnapshotSchema = z
  .custom<unknown>((value: unknown): boolean => isExactRecord(value, METADATA_KEYS))
  .pipe(z.object(legacyMetadataShape).strict());

const currentSnapshotSchema = z
  .custom<unknown>((value: unknown): boolean => isExactRecord(value, currentMetadataKeys))
  .pipe(fiveFieldSnapshotSchema);

/** Complete five-field metadata snapshot emitted by the schema. */
export type NonNullableABClassMetadata = z.infer<typeof fiveFieldSnapshotSchema>;

/**
 * Validates a non-null ABClass metadata snapshot and emits the current five-field shape.
 * @remarks Legacy two-field input and current five-field input are both accepted. Legacy
 * input is emitted as the full five-field shape with enumerable null placeholders, mirroring
 * backend read normalisation so all five fields survive serialisation and cloning.
 * @remarks Used by the metadata merge/write path; the nullable union remains for wire reads and mutation requests.
 */
export const NonNullableABClassMetadataSchema = z
  .union([currentSnapshotSchema, legacySnapshotSchema])
  .superRefine((snapshot, context) => {
    validateRecentAssignmentOrdering(snapshot.recentAssignments, context);
    if ('allTaskStandings' in snapshot) {
      validateStandingsScoreAlignment(snapshot, context);
    }
  })
  .transform(emitCurrentFiveFieldShape);

/**
 * Validates a nullable ABClass metadata snapshot.
 * @remarks The union accepts a legacy two-field input but emits the current five-field
 * shape with null placeholders, mirroring the backend read normalisation: stored legacy
 * bytes stay readable without a write, and callers receive one consistent shape.
 */
export const ABClassMetadataSchema = z.union([z.null(), NonNullableABClassMetadataSchema]);

export type AverageScore = z.infer<typeof AverageScoreSchema>;
export type AverageScores = z.infer<typeof AverageScoresSchema>;
export type ClassAverages = z.infer<typeof ClassAveragesSchema>;
export type BaselineAverages = z.infer<typeof BaselineAveragesSchema>;
export type RecentAssignment = z.infer<typeof RecentAssignmentSchema>;
export type StudentStanding = z.infer<typeof StudentStandingSchema>;
export type StudentStandings = z.infer<typeof StudentStandingsSchema>;
/** Legacy two-field snapshot still accepted on read and write paths. */
export type LegacyABClassMetadata = z.infer<typeof legacySnapshotSchema>;
export type ABClassMetadata = z.infer<typeof ABClassMetadataSchema>;

/**
 * Emits a five-field snapshot, retaining supplied fields and adding null placeholders.
 * @param {object} snapshot - Validated current or legacy snapshot.
 * @returns {NonNullableABClassMetadata} Snapshot exposing all five fields.
 */
function emitCurrentFiveFieldShape(
  snapshot: z.infer<typeof currentSnapshotSchema> | z.infer<typeof legacySnapshotSchema>
): NonNullableABClassMetadata {
  return {
    classAverages: snapshot.classAverages,
    recentAssignments: snapshot.recentAssignments,
    baselineAverages: 'baselineAverages' in snapshot ? snapshot.baselineAverages : null,
    allTaskStandings: 'allTaskStandings' in snapshot ? snapshot.allTaskStandings : null,
    baselineStandings: 'baselineStandings' in snapshot ? snapshot.baselineStandings : null,
  };
}

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
  return ownKeys.length === keys.length && hasRequiredOwnKeys(value, keys);
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

/**
 * Aligns every standing entry's score list with the metadata's recent assignments.
 * @param {object} snapshot - Parsed current-shape snapshot.
 * @param {z.RefinementCtx} context - Zod refinement context.
 * @returns {void} Adds validation issues to the context when needed.
 */
function validateStandingsScoreAlignment(
  snapshot: z.infer<typeof currentSnapshotSchema>,
  context: z.RefinementCtx
): void {
  const expected = snapshot.recentAssignments.length;
  for (const basis of ['allTaskStandings', 'baselineStandings'] as const) {
    const standings = snapshot[basis];
    if (standings === null) continue;
    for (const list of ['top', 'bottom'] as const) {
      standings[list].forEach((entry, index) => {
        if (entry.recentAssignmentScores.length !== expected) {
          context.addIssue({
            code: 'custom',
            path: [basis, list, index, 'recentAssignmentScores'],
            message: 'recentAssignmentScores must have one score set per recent assignment',
          });
        }
      });
    }
  }
}
