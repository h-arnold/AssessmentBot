import type { AveragingAnalyserInput } from '../dataAnalysis.zod';

/**
 * Filter a class's assignments by dateRange, topicKeys, and
 * assignmentDefinitionKeys. Throws if any assignment lacks a definition.
 *
 * @param {AveragingAnalyserInput['classes'][number]} cls - The class.
 * @param {AveragingAnalyserInput} input - The full analyser input.
 * @returns {AveragingAnalyserInput['classes'][number]['assignments']}
 *   Filtered assignments.
 * @remarks
 * This function builds {@link Set} instances for the topicKeys and
 * assignmentDefinitionKeys arrays once at call time, then uses
 * O(1) {@link Set.has} lookups inside the filter callback instead of
 * O(K) {@link Array.includes}. The date-range predicate remains a
 * direct lexicographic string comparison via {@link isFilteredByDateRange}.
 */
export function filterAssignments(
  cls: AveragingAnalyserInput['classes'][number],
  input: AveragingAnalyserInput
): AveragingAnalyserInput['classes'][number]['assignments'] {
  const topicKeySet: Set<string> | undefined = input.filter.topicKeys?.length
    ? new Set(input.filter.topicKeys)
    : undefined;
  const definitionKeySet: Set<string> | undefined = input.filter.assignmentDefinitionKeys?.length
    ? new Set(input.filter.assignmentDefinitionKeys)
    : undefined;
  const { dateRange } = input.filter;

  return cls.assignments.filter((assignment) => {
    assertAssignmentDefinition(assignment, cls.classId);

    const definition = assignment.assignmentDefinition!;

    if (isFilteredByDateRange(assignment.createdAt, dateRange)) {
      return false;
    }

    if (topicKeySet && !topicKeySet.has(definition.primaryTopicKey)) {
      return false;
    }

    if (definitionKeySet && !definitionKeySet.has(definition.definitionKey)) {
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
