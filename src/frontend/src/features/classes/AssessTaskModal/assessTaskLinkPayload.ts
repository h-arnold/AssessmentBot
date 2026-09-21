import { caseInsensitiveTrimmedEquals } from './stringComparison';

/**
 * Deduplicates and adds a new title to the alternateTitles array using
 * case-insensitive trimmed comparison. The candidate is trimmed, and a blank
 * candidate leaves the existing array unchanged. Accepts optional input arrays.
 *
 * @param {string[] | undefined} existingAlternateTitles The existing alternate titles.
 * @param {string} newTitle The new title to add.
 * @returns {string[]} The existing array when the trimmed candidate is blank or
 *          already present; otherwise the existing array with the trimmed candidate appended.
 */
export function buildDeduplicatedAlternateTitles(
  existingAlternateTitles: string[] | undefined,
  newTitle: string
): string[] {
  const existing = existingAlternateTitles ?? [];
  const trimmedTitle = newTitle.trim();
  if (trimmedTitle.length === 0) return existing;
  const isAlreadyPresent = existing.some((t) => caseInsensitiveTrimmedEquals(t, trimmedTitle));
  return isAlreadyPresent ? existing : [...existing, trimmedTitle];
}

/**
 * Deduplicates and adds a new topic to the alternateTopics array using
 * case-insensitive trimmed comparison. When newTopic is null or a blank
 * (whitespace-only) string, returns the existing array unchanged. Accepts
 * optional input arrays.
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
  const trimmedTopic = newTopic.trim();
  if (trimmedTopic.length === 0) return existing;
  const isAlreadyPresent = existing.some((t) => caseInsensitiveTrimmedEquals(t, trimmedTopic));
  return isAlreadyPresent ? existing : [...existing, trimmedTopic];
}
