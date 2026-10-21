import { describe, expect, it } from 'vitest';
import { ABClassMetadataSchema } from './abClassMetadata.zod';
import {
  CANONICAL_METADATA_TIMESTAMP,
  DEFAULT_CLASS_AVERAGES,
  DEFAULT_ENTRY_AVERAGES,
  createArrayWithExtraOwnProperty,
  createSparseArray,
  metadataCandidate,
  recentAssignment,
  requireMetadataObject,
} from '@/test/abClass/abClassMetadataTestBuilders';

const LATER_TIMESTAMP = '2026-10-20T09:33:28.588Z';

/**
 * Wraps a raw candidate for schema safeParse, shared by every probe loop.
 * @param {unknown[]} entries - Recent entries the schema should judge.
 * @returns {Record<string, unknown>} Raw metadata candidate carrying the entries.
 */
function withEntries(entries: unknown[]): Record<string, unknown> {
  return { ...metadataCandidate(DEFAULT_CLASS_AVERAGES, []), recentAssignments: entries };
}

/**
 * Builds an entry with one invalid recent-entry timestamp.
 * @param {string} updatedAt - Timestamp the schema should judge.
 * @returns {unknown} Recent-assignment probe carrying the timestamp.
 */
function entryWithTimestamp(updatedAt: string): unknown {
  return recentAssignment('a', updatedAt, DEFAULT_ENTRY_AVERAGES);
}

/**
 * Interprets a schema result for one shorthand probe.
 * @param {unknown} candidate - Raw candidate to validate.
 * @returns {boolean} Whether the schema accepts the candidate.
 */
function isAccepted(candidate: unknown): boolean {
  return ABClassMetadataSchema.safeParse(candidate).success;
}

describe('ABClass recent-assignment array ownership', () => {
  it('rejects a genuine sparse recent-assignment array with one hole', () => {
    const oneHole = createSparseArray();
    const sparseEntries = withEntries(oneHole);
    expect(isAccepted(sparseEntries)).toBe(false);
  });

  it('rejects recent-assignment arrays carrying extra own properties', () => {
    const stringKeyed = withEntries(createArrayWithExtraOwnProperty('extra', true));
    expect(isAccepted(stringKeyed)).toBe(false);
    const symbolKeyed = withEntries(createArrayWithExtraOwnProperty(Symbol('extra'), true));
    expect(isAccepted(symbolKeyed)).toBe(false);
  });

  it('rejects more than three dense recent entries', () => {
    const fourEntries = [
      recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
      recentAssignment('b', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
      recentAssignment('c', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
      recentAssignment('d', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
    ];
    const overlyLong = withEntries(fourEntries);
    expect(isAccepted(overlyLong)).toBe(false);
  });

  it('preserves equal-timestamp ordering without sorting', () => {
    const orderedEntries = [
      recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
      recentAssignment('b', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
    ];
    const ordered = requireMetadataObject(ABClassMetadataSchema.parse(withEntries(orderedEntries)));
    expect(ordered.recentAssignments.map((item) => item.assignmentId)).toEqual(['a', 'b']);
  });

  it('rejects duplicate assignment identifiers', () => {
    const duplicateEntries = [
      recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
      recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
    ];
    const withDuplicate = withEntries(duplicateEntries);
    expect(isAccepted(withDuplicate)).toBe(false);
  });

  it('rejects a later entry out of newest-first order', () => {
    const outOfOrderEntries = [
      recentAssignment('a', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
      recentAssignment('b', LATER_TIMESTAMP, DEFAULT_ENTRY_AVERAGES),
    ];
    const outOfOrder = withEntries(outOfOrderEntries);
    expect(isAccepted(outOfOrder)).toBe(false);
  });
});

describe('ABClass metadata timestamp contract', () => {
  it('accepts canonical real UTC timestamps only', () => {
    const canonical = metadataCandidate(
      { ...DEFAULT_CLASS_AVERAGES, updatedAt: CANONICAL_METADATA_TIMESTAMP },
      []
    );
    expect(isAccepted(canonical)).toBe(true);
  });

  it.each([
    '2026-02-30T09:33:28.588Z',
    '2026-10-19T25:33:28.588Z',
    '2026-10-19T09:33:28+00:00',
    '2026-10-19',
    '2026-10-19T09:33:28Z',
    '2026-10-19T09:33:28.588Z_2',
  ])('rejects non-canonical class-average timestamp %s', (updatedAt) => {
    const probed = metadataCandidate({ ...DEFAULT_CLASS_AVERAGES, updatedAt }, []);
    expect(isAccepted(probed)).toBe(false);
  });

  it('rejects non-canonical recent-entry timestamps', () => {
    for (const updatedAt of [
      '2026-02-30T09:33:28.588Z',
      '2026-10-19T09:33:28+00:00',
      '2026-10-19',
      '2026-10-19T09:33:28Z',
    ]) {
      const probed = withEntries([entryWithTimestamp(updatedAt)]);
      expect(isAccepted(probed)).toBe(false);
    }
  });
});
