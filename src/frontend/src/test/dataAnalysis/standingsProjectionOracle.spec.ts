/**
 * Focused tests for the standings projection oracle.
 *
 * The oracle is a structural mapping: its behaviour depends only on metric
 * states and the number of per-entry score sets. Small controlled inputs built
 * with the shared `createMetricResult` builder probe that boundary directly,
 * rather than depending on a realistic analysis fixture.
 *
 * @module test/dataAnalysis/standingsProjectionOracle.spec
 */

import { describe, expect, it } from 'vitest';
import type {
  MetricScores,
  MetricStanding,
  MetricStandings,
} from '@/services/dataAnalysis/classSummary.zod';
import { createMetricResult } from './fixtures';
import { projectMetricStandings } from './standingsProjectionOracle';

const BASIS_COMPLETENESS = 3;
const NEWEST_COMPLETENESS = 4.5;
const NEWEST_OVERALL = 4.25;
const OLDER_COMPLETENESS = 2;
const OLDER_OVERALL = 1.75;
const SINGLE_SCORE_COUNT = 1;

/** Composes four analyser-native criterion results into one score set.
 * @param {MetricScores['completeness']} completeness - Completeness result.
 * @param {MetricScores['accuracy']} accuracy - Accuracy result.
 * @param {MetricScores['spag']} spag - SPaG result.
 * @param {MetricScores['overall']} overall - Overall result.
 * @returns {MetricScores} The composed score set.
 */
function metricScores(
  completeness: MetricScores['completeness'],
  accuracy: MetricScores['accuracy'],
  spag: MetricScores['spag'],
  overall: MetricScores['overall']
): MetricScores {
  return { completeness, accuracy, spag, overall };
}

/** Builds one standing with a fixed basis and the supplied recent score sets.
 * @param {string} studentId - Student identity for the entry.
 * @param {MetricScores[]} recent - Newest-first recent score sets.
 * @returns {MetricStanding} The analyser-native standing entry.
 */
function standing(studentId: string, recent: MetricScores[]): MetricStanding {
  return {
    studentId,
    studentName: `${studentId} student`,
    scores: metricScores(
      createMetricResult('computed', { value: BASIS_COMPLETENESS }),
      createMetricResult('notAttempted'),
      createMetricResult('error'),
      createMetricResult('excluded')
    ),
    recentAssignmentScores: recent,
  };
}

const newestScores = metricScores(
  createMetricResult('computed', { value: NEWEST_COMPLETENESS }),
  createMetricResult('notAttempted'),
  createMetricResult('error'),
  createMetricResult('computed', { value: NEWEST_OVERALL })
);
const olderScores = metricScores(
  createMetricResult('computed', { value: OLDER_COMPLETENESS }),
  createMetricResult('excluded'),
  createMetricResult('notAttempted'),
  createMetricResult('computed', { value: OLDER_OVERALL })
);

const standings: MetricStandings = {
  top: [standing('top-student', [newestScores, olderScores])],
  bottom: [standing('bottom-student', [newestScores, olderScores])],
};

const expectedBasis = {
  completeness: BASIS_COMPLETENESS,
  accuracy: 'N',
  spag: 'E',
  overall: 'excluded',
};
const expectedNewest = {
  completeness: NEWEST_COMPLETENESS,
  accuracy: 'N',
  spag: 'E',
  overall: NEWEST_OVERALL,
};
const expectedOlder = {
  completeness: OLDER_COMPLETENESS,
  accuracy: 'excluded',
  spag: 'N',
  overall: OLDER_OVERALL,
};

/** Builds the expected persisted entry for one student.
 * @param {string} studentId - Student identity for the entry.
 * @param {readonly typeof expectedNewest[]} recentAssignmentScores - Expected projected score sets.
 * @returns {object} The expected persisted standing entry.
 */
function expectedEntry(
  studentId: string,
  recentAssignmentScores: readonly (typeof expectedNewest)[]
) {
  return {
    studentId,
    studentName: `${studentId} student`,
    scores: expectedBasis,
    recentAssignmentScores,
  };
}

describe('projectMetricStandings', () => {
  it('projects every recent score set with the all signal', () => {
    expect(projectMetricStandings(standings, 'all')).toEqual({
      top: [expectedEntry('top-student', [expectedNewest, expectedOlder])],
      bottom: [expectedEntry('bottom-student', [expectedNewest, expectedOlder])],
    });
  });

  it('keeps only the newest score set when the count is one', () => {
    expect(projectMetricStandings(standings, SINGLE_SCORE_COUNT)).toEqual({
      top: [expectedEntry('top-student', [expectedNewest])],
      bottom: [expectedEntry('bottom-student', [expectedNewest])],
    });
  });

  it('projects empty top and bottom lists', () => {
    const empty: MetricStandings = { top: [], bottom: [] };
    expect(projectMetricStandings(empty, 'all')).toEqual({ top: [], bottom: [] });
    expect(projectMetricStandings(empty, SINGLE_SCORE_COUNT)).toEqual({ top: [], bottom: [] });
  });
});
