import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMetadataRefreshFixture,
  newestAssignment,
  recentEntry,
  SUMMARY_TIME,
} from '@/test/abClass/metadataRefreshFixtures';
import { getMetadataRefreshDecision } from './metadataProjection';

afterEach(() => vi.restoreAllMocks());

describe('getMetadataRefreshDecision assignment-version eligibility', () => {
  it('skips an empty complete class without creating metadata', () => {
    const { classFull } = createMetadataRefreshFixture('small');
    classFull.assignments = [];
    classFull.metadata = null;
    expect(getMetadataRefreshDecision(classFull)).toEqual({
      status: 'skipped',
      reason: 'noAssignments',
    });
  });

  it('selects exactly the newest assignment from the complete class without mutation or a clock', () => {
    const { classFull } = createMetadataRefreshFixture('small');
    classFull.metadata = null;
    const before = structuredClone(classFull);
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Pure selector read the clock');
    });
    expect(getMetadataRefreshDecision(classFull)).toEqual({
      status: 'changed',
      target: newestAssignment(classFull),
    });
    expect(classFull).toEqual(before);
    expect(clock).not.toHaveBeenCalled();
  });

  it('breaks target timestamp ties by assignment ID ascending without reordering input', () => {
    const { classFull } = createMetadataRefreshFixture('medium');
    classFull.metadata = null;
    classFull.assignments.forEach((assignment) => {
      assignment.updatedAt = SUMMARY_TIME;
    });
    classFull.assignments.reverse();
    const before = structuredClone(classFull);
    expect(getMetadataRefreshDecision(classFull)).toEqual({
      status: 'changed',
      target: newestAssignment(classFull),
    });
    expect(classFull).toEqual(before);
  });

  it('uses only target ID and timestamp, ignoring changed supplied scores and summary time', () => {
    const { classFull } = createMetadataRefreshFixture('small');
    const entry = recentEntry(classFull, classFull.assignments.length - 1);
    classFull.metadata = {
      classAverages: { ...entry.averages, updatedAt: SUMMARY_TIME },
      recentAssignments: [entry],
    };
    expect(getMetadataRefreshDecision(classFull)).toEqual({
      status: 'skipped',
      reason: 'unchanged',
    });
  });

  it.each(['same ID', 'different newest ID'] as const)(
    'rejects an older cached target against %s',
    (probe) => {
      const { classFull } = createMetadataRefreshFixture('medium');
      const entry = recentEntry(classFull, classFull.assignments.length - 1);
      entry.updatedAt = SUMMARY_TIME;
      if (probe === 'different newest ID') entry.assignmentId = 'newer-stored-instance';
      classFull.metadata = {
        classAverages: { ...entry.averages, updatedAt: SUMMARY_TIME },
        recentAssignments: [entry],
      };
      expect(getMetadataRefreshDecision(classFull)).toEqual({
        status: 'skipped',
        reason: 'staleSource',
      });
    }
  );

  it('permits equal timestamps belonging to different assignment instances', () => {
    const { classFull } = createMetadataRefreshFixture('medium');
    const entry = recentEntry(classFull, classFull.assignments.length - 1);
    entry.assignmentId = 'another-instance';
    classFull.metadata = {
      classAverages: { ...entry.averages, updatedAt: SUMMARY_TIME },
      recentAssignments: [entry],
    };
    expect(getMetadataRefreshDecision(classFull)).toMatchObject({ status: 'changed' });
  });

  it.each([
    null,
    '',
    '2026-02-30T00:00:00.000Z',
    '2026-01-01T00:00:00+00:00',
    '2026-01-01T00:00:00.000Z-1',
  ])('fails malformed candidate timestamp %s rather than substituting time', (timestamp) => {
    const { classFull } = createMetadataRefreshFixture('small');
    classFull.metadata = null;
    classFull.assignments[0].updatedAt = timestamp;
    expect(() => getMetadataRefreshDecision(classFull)).toThrow();
  });
});
