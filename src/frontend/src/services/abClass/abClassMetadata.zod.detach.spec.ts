import { describe, expect, it } from 'vitest';
import { ABClassMetadataSchema } from './abClassMetadata.zod';
import {
  CANONICAL_METADATA_TIMESTAMP,
  DEFAULT_ENTRY_AVERAGES,
  DEFAULT_SCORES,
  metadataWithSingleEntry,
  mutateFirstRecentEntry,
  recentAssignment,
  requireMetadataObject,
  type MetadataCandidateValues,
} from '@/test/abClass/abClassMetadataTestBuilders';

/** Non-null metadata snapshot returned by a successful schema parse. */
type ParsedSnapshot = ReturnType<typeof requireMetadataObject>;

/** Non-null recent-assignment entry of a parsed snapshot. */
type ParsedRecentEntry = ParsedSnapshot['recentAssignments'][number];

const INPUT_SCORE = 4;
const INPUT_ENTRY_SCORE = 2;
const INPUT_ENTRY_ID = 'input-changed';
const PARSED_SCORE = 1;
const PARSED_ENTRY_SCORE = 3;
const PARSED_ENTRY_ID = 'parsed-changed';
const SNAPSHOT_ENTRY_COUNT = 1;
const PERTURBED_ENTRY_COUNT = 2;

describe('ABClass metadata parsed detachment', () => {
  it('detaches arrays and nested entries from mutable caller input in both directions', () => {
    const input = metadataWithSingleEntry();
    const parsed = requireMetadataObject(ABClassMetadataSchema.parse(input));
    expect(parsed).not.toBe(input);
    expect(parsed.classAverages).not.toBe(input.classAverages);
    expect(parsed.recentAssignments).not.toBe(input.recentAssignments);
    expect(parsed.recentAssignments[0]).not.toBe(input.recentAssignments[0]);
    expect(parsed.recentAssignments[0].averages).not.toBe(input.recentAssignments[0].averages);
    perturbInput(input);
    expect(parsed.classAverages.completeness).toBe(DEFAULT_SCORES.completeness);
    expect(parsed.recentAssignments).toHaveLength(SNAPSHOT_ENTRY_COUNT);
    expect(parsed.recentAssignments[0].assignmentId).toBe('a');
    expect(parsed.recentAssignments[0].averages.accuracy).toBe(DEFAULT_ENTRY_AVERAGES.accuracy);
    perturbParsed(parsed);
    expect(input.classAverages.completeness).toBe(INPUT_SCORE);
    expect(input.recentAssignments).toHaveLength(PERTURBED_ENTRY_COUNT);
    expect(input.recentAssignments[0].assignmentId).toBe(INPUT_ENTRY_ID);
    expect(input.recentAssignments[0].averages.accuracy).toBe(INPUT_ENTRY_SCORE);
  });
});

/**
 * Mutates the caller's candidate after a parse snapshot has been taken.
 * @param {MetadataCandidateValues} candidate - Candidate mutated after the parse.
 * @returns {void} Mutates the candidate in place.
 */
function perturbInput(candidate: MetadataCandidateValues): void {
  candidate.classAverages.completeness = INPUT_SCORE;
  candidate.recentAssignments[0].averages.accuracy = INPUT_ENTRY_SCORE;
  candidate.recentAssignments[0].assignmentId = INPUT_ENTRY_ID;
  candidate.recentAssignments.push(
    recentAssignment('b', CANONICAL_METADATA_TIMESTAMP, DEFAULT_ENTRY_AVERAGES)
  );
}

/**
 * Builds one parsed recent entry with canonical detached values.
 * @param {string} assignmentId - Assignment identifier for the entry.
 * @returns {ParsedRecentEntry} A parsed-typed entry for detachment probes.
 */
function parsedEntry(assignmentId: string): ParsedRecentEntry {
  return {
    assignmentId,
    assignmentDefinitionKey: 'reused',
    averages: {
      completeness: PARSED_ENTRY_SCORE,
      accuracy: 'E',
      spag: 'excluded',
      overall: 'N',
    },
    updatedAt: CANONICAL_METADATA_TIMESTAMP,
  };
}

/**
 * Mutates the parsed output to prove parse results are not shared or frozen.
 * @param {ParsedSnapshot} parsed - Parsed schema value mutated in place.
 * @returns {void} Mutates the parsed snapshot in place.
 */
function perturbParsed(parsed: ParsedSnapshot): void {
  parsed.classAverages.completeness = PARSED_SCORE;
  mutateFirstRecentEntry(parsed, (entry) => {
    entry.averages.accuracy = PARSED_ENTRY_SCORE;
    entry.assignmentId = PARSED_ENTRY_ID;
  });
  parsed.recentAssignments.push(parsedEntry('c'));
}
