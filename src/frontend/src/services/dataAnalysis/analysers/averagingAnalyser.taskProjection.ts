import type { AverageContribution, MetricResult, PerStudentTaskMetric } from '../dataAnalysis.zod';
import { resolveDisplayMetric } from './averagingAnalyser.metricResolution';
import type { DataPointAccumulator } from './averagingAnalyser.types';

/**
 * Narrow a task display metric and reject aggregate-only state.
 * @param {MetricResult} metric - Metric to narrow.
 * @returns {Extract<MetricResult, { state: 'computed' | 'notAttempted' | 'error' }>} Display metric.
 */
export function toTaskDisplayMetric(
  metric: MetricResult
): Extract<MetricResult, { state: 'computed' | 'notAttempted' | 'error' }> {
  if (metric.state === 'excluded')
    throw new Error('toTaskDisplayMetric: task-level display must not emit excluded');
  return metric;
}

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
      const averageContribution = contributions.get(taskKey);
      if (!averageContribution)
        throw new Error(
          `buildPerStudentTaskMetrics: missing averageContribution for taskKey '${taskKey}'`
        );
      metrics.push({
        classId,
        studentId,
        taskKey,
        averageContribution,
        completeness: toTaskDisplayMetric(resolveDisplayMetric(accum.completeness)),
        accuracy: toTaskDisplayMetric(resolveDisplayMetric(accum.accuracy)),
        spag: toTaskDisplayMetric(resolveDisplayMetric(accum.spag)),
        overall: toTaskDisplayMetric(resolveDisplayMetric(accum.overall)),
      });
    }
  }
  metrics.sort(
    (a, b) => a.studentId.localeCompare(b.studentId) || a.taskKey.localeCompare(b.taskKey)
  );
  return metrics;
}
