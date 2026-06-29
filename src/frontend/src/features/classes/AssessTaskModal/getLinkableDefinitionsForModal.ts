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
 *
 * @remarks
 * Both `referenceDocumentId` and `templateDocumentId` are non-nullable
 * `string` fields. The derivation function filters out partials that
 * have null for either source ID, preventing the link-upsert path from
 * serialising `null` as `undefined`.
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
  documentType: 'SLIDES' | 'SHEETS';
  referenceDocumentId: string;
  templateDocumentId: string;
};

const SORT_NEWER_FIRST = -1;
const SORT_OLDER_FIRST = 1;

/**
 * Compares two `updatedAt` values in descending order (newest first).
 * Null and empty-string values sort after all non-null, non-empty values.
 *
 * @param {string | null} a - First updatedAt value.
 * @param {string | null} b - Second updatedAt value.
 * @returns {number} Negative if a is newer, positive if b is newer, 0 if equal.
 */
function compareUpdatedAtDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null || a === '') return SORT_OLDER_FIRST;
  if (b === null || b === '') return SORT_NEWER_FIRST;
  return a < b ? SORT_OLDER_FIRST : SORT_NEWER_FIRST;
}

/**
 * Derives the picker list from the cached `AssignmentDefinitionPartial`
 * rows for a class's year group, sorted by `fuse.js` fuzzy title rank
 * with `updatedAt` desc as the tie-breaker.
 *
 * @param {AssignmentDefinitionPartial[]} definitionPartials The cached partials to filter and sort.
 * @param {string} classYearGroupKey The class's year group key; only partials with a matching `yearGroupKey` are returned.
 * @param {{ title: string; topicName: string | null }} selectedAssignment The selected Google Classroom assignment; used for fuzzy title ranking.
 * @param {string} selectedAssignment.title The assignment title used for fuzzy ranking.
 * @param {string | null} selectedAssignment.topicName Unused by this helper; present for API consistency with the caller.
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

  const matchingPartials = definitionPartials
    .filter((partial) => partial.yearGroupKey === classYearGroupKey)
    .filter(
      (
        partial
      ): partial is AssignmentDefinitionPartial & {
        referenceDocumentId: string;
        templateDocumentId: string;
      } => partial.referenceDocumentId !== null && partial.templateDocumentId !== null
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
    const scoreDiff = (a.score ?? 0) - (b.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return compareUpdatedAtDesc(a.item.updatedAt, b.item.updatedAt);
  });

  const ranked = sortedResults.map((result) => result.item);

  // Track which partials were ranked by fuse (so we can append any that
  // fuse excluded, e.g. when a partial has no `primaryTitle`).
  const rankedKeys = new Set(ranked.map((partial) => partial.definitionKey));

  const unranked = matchingPartials.filter((partial) => !rankedKeys.has(partial.definitionKey));

  const ordered = [
    ...ranked,
    ...unranked.toSorted((a, b) => compareUpdatedAtDesc(a.updatedAt, b.updatedAt)),
  ];

  return ordered.map((partial) => ({
    definitionKey: partial.definitionKey,
    primaryTitle: partial.primaryTitle ?? '',
    primaryTopic: partial.primaryTopic ?? '',
    yearGroupKey: partial.yearGroupKey,
    yearGroupLabel: partial.yearGroupLabel,
    updatedAt: partial.updatedAt ?? '',
    alternateTitles: partial.alternateTitles ?? [],
    alternateTopics: partial.alternateTopics ?? [],
    documentType: partial.documentType as 'SLIDES' | 'SHEETS',
    referenceDocumentId: partial.referenceDocumentId,
    templateDocumentId: partial.templateDocumentId,
  }));
}
