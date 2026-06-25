import type { PerStudentRow, PerTaskRow } from '../dataAnalysis.zod';
import { accumToMetric } from './averagingAnalyser.types';
import type { DataPointAccumulator } from './averagingAnalyser.types';

/**
 * Build sorted per-student rows from accumulators.
 *
 * @param {Map<string, { studentName: string | null } & DataPointAccumulator>}
 *   studentAccums - Map of studentId to accumulator data.
 * @returns {PerStudentRow[]} Sorted per-student result rows.
 */
export function buildPerStudentRows(
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>
): PerStudentRow[] {
  const rows: PerStudentRow[] = [];

  for (const [studentId, accumulator] of studentAccums) {
    rows.push({
      studentId,
      studentName: accumulator.studentName,
      completeness: accumToMetric(accumulator.completeness),
      accuracy: accumToMetric(accumulator.accuracy),
      spag: accumToMetric(accumulator.spag),
      overall: accumToMetric(accumulator.overall),
    });
  }

  return rows.toSorted((a, b) => {
    const nameComparison = (a.studentName ?? '').localeCompare(b.studentName ?? '');
    if (nameComparison !== 0) return nameComparison;
    return a.studentId.localeCompare(b.studentId);
  });
}

/**
 * Build sorted per-task rows from accumulators.
 *
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - Map of composite key to accumulator data.
 * @returns {PerTaskRow[]} Sorted per-task result rows.
 */
export function buildPerTaskRows(
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>
): PerTaskRow[] {
  const rows: PerTaskRow[] = [];

  for (const [, accumulator] of taskAccums) {
    rows.push({
      definitionKey: accumulator.definitionKey,
      taskId: accumulator.taskId,
      taskTitle: null,
      completeness: accumToMetric(accumulator.completeness),
      accuracy: accumToMetric(accumulator.accuracy),
      spag: accumToMetric(accumulator.spag),
      overall: accumToMetric(accumulator.overall),
    });
  }

  return rows.toSorted((a, b) => {
    const definitionComparison = a.definitionKey.localeCompare(b.definitionKey);
    if (definitionComparison !== 0) return definitionComparison;
    return a.taskId.localeCompare(b.taskId);
  });
}
