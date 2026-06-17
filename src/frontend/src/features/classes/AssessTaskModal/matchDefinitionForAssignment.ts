import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { caseInsensitiveTrimmedEquals } from './stringComparison';

/**
 * Discriminated union representing the result of matching a Google Classroom
 * assignment against assignment definition partials.
 */
export type MatchResult =
  | { kind: 'matched'; definition: AssignmentDefinitionPartial }
  | { kind: 'no-match' }
  | { kind: 'ambiguous'; matches: AssignmentDefinitionPartial[] };

/**
 * Matches a selected Google Classroom assignment against
 * `AssignmentDefinitionPartial` records by title, topic name, and year
 * group.
 *
 * Returns `{ kind: 'no-match' }` when:
 * - `classPartial.yearGroupKey` is `null`
 * - `selectedAssignment.topicName` is `null`
 * - no partial satisfies all three criteria
 *
 * Returns `{ kind: 'ambiguous' }` when more than one partial matches.
 * Returns `{ kind: 'matched' }` when exactly one partial matches.
 *
 * @remarks
 * Title and topic comparisons use case-insensitive trimmed equality (via
 * `caseInsensitiveTrimmedEquals`) against `primaryTitle`/`alternateTitles`
 * and `primaryTopic`/`alternateTopics` respectively. The `alternateTopics`
 * topic check only runs when `selectedAssignment.topicName !== null`;
 * the early return for `topicName === null` is preserved.
 *
 * @param {{ assignmentId: string; title: string; topicName: string | null }} selectedAssignment The selected Google Classroom assignment with title and topic name.
 * @param {{ assignmentId: string }} selectedAssignment.assignmentId The assignment identifier.
 * @param {{ title: string }} selectedAssignment.title The assignment title.
 * @param {{ topicName: string | null }} selectedAssignment.topicName The resolved topic name, or `null` when the assignment has no topic.
 * @param {{ yearGroupKey: string | null }} classPartial The class partial containing the year group key.
 * @param {{ yearGroupKey: string | null }} classPartial.yearGroupKey The year group key, or `null` when the class has no year group.
 * @param {AssignmentDefinitionPartial[]} definitionPartials The list of assignment definition partials to match against.
 * @returns {MatchResult} A discriminated union result indicating match, no-match, or ambiguous.
 */
export function findMatchingDefinition(
  selectedAssignment: { assignmentId: string; title: string; topicName: string | null },
  classPartial: { yearGroupKey: string | null },
  definitionPartials: AssignmentDefinitionPartial[]
): MatchResult {
  if (classPartial.yearGroupKey === null || selectedAssignment.topicName === null) {
    return { kind: 'no-match' };
  }

  const topicName = selectedAssignment.topicName;

  const matches = definitionPartials.filter((partial) => {
    const titleMatch =
      caseInsensitiveTrimmedEquals(partial.primaryTitle, selectedAssignment.title) ||
      partial.alternateTitles.some((alternate) =>
        caseInsensitiveTrimmedEquals(alternate, selectedAssignment.title)
      );

    const topicMatch =
      caseInsensitiveTrimmedEquals(partial.primaryTopic, topicName) ||
      partial.alternateTopics.some((alternate) =>
        caseInsensitiveTrimmedEquals(alternate, topicName)
      );

    return titleMatch && topicMatch && classPartial.yearGroupKey === partial.yearGroupKey;
  });

  if (matches.length === 0) {
    return { kind: 'no-match' };
  }

  if (matches.length > 1) {
    return { kind: 'ambiguous', matches };
  }

  return { kind: 'matched', definition: matches[0] };
}
