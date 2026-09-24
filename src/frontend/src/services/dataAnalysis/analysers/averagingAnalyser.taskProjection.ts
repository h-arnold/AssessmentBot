import type { AverageContribution, PerStudentTaskMetric } from '../dataAnalysis.zod';
import { requireAverageContribution } from './averagingAnalyser.accumulatorRegistry';
import { resolveDisplayMetric } from './averagingAnalyser.metricResolution';
import type { DataPointAccumulator } from './averagingAnalyser.types';

/**
 * Project per-student task accumulators into public task metrics.
 * @param {string} classId - Class identifier.
 * @param {Map<string, Map<string, DataPointAccumulator>>} perStudentTaskAccums - Internal accumulators.
 * @param {ReadonlyMap<string, AverageContribution>} contributions - Task contribution metadata.
 * @returns {PerStudentTaskMetric[]} Sorted task metrics.
 */
export function buildPerStudentTaskMetrics(
  classId: string,
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>,
  contributions: ReadonlyMap<string, AverageContribution>
): PerStudentTaskMetric[] {
  const metrics: PerStudentTaskMetric[] = [];
  for (const [studentId, taskMap] of perStudentTaskAccums) {
    for (const [taskKey, accum] of taskMap) {
      const averageContribution = requireAverageContribution(
        contributions,
        taskKey,
        'buildPerStudentTaskMetrics'
      );
      metrics.push({
        classId,
        studentId,
        taskKey,
        averageContribution,
        completeness: resolveDisplayMetric(accum.completeness),
        accuracy: resolveDisplayMetric(accum.accuracy),
        spag: resolveDisplayMetric(accum.spag),
        overall: resolveDisplayMetric(accum.overall),
      });
    }
  }
  metrics.sort(
    (a, b) => a.studentId.localeCompare(b.studentId) || a.taskKey.localeCompare(b.taskKey)
  );
  return metrics;
}
