import { logFrontendEvent } from '../../../logging/frontendLogger';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';

/**
 * Check if a single assignment should be excluded from analysis based on
 * date range, topic filter, and definition-key filter.
 *
 * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]}
 *   a - The assignment to evaluate.
 * @param {{ from: string; to: string } | undefined} dateRange - Optional
 *   date-range filter.
 * @param {Set<string> | undefined} topicKeySet - Optional set of topic keys
 *   to include.
 * @param {Set<string> | undefined} definitionKeySet - Optional set of
 *   definition keys to include.
 * @param {Map<string, AssignmentDefinitionPartial>} definitionByKey -
 *   Registry mapping definition keys to their partial definitions.
 * @param {string} classId - Class identifier for error messages.
 * @returns {boolean} True when the assignment should be excluded.
 */
function shouldExcludeAssignment(
  a: AveragingAnalyserInput['classes'][number]['assignments'][number],
  dateRange: { from: string; to: string } | undefined,
  topicKeySet: Set<string> | undefined,
  definitionKeySet: Set<string> | undefined,
  definitionByKey: Map<string, AssignmentDefinitionPartial>,
  classId: string
): boolean {
  const definitionKey = a.assignmentDefinitionKey;
  if (!definitionKey) {
    throw new Error(
      `Missing assignmentDefinitionKey for class ${classId}, assignment ${a.assignmentId}`
    );
  }

  if (isFilteredByDateRange(a.createdAt, dateRange)) return true;

  const definition = definitionByKey.get(definitionKey);
  if (!definition) {
    logFrontendEvent('warn', {
      context: 'shouldExcludeAssignment',
      errorMessage: `No assignment definition partial found for definitionKey '${definitionKey}' (class ${classId}, assignment ${a.assignmentId})`,
      metadata: { definitionKey, classId, assignmentId: a.assignmentId },
    });
    return true;
  }
  return (
    (topicKeySet != null && !topicKeySet.has(definition.primaryTopicKey)) ||
    (definitionKeySet != null && !definitionKeySet.has(definitionKey))
  );
}

/**
 * Filter a class's assignments by dateRange, topicKeys, and
 * assignmentDefinitionKeys. Throws if any assignment lacks a definitionKey.
 *
 * The definition fields (primaryTopicKey, definitionKey) are resolved from
 * `input.assignmentDefinitionPartials` because the embedded
 * `assignment.assignmentDefinition` object was replaced with a lightweight
 * `assignmentDefinitionKey` to avoid serialisation failures with partial
 * definitions (tasks as arrays).
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
  const topicKeySet: Set<string> | undefined = input.filter.topicKeys?.length
    ? new Set(input.filter.topicKeys)
    : undefined;
  const definitionKeySet: Set<string> | undefined = input.filter.assignmentDefinitionKeys?.length
    ? new Set(input.filter.assignmentDefinitionKeys)
    : undefined;
  const { dateRange } = input.filter;

  const definitionByKey = new Map<string, AssignmentDefinitionPartial>();
  for (const p of input.assignmentDefinitionPartials ?? []) {
    definitionByKey.set(p.definitionKey, p);
  }

  return cls.assignments.filter(
    (a) =>
      !shouldExcludeAssignment(
        a,
        dateRange,
        topicKeySet,
        definitionKeySet,
        definitionByKey,
        cls.classId
      )
  );
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
