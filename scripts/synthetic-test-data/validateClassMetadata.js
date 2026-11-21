import { fail, isRecord } from './invariantGuards.js';

const SCORE_KEYS = ['completeness', 'accuracy', 'spag', 'overall'];
const MAX_SCORE = 5;
const MAX_RECENT_ASSIGNMENTS = 3;
const MARKERS = new Set(['N', 'E', 'excluded']);
const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const LEGACY_METADATA_KEYS = ['classAverages', 'recentAssignments'];
const CURRENT_METADATA_KEYS = [
  'classAverages',
  'recentAssignments',
  'baselineAverages',
  'allTaskStandings',
  'baselineStandings',
];
const STANDINGS_KEYS = ['top', 'bottom'];
const STANDING_KEYS = ['studentId', 'studentName', 'scores', 'recentAssignmentScores'];

/** Checks exact own-key shape for a raw metadata object.
 * @param {unknown} value Candidate record.
 * @param {string[]} expected Required and permitted keys.
 * @param {string} path Diagnostic path.
 */
function assertKeys(value, expected, path) {
  if (!isRecord(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail(`${path} must be a plain record (ordinary object or null-prototype object).`);
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) fail(`${path}.${key} is required.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (!expected.includes(key)) fail(`${path}.${String(key)} is unexpected.`);
  }
}

/** Reports whether a value is a record whose own keys are exactly the expected set.
 * @param {unknown} value Candidate record.
 * @param {string[]} expected Required and permitted keys.
 * @returns {boolean} Whether the own keys match exactly.
 */
function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

/** Checks that an array has only its length and dense own indices.
 * @param {unknown[]} values Candidate array.
 * @param {string} path Diagnostic path.
 */
function assertDenseArray(values, path) {
  const keys = Reflect.ownKeys(values);
  const keySet = new Set(keys);
  const hasUnexpectedOrMissingKey =
    keys.length !== values.length + 1 ||
    !keySet.has('length') ||
    Array.from({ length: values.length }, (_, index) => String(index)).some(
      (key) => !keySet.has(key) || !Object.hasOwn(values, key)
    );
  if (hasUnexpectedOrMissingKey) {
    fail(`${path} must be a dense array with no extra own properties.`);
  }
}

/** Checks the strict UTC millisecond timestamp shape and calendar validity.
 * @param {unknown} value Candidate timestamp.
 * @param {string} path Diagnostic path.
 */
function assertTimestamp(value, path) {
  const parsedTimestamp = typeof value === 'string' ? new Date(value) : null;
  if (
    typeof value !== 'string' ||
    !CANONICAL_TIMESTAMP.test(value) ||
    Number.isNaN(parsedTimestamp.getTime()) ||
    parsedTimestamp.toISOString() !== value
  ) {
    fail(`${path} must be a canonical UTC timestamp.`);
  }
}

/** Checks the four independently bounded score values.
 * @param {unknown} value Candidate score record.
 * @param {string} path Diagnostic path.
 * @param {boolean} includesTimestamp Whether class-average timestamp is allowed.
 */
function assertScores(value, path, includesTimestamp) {
  assertKeys(value, includesTimestamp ? [...SCORE_KEYS, 'updatedAt'] : SCORE_KEYS, path);
  assertScore(value.completeness, `${path}.completeness`);
  assertScore(value.accuracy, `${path}.accuracy`);
  assertScore(value.spag, `${path}.spag`);
  assertScore(value.overall, `${path}.overall`);
}

/** Checks one score union member without coercion.
 * @param {unknown} score Candidate score.
 * @param {string} path Diagnostic path.
 */
function assertScore(score, path) {
  if (
    !(typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= MAX_SCORE) &&
    !MARKERS.has(score)
  ) {
    fail(`${path} must be a score from 0 to ${MAX_SCORE} or N, E, or excluded.`);
  }
}

/** Validates one metadata record and its relational source assignments.
 * @param {unknown} metadata Candidate metadata value.
 * @param {string} path Diagnostic path.
 * @param {string} classId Owning class identifier.
 * @param {Map<string, object>} assignmentsById Persistence assignments by ID.
 * @param {Set<string>} definitionKeys Declared definition keys.
 */
function validateMetadata(metadata, path, classId, assignmentsById, definitionKeys) {
  if (metadata === null) return;
  // Only the legacy two-field and current five-field shapes are accepted: a partial subset
  // of the new fields is invalid, and a present undefined new field fails its nested check.
  // assertKeys owns the plain-record, missing-key and extra-key diagnostics; the exact-key
  // probe only selects which shape owns the three new fields.
  const isCurrent = hasExactKeys(metadata, CURRENT_METADATA_KEYS);
  const isLegacy = hasExactKeys(metadata, LEGACY_METADATA_KEYS);
  assertKeys(metadata, isLegacy ? LEGACY_METADATA_KEYS : CURRENT_METADATA_KEYS, path);
  validateClassAverages(metadata.classAverages, `${path}.classAverages`);
  validateRecentAssignments(
    metadata.recentAssignments,
    path,
    classId,
    assignmentsById,
    definitionKeys
  );
  if (isCurrent) {
    const recentCount = metadata.recentAssignments.length;
    validateClassAverages(metadata.baselineAverages, `${path}.baselineAverages`);
    validateStandings(metadata.allTaskStandings, `${path}.allTaskStandings`, recentCount);
    validateStandings(metadata.baselineStandings, `${path}.baselineStandings`, recentCount);
  }
}

/** Validates the required class-average object.
 * @param {unknown} averages Candidate averages.
 * @param {string} path Diagnostic path.
 */
function validateClassAverages(averages, path) {
  assertScores(averages, path, true);
  assertTimestamp(averages.updatedAt, `${path}.updatedAt`);
}

/** Validates a standings basis with exactly a top and a bottom list.
 * @param {unknown} value Candidate standings basis.
 * @param {string} path Diagnostic path.
 * @param {number} recentCount Required number of recent assignment score sets.
 */
function validateStandings(value, path, recentCount) {
  assertKeys(value, STANDINGS_KEYS, path);
  validateStandingList(value.top, `${path}.top`, recentCount);
  validateStandingList(value.bottom, `${path}.bottom`, recentCount);
}

/** Validates a dense zero-to-three list of complete standing entries.
 * @param {unknown} value Candidate standing list.
 * @param {string} path Diagnostic path.
 * @param {number} recentCount Required number of recent assignment score sets.
 */
function validateStandingList(value, path, recentCount) {
  if (!Array.isArray(value) || value.length > MAX_RECENT_ASSIGNMENTS) {
    fail(`${path} must be an array containing zero to three entries.`);
  }
  assertDenseArray(value, path);
  for (const [index, entry] of value.entries()) {
    validateStandingEntry(entry, `${path}[${index}]`, recentCount);
  }
}

/** Validates one student standing: trimmed identity, score set and aligned recent scores.
 * @param {unknown} value Candidate standing entry.
 * @param {string} path Diagnostic path.
 * @param {number} recentCount Required number of recent assignment score sets.
 */
function validateStandingEntry(value, path, recentCount) {
  assertKeys(value, STANDING_KEYS, path);
  assertIdentifier(value.studentId, `${path}.studentId`);
  assertIdentifier(value.studentName, `${path}.studentName`);
  assertScores(value.scores, `${path}.scores`, false);
  validateRecentAssignmentScores(
    value.recentAssignmentScores,
    `${path}.recentAssignmentScores`,
    recentCount
  );
}

/** Validates a dense score array aligned one-to-one with the recent assignments.
 * @param {unknown} value Candidate recent-assignment score list.
 * @param {string} path Diagnostic path.
 * @param {number} recentCount Required number of score sets.
 */
function validateRecentAssignmentScores(value, path, recentCount) {
  if (!Array.isArray(value) || value.length > MAX_RECENT_ASSIGNMENTS) {
    fail(`${path} must be an array containing zero to three entries.`);
  }
  if (value.length !== recentCount) {
    fail(`${path} must contain one score set per recent assignment.`);
  }
  assertDenseArray(value, path);
  for (const [index, scores] of value.entries()) {
    assertScores(scores, `${path}[${index}]`, false);
  }
}

/** Validates the recent-assignment collection and its ordering.
 * @param {unknown} recentAssignments Candidate entries.
 * @param {string} path Parent metadata path.
 * @param {string} classId Owning class identifier.
 * @param {Map<string, object>} assignmentsById Source assignments by ID.
 * @param {Set<string>} definitionKeys Declared definition keys.
 */
function validateRecentAssignments(
  recentAssignments,
  path,
  classId,
  assignmentsById,
  definitionKeys
) {
  if (!Array.isArray(recentAssignments)) fail(`${path}.recentAssignments must be an array.`);
  if (recentAssignments.length > MAX_RECENT_ASSIGNMENTS)
    fail(`${path}.recentAssignments must contain at most three entries.`);
  assertDenseArray(recentAssignments, `${path}.recentAssignments`);

  const seen = new Set();
  let previousTimestamp;
  for (const [index, entry] of recentAssignments.entries()) {
    const entryPath = `${path}.recentAssignments[${index}]`;
    const timestamp = validateRecentEntry(
      entry,
      entryPath,
      classId,
      assignmentsById,
      definitionKeys,
      seen
    );
    if (previousTimestamp !== undefined && entry.updatedAt > previousTimestamp) {
      fail(`${path}.recentAssignments must be ordered newest first.`);
    }
    previousTimestamp = timestamp;
  }
}

/** Validates one entry's shape and relationship to its source assignment.
 * @param {object} entry Recent metadata entry.
 * @param {string} path Diagnostic path.
 * @param {string} classId Owning class identifier.
 * @param {Map<string, object>} assignmentsById Source assignments.
 * @param {Set<string>} definitionKeys Declared definition keys.
 * @param {Set<string>} seen Previously used assignment IDs.
 * @returns {string} Exact source timestamp.
 */
function validateRecentEntry(entry, path, classId, assignmentsById, definitionKeys, seen) {
  assertKeys(entry, ['assignmentId', 'assignmentDefinitionKey', 'updatedAt', 'averages'], path);
  assertIdentifier(entry.assignmentId, `${path}.assignmentId`);
  assertIdentifier(entry.assignmentDefinitionKey, `${path}.assignmentDefinitionKey`);
  assertTimestamp(entry.updatedAt, `${path}.updatedAt`);
  assertScores(entry.averages, `${path}.averages`, false);
  if (seen.has(entry.assignmentId)) fail(`${path}.assignmentId must be unique.`);
  seen.add(entry.assignmentId);
  const source = assignmentsById.get(entry.assignmentId);
  if (!source) fail(`${path}.assignmentId does not resolve in persistence.assignments.`);
  if (source.courseId !== classId) fail(`${path}.assignmentId belongs to another class.`);
  if (
    entry.assignmentDefinitionKey !== source.assignmentDefinitionKey ||
    !definitionKeys.has(entry.assignmentDefinitionKey)
  ) {
    fail(`${path}.assignmentDefinitionKey does not match its assignment definition.`);
  }
  if (entry.updatedAt !== source.updatedAt)
    fail(`${path}.updatedAt does not match its assignment.`);
  return entry.updatedAt;
}

/** Checks an opaque identifier is a non-empty, already-trimmed string.
 * @param {unknown} value Candidate identifier.
 * @param {string} path Diagnostic path.
 */
function assertIdentifier(value, path) {
  if (typeof value !== 'string' || value?.trim() !== value || value === '') {
    fail(`${path} must be a non-empty trimmed string.`);
  }
}

/** Checks a metadata snapshot is represented equally in its raw transport view.
 * @param {unknown} actual Transport metadata.
 * @param {unknown} expected Persistence metadata.
 * @param {string} path Diagnostic path.
 */
function assertIndependentEqual(actual, expected, path) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(`${path} metadata does not match persistence.classes.`);
}

/** Validates all class rows and their partial/full transport counterparts.
 * @param {object} graph Generated graph.
 * @param {Map<string, object>} assignmentsById Assignments by ID.
 * @param {Set<string>} definitionKeys Declared definition keys.
 * @param {Map<string, object>} partialById Class partials by ID.
 */
function validateClassRows(graph, assignmentsById, definitionKeys, partialById) {
  for (const [index, classDocument] of graph.persistence.classes.entries()) {
    const path = `persistence.classes[${index}].metadata`;
    if (!Object.hasOwn(classDocument, 'metadata')) fail(`${path} is required.`);
    validateMetadata(
      classDocument.metadata,
      path,
      classDocument.classId,
      assignmentsById,
      definitionKeys
    );
    const partial = partialById.get(classDocument.classId);
    const full = graph.transport.classesById[classDocument.classId];
    if (!partial || !Object.hasOwn(partial, 'metadata')) {
      fail(`transport.classPartials metadata missing for ${classDocument.classId}.`);
    }
    if (!full || !Object.hasOwn(full, 'metadata')) {
      fail(`transport.classesById metadata missing for ${classDocument.classId}.`);
    }
    assertIndependentEqual(
      partial.metadata,
      classDocument.metadata,
      `transport.classPartials[${index}]`
    );
    assertIndependentEqual(
      full.metadata,
      classDocument.metadata,
      `transport.classesById.${classDocument.classId}`
    );
  }
}

/**
 * Validates raw generated class metadata, assignment linkage, and all class-view parity.
 *
 * @param {object} graph Generated graph.
 * @throws {Error} On malformed metadata, broken linkage, or transport drift.
 */
export function validateClassMetadata(graph) {
  const assignmentsById = new Map(
    graph.persistence.assignments.map((row) => [row.assignmentId, row])
  );
  const definitionKeys = new Set(
    graph.persistence.assignmentDefinitions.map((row) => row.definitionKey)
  );
  const partialById = new Map(graph.transport.classPartials.map((row) => [row.classId, row]));
  validateClassRows(graph, assignmentsById, definitionKeys, partialById);
}
