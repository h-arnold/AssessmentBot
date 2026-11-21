/**
 * Test oracle for projecting analyser-native standings into persisted scores.
 *
 * The production `projectStandings` in `metadataProjection.ts` is private. This
 * helper derives the expected persisted shape from analyser-native values so
 * writer and merge specs can assert against it without calling that projector.
 * Individual score sets still go through the exported `projectAverageScores`,
 * matching the state mapping those specs asserted before consolidation.
 *
 * @module test/dataAnalysis/standingsProjectionOracle
 */

import type { StudentStanding, StudentStandings } from '@/services/abClass/abClassMetadata.zod';
import type {
  MetricScores,
  MetricStanding,
  MetricStandings,
} from '@/services/dataAnalysis/classSummary.zod';
import { projectAverageScores } from '@/services/dataAnalysis/postAnalysis/metadataProjection';

/** How many newest per-assignment score sets to keep in each persisted entry. */
export type RecentScoreCount = number | 'all';

/**
 * Projects one analyser-native standings basis into persisted score sets.
 *
 * @param {MetricStandings} standings - The basis's ranked top and bottom lists.
 * @param {RecentScoreCount} recentScoreCount - Number of newest score sets to
 * keep per entry, or `'all'` to keep the whole supplied list.
 * @returns {StudentStandings} Expected persisted standings.
 * @remarks The count is explicit: callers pass the persisted history count or
 * `'all'`. No default is inferred from the supplied array length.
 */
export function projectMetricStandings(
  standings: MetricStandings,
  recentScoreCount: RecentScoreCount
): StudentStandings {
  const recentScores = (entry: MetricStanding): MetricScores[] => {
    return recentScoreCount === 'all'
      ? entry.recentAssignmentScores
      : entry.recentAssignmentScores.slice(0, recentScoreCount);
  };

  const projectList = (entries: readonly MetricStanding[]): StudentStanding[] => {
    return entries.map((entry) => {
      return {
        studentId: entry.studentId,
        studentName: entry.studentName,
        scores: projectAverageScores(entry.scores),
        recentAssignmentScores: recentScores(entry).map((scores) => projectAverageScores(scores)),
      };
    });
  };

  return { top: projectList(standings.top), bottom: projectList(standings.bottom) };
}
