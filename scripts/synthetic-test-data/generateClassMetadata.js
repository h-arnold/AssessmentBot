const SCORE_TEMPLATES = [
  { completeness: 4, accuracy: 3.5, spag: 4.5, overall: 3.9 },
  { completeness: 'N', accuracy: 'N', spag: 'N', overall: 'N' },
  { completeness: 'E', accuracy: 'E', spag: 'E', overall: 'E' },
  { completeness: 'excluded', accuracy: 'excluded', spag: 'excluded', overall: 'excluded' },
  { completeness: 4, accuracy: 3, spag: 'N', overall: 3.5 },
];
const FULL_MATRIX_SIZE = 5;
const RECENT_ASSIGNMENT_OFFSET = 1;
const NUMERIC_TEMPLATE_INDEX = 0;
const NOT_ATTEMPTED_TEMPLATE_INDEX = 1;
const ERROR_TEMPLATE_INDEX = 2;
const EXCLUDED_TEMPLATE_INDEX = 3;
const MIXED_TEMPLATE_INDEX = 4;
const ONE_ENTRY = 1;
const TWO_ENTRIES = 2;
const THREE_ENTRIES = 3;

const COMPACT_MATRIX = {
  small: [null, [NUMERIC_TEMPLATE_INDEX, 0], [NOT_ATTEMPTED_TEMPLATE_INDEX, ONE_ENTRY]],
  medium: [
    [ERROR_TEMPLATE_INDEX, TWO_ENTRIES],
    [EXCLUDED_TEMPLATE_INDEX, THREE_ENTRIES],
    [MIXED_TEMPLATE_INDEX, ONE_ENTRY],
    [NUMERIC_TEMPLATE_INDEX, 0],
  ],
  'large-representative': [
    null,
    [NUMERIC_TEMPLATE_INDEX, THREE_ENTRIES],
    [MIXED_TEMPLATE_INDEX, TWO_ENTRIES],
    [NUMERIC_TEMPLATE_INDEX, ONE_ENTRY],
  ],
};
const COMPACT_MATRIX_BY_PROFILE = new Map(Object.entries(COMPACT_MATRIX));

/**
 * Generates deterministic class metadata from existing class/assignment records.
 *
 * @param {{profileDefinition: object, classes: Array<object>, assignments: Array<object>}} options Generated source records.
 * @returns {void} Metadata is assigned in place to each persistence class.
 */
export function generateClassMetadata({ profileDefinition, classes, assignments }) {
  const assignmentsByClassId = new Map();
  for (const assignment of assignments) {
    const rows = assignmentsByClassId.get(assignment.courseId) ?? [];
    rows.push(assignment);
    assignmentsByClassId.set(assignment.courseId, rows);
  }

  for (const [index, classDocument] of classes.entries()) {
    applyClassMetadata(profileDefinition.name, index, classDocument, assignmentsByClassId);
  }
}

/**
 * Applies the compact or full-profile matrix case for one class.
 * @param {string} profileName Named profile.
 * @param {number} index Position in the deterministic profile class array.
 * @param {object} classDocument Persistence class to update.
 * @param {Map<string, Array<object>>} assignmentsByClassId Source assignments.
 */
function applyClassMetadata(profileName, index, classDocument, assignmentsByClassId) {
  const matrixCase = getMatrixCase(profileName, index);
  if (matrixCase.isNull) {
    classDocument.metadata = null;
    return;
  }
  applyMetadata(classDocument, assignmentsByClassId, matrixCase.count, matrixCase.templateIndex);
}

/** Resolves a profile's exact matrix entry for a class index.
 * @param {string} profileName Named profile.
 * @param {number} index Class position.
 * @returns {object} Matrix case.
 */
function getMatrixCase(profileName, index) {
  if (profileName === 'large-full') return getFullMatrixCase(index);
  const matrix = COMPACT_MATRIX_BY_PROFILE.get(profileName);
  const compactCase = matrix?.at(index);
  if (!matrix || compactCase === undefined) {
    throw new Error(
      `Synthetic class metadata compact matrix invariant failed for profile ${profileName} at index ${index}.`
    );
  }
  if (compactCase === null) {
    return { isNull: true };
  }
  return { isNull: false, count: compactCase[1], templateIndex: compactCase[0] };
}

/** Resolves the five-class large-full matrix cycle.
 * @param {number} index Position in the deterministic class list.
 * @returns {object} Full-profile matrix case.
 */
function getFullMatrixCase(index) {
  if (index % FULL_MATRIX_SIZE === 0) return { isNull: true };
  return {
    isNull: false,
    count: (index % FULL_MATRIX_SIZE) - RECENT_ASSIGNMENT_OFFSET,
    templateIndex: Math.floor(index / FULL_MATRIX_SIZE) % SCORE_TEMPLATES.length,
  };
}

/**
 * Assigns one non-null snapshot using its generated source timestamps.
 * @param {object} classDocument Persistence class to update.
 * @param {Map<string, Array<object>>} assignmentsByClassId Source assignments.
 * @param {number} count Recent assignment count.
 * @param {number} templateIndex Score template index.
 */
function applyMetadata(classDocument, assignmentsByClassId, count, templateIndex) {
  const newestFirst = [...(assignmentsByClassId.get(classDocument.classId) ?? [])].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt)
  );
  const scores = SCORE_TEMPLATES.at(templateIndex);
  classDocument.metadata = {
    classAverages: { ...scores, updatedAt: newestFirst[0].updatedAt },
    recentAssignments: newestFirst.slice(0, count).map((assignment) => ({
      assignmentId: assignment.assignmentId,
      assignmentDefinitionKey: assignment.assignmentDefinitionKey,
      updatedAt: assignment.updatedAt,
      averages: { ...scores },
    })),
  };
}
