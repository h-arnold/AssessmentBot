import type { AveragingAnalyserInput } from '../dataAnalysis.zod';

/**
 * Filter a class's assignments by dateRange, topicKeys, and
 * assignmentDefinitionKeys. Throws if any assignment lacks a definition.
 *
 * @param {AveragingAnalyserInput['classes'][number]} cls - The class.
 * @param {AveragingAnalyserInput} input - The full analyser input.
 * @returns {AveragingAnalyserInput['classes'][number]['assignments']}
 *   Filtered assignments.
 */
export function filterAssignments(
  cls: AveragingAnalyserInput['classes'][number],
  input: AveragingAnalyserInput
): AveragingAnalyserInput['classes'][number]['assignments'] {
  return cls.assignments.filter((assignment) => {
    assertAssignmentDefinition(assignment, cls.classId);

    const definition = assignment.assignmentDefinition!;

    if (isFilteredByDateRange(assignment.createdAt, input.filter.dateRange)) {
      return false;
    }

    if (isFilteredByTopicKeys(definition.primaryTopicKey, input.filter.topicKeys)) {
      return false;
    }

    if (
      isFilteredByDefinitionKeys(definition.definitionKey, input.filter.assignmentDefinitionKeys)
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Assert that an assignment has an assignmentDefinition.
 *
 * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]}
 *   assignment - The assignment to check.
 * @param {string} classId - The class identifier for error context.
 * @throws When the assignment lacks a definition.
 */
export function assertAssignmentDefinition(
  assignment: AveragingAnalyserInput['classes'][number]['assignments'][number],
  classId: string
): void {
  if (!assignment.assignmentDefinition) {
    throw new Error(
      `Missing assignmentDefinition for class ${classId}, ` +
        `assignment ${assignment.assignmentId}`
    );
  }
}

/**
 * Check whether a createdAt timestamp is excluded by the date-range filter.
 *
 * @param {string} createdAt - The ISO timestamp to check.
 * @param {{ from: string; to: string } | undefined} dateRange - The range.
 * @returns {boolean} True when the timestamp falls outside [from, to).
 */
export function isFilteredByDateRange(
  createdAt: string,
  dateRange: { from: string; to: string } | undefined
): boolean {
  if (!dateRange) return false;
  return createdAt < dateRange.from || createdAt >= dateRange.to;
}

/**
 * Check whether a primary topic key is excluded by the topic-key filter.
 *
 * @param {string} primaryTopicKey - The topic key to check.
 * @param {readonly string[] | undefined} topicKeys - The allow list.
 * @returns {boolean} True when the key is not in the allow list.
 */
export function isFilteredByTopicKeys(
  primaryTopicKey: string,
  topicKeys: readonly string[] | undefined
): boolean {
  if (!topicKeys || topicKeys.length === 0) return false;
  return !topicKeys.includes(primaryTopicKey);
}

/**
 * Check whether a definition key is excluded by the definition-key filter.
 *
 * @param {string} definitionKey - The definition key to check.
 * @param {readonly string[] | undefined} assignmentDefinitionKeys - Allow list.
 * @returns {boolean} True when the key is not in the allow list.
 */
export function isFilteredByDefinitionKeys(
  definitionKey: string,
  assignmentDefinitionKeys: readonly string[] | undefined
): boolean {
  if (!assignmentDefinitionKeys || assignmentDefinitionKeys.length === 0) {
    return false;
  }
  return !assignmentDefinitionKeys.includes(definitionKey);
}
