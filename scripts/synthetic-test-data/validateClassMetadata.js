import { fail, isRecord } from './invariantGuards.js';

const SCORE_KEYS = ['completeness', 'accuracy', 'spag', 'overall'];
const MAX_SCORE = 5;
const MAX_RECENT_ASSIGNMENTS = 3;
const MARKERS = new Set(['N', 'E', 'excluded']);
const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

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

/** Checks that an array has only its length and dense own indices.
 * @param {unknown[]} values Candidate array.
 * @param {string} path Diagnostic path.
 */
function assertDenseArray(values, path) {
  const keys = Reflect.ownKeys(values);
  const hasUnexpectedOrMissingKey =
    keys.length !== values.length + 1 ||
    !keys.includes('length') ||
    Array.from({ length: values.length }, (_, index) => String(index)).some(
      (key) => !keys.includes(key) || !Object.hasOwn(values, key)
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
  assertKeys(metadata, ['classAverages', 'recentAssignments'], path);
  validateClassAverages(metadata.classAverages, `${path}.classAverages`);
  validateRecentAssignments(
    metadata.recentAssignments,
    path,
    classId,
    assignmentsById,
    definitionKeys
  );
}

/** Validates the required class-average object.
 * @param {unknown} averages Candidate averages.
 * @param {string} path Diagnostic path.
 */
function validateClassAverages(averages, path) {
  assertScores(averages, path, true);
  assertTimestamp(averages.updatedAt, `${path}.updatedAt`);
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
