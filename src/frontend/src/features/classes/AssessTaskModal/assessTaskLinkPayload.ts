import { caseInsensitiveTrimmedEquals } from './stringComparison';

/**
 * Deduplicates and adds a new title to the alternateTitles array using
 * case-insensitive trimmed comparison. Accepts optional input arrays.
 *
 * @param {string[] | undefined} existingAlternateTitles The existing alternate titles.
 * @param {string} newTitle The new title to add.
 * @returns {string[]} The deduplicated union or [newTitle] when existing is undefined.
 */
export function buildDeduplicatedAlternateTitles(
  existingAlternateTitles: string[] | undefined,
  newTitle: string
): string[] {
  const existing = existingAlternateTitles ?? [];
  const isAlreadyPresent = existing.some((t) => caseInsensitiveTrimmedEquals(t, newTitle));
  return isAlreadyPresent ? existing : [...existing, newTitle];
}

/**
 * Deduplicates and adds a new topic to the alternateTopics array using
 * case-insensitive trimmed comparison. When newTopic is null, returns the
 * existing array unchanged. Accepts optional input arrays.
 *
 * @param {string[] | undefined} existingAlternateTopics The existing alternate topics.
 * @param {string | null} newTopic The new topic name to add, or null to skip.
 * @returns {string[]} The unchanged existing array or the deduplicated union.
 */
export function buildDeduplicatedAlternateTopics(
  existingAlternateTopics: string[] | undefined,
  newTopic: string | null
): string[] {
  const existing = existingAlternateTopics ?? [];
  if (newTopic === null) {
    return existing;
  }
  const isAlreadyPresent = existing.some((t) => caseInsensitiveTrimmedEquals(t, newTopic));
  return isAlreadyPresent ? existing : [...existing, newTopic];
}
