import Fuse from 'fuse.js';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';

/**
 * Derived shape used by the `LinkableDefinitionList` picker rows.
 *
 * Built from the cached `AssignmentDefinitionPartial` plus the selected
 * Google Classroom assignment. The `LinkableDefinition` is the picker
 * row shape; it carries the fields the row needs to render and to build
 * the link's upsert payload.
 *
 * @remarks
 * The `fuse.js` score is an implementation detail of the picker ordering
 * and is not surfaced as a field on `LinkableDefinition` (per
 * `SPEC.md` display-resolution recommendation).
 */
export type LinkableDefinition = {
  definitionKey: string;
  primaryTitle: string;
  primaryTopic: string;
  yearGroupKey: string;
  yearGroupLabel: string;
  updatedAt: string;
  alternateTitles: string[];
  alternateTopics: string[];
  documentType: string;
  referenceDocumentId: string;
  templateDocumentId: string;
};

const SORT_AHEAD = -1;
const SORT_BEHIND = 1;

/**
 * Derives the picker list from the cached `AssignmentDefinitionPartial`
 * rows for a class's year group, sorted by `fuse.js` fuzzy title rank
 * with `updatedAt` desc as the tie-breaker.
 *
 * @param {AssignmentDefinitionPartial[]} definitionPartials The cached partials to filter and sort.
 * @param {string} classYearGroupKey The class's year group key; only partials with a matching `yearGroupKey` are returned.
 * @param {{ title: string; topicName: string | null }} selectedAssignment The selected Google Classroom assignment; used for fuzzy title ranking.
 * @param {string} selectedAssignment.title The assignment title used for fuzzy ranking.
 * @param {string | null} selectedAssignment.topicName The assignment topic name; used by the matcher.
 * @returns {LinkableDefinition[]} The filtered, sorted picker rows.
 * @remarks
 * Filtering: by `yearGroupKey` equality. The matcher's relaxation (case-insensitive
 * trimmed equality) is the matcher's concern; the picker displays all definitions
 * in the class's year group regardless of whether the matcher would match them.
 * Sort: primary by `fuse.js` score against `primaryTitle` (threshold 1.0, ignoreLocation,
 * includeScore); secondary by `updatedAt` desc via lexicographic comparison (ISO 8601 with
 * timezone sorts chronologically as strings). The `fuse.js` score is consumed internally
 * and is not part of the returned shape.
 */
export function getLinkableDefinitionsForModal(
  definitionPartials: AssignmentDefinitionPartial[],
  classYearGroupKey: string,
  selectedAssignment: { title: string; topicName: string | null }
): LinkableDefinition[] {
  if (definitionPartials.length === 0) {
    return [];
  }

  const matchingPartials = definitionPartials.filter(
    (partial) => partial.yearGroupKey === classYearGroupKey
  );

  if (matchingPartials.length === 0) {
    return [];
  }

  const fuse = new Fuse(matchingPartials, {
    keys: ['primaryTitle'],
    threshold: 1,
    includeScore: true,
    ignoreLocation: true,
  });

  const fuseResults = fuse.search(selectedAssignment.title);

  // Sort by fuse score asc, then updatedAt desc as tie-breaker.
  // score is always present when includeScore: true.
  const sortedResults = fuseResults.toSorted((a, b) => {
    const scoreDiff = a.score! - b.score!;
    if (scoreDiff !== 0) return scoreDiff;
    // Tie-breaker: updatedAt desc
    if (a.item.updatedAt === b.item.updatedAt) return 0;
    if (a.item.updatedAt === null) return SORT_BEHIND;
    if (b.item.updatedAt === null) return SORT_AHEAD;
    if (a.item.updatedAt < b.item.updatedAt) return SORT_BEHIND;
    return SORT_AHEAD;
  });

  const ranked = sortedResults.map((result) => result.item);

  // Track which partials were ranked by fuse (so we can append any that
  // fuse excluded, e.g. when a partial has no `primaryTitle`).
  const rankedKeys = new Set(ranked.map((partial) => partial.definitionKey));

  const unranked = matchingPartials.filter((partial) => !rankedKeys.has(partial.definitionKey));

  // Tie-break by `updatedAt` desc — ISO 8601 with timezone sorts
  // chronologically when compared lexicographically.
  const sortByUpdatedAtDesc = (
    a: AssignmentDefinitionPartial,
    b: AssignmentDefinitionPartial
  ): number => {
    if (a.updatedAt === b.updatedAt) return 0;
    if (a.updatedAt === null) return SORT_BEHIND;
    if (b.updatedAt === null) return SORT_AHEAD;
    return a.updatedAt < b.updatedAt ? SORT_BEHIND : SORT_AHEAD;
  };

  const ordered = [...ranked, ...unranked.toSorted(sortByUpdatedAtDesc)];

  return ordered.map((partial) => ({
    definitionKey: partial.definitionKey,
    primaryTitle: partial.primaryTitle ?? '',
    primaryTopic: partial.primaryTopic ?? '',
    yearGroupKey: partial.yearGroupKey,
    yearGroupLabel: partial.yearGroupLabel,
    updatedAt: partial.updatedAt ?? '',
    alternateTitles: partial.alternateTitles ?? [],
    alternateTopics: partial.alternateTopics ?? [],
    documentType: partial.documentType,
    referenceDocumentId: partial.referenceDocumentId,
    templateDocumentId: partial.templateDocumentId,
  }));
}
