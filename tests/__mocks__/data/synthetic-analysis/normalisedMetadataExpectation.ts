/**
 * Derives the five-field metadata value emitted by the response parsers from a raw
 * committed snapshot: supplied new-field values are preserved, a legacy two-field snapshot
 * gains three null placeholders and a whole-metadata null stays null. The returned object
 * is detached from the corpus data so each consumer owns its copy.
 * @param {unknown} rawMetadata - Raw metadata from a committed class-partial row.
 * @returns {unknown} The normalised metadata expectation.
 * @throws {TypeError} When the supplied value is neither null nor a non-array object.
 */
export function normalisedMetadataExpectation(rawMetadata: unknown): unknown {
  if (rawMetadata === null) return null;
  if (typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    const type = Array.isArray(rawMetadata) ? 'array' : typeof rawMetadata;
    throw new TypeError(`Expected a null or object metadata snapshot, received ${type}`);
  }
  const raw = structuredClone(rawMetadata) as Record<string, unknown>;
  return {
    ...raw,
    baselineAverages: raw.baselineAverages ?? null,
    allTaskStandings: raw.allTaskStandings ?? null,
    baselineStandings: raw.baselineStandings ?? null,
  };
}
