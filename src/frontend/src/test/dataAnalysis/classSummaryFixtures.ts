/**
 * Shared class-summary test fixtures.
 *
 * Owns the validated medium historical-source input, summary options and score
 * derivation helpers used by `classSummaryAnalyser.spec.ts` and
 * `classSummaryAnalyser.boundary.spec.ts`. Both specs import these builders from
 * here, so a change to a shared fixture shape shows up in both suites.
 *
 * @module test/dataAnalysis/classSummaryFixtures
 */

import mediumClassesByIdRaw from '@synthetic/medium/classesById.json?raw';
import mediumPartialsRaw from '@synthetic/medium/assignmentDefinitionPartials.json?raw';
import { ClassSummaryAnalyser } from '@/services/dataAnalysis/classSummaryAnalyser';
import { ClassSummarySchema, type ClassSummary } from '@/services/dataAnalysis/classSummary.zod';
import {
  AveragingAnalyser,
  DEFAULT_CRITERION_WEIGHTINGS,
} from '@/services/dataAnalysis/analysers/averagingAnalyser';
import { computeOverallComposite } from '@/services/dataAnalysis/analysers/averagingAnalyser.composite';
import { convertToBaselineExcluded } from '@/services/dataAnalysis/analysers/averagingAnalyser.rows';
import { rollupMetric } from '@/services/dataAnalysis/analysers/rollupMetric';
import {
  type AnalysisMode,
  AveragingAnalyserInputSchema,
  type AveragingAnalyserInput,
  type MetricResult,
  type PerStudentTaskMetric,
} from '@/services/dataAnalysis/dataAnalysis.zod';
import type { AssignmentPartial } from '@/services/googleClassrooms/classDetail/classDetailService.zod';

/** Canonical profile class analysed in depth by the class-summary specs. */
const MEDIUM_CLASS_ID = 'class-0';

/** Index of the committed final assignment with the null-studentName boundary. */
const FINAL_ASSIGNMENT_INDEX = -1;

/** Narrow metric-score set derived from the public summary shape. */
export type MetricScores = ClassSummary['allTasks']['classAverages'];

/** Options passed to the summary entry point. */
export interface SummaryOptions {
  target: AssignmentPartial;
  recentAssignments: AssignmentPartial[];
}

/**
 * Build the validated medium input over the historical-source class slice.
 *
 * @param {AnalysisMode} analysisMode - The mode recorded in the input's filter.
 * @returns {AveragingAnalyserInput} The parsed analysis input.
 */
export function buildMediumInput(analysisMode: AnalysisMode): AveragingAnalyserInput {
  const classesById = JSON.parse(mediumClassesByIdRaw) as Record<
    string,
    { assignments: unknown[] }
  >;
  const classRecord = classesById[MEDIUM_CLASS_ID];
  // The committed final assignment holds the null-studentName boundary.
  const historicalSourceClass = {
    ...classRecord,
    assignments: classRecord.assignments.slice(0, FINAL_ASSIGNMENT_INDEX),
  };
  return AveragingAnalyserInputSchema.parse({
    filter: { classIds: [MEDIUM_CLASS_ID], analysisMode },
    classes: [historicalSourceClass],
    assignmentDefinitionPartials: JSON.parse(mediumPartialsRaw),
  });
}

/**
 * Build summary options from an input's newest assignments, newest first.
 *
 * @param {AveragingAnalyserInput} input - The validated analysis input.
 * @param {number} recentAssignmentCount - Number of recent assignments to supply.
 * @returns {SummaryOptions} The target and newest-first recent assignments.
 */
export function buildSummaryOptions(
  input: AveragingAnalyserInput,
  recentAssignmentCount: number
): SummaryOptions {
  const assignments = input.classes[0].assignments.toReversed().slice(0, recentAssignmentCount);
  const target = assignments[0];
  if (!target) throw new Error('classSummaryAnalyser spec: no target assignment available');
  return { target, recentAssignments: assignments };
}

/**
 * Run the summary analyser and validate its output through ClassSummarySchema.
 *
 * @param {AveragingAnalyserInput} input - The validated analysis input.
 * @param {SummaryOptions} options - Target and recent assignments.
 * @returns {ClassSummary} The validated summary.
 */
export function analyseSummary(
  input: AveragingAnalyserInput,
  options: SummaryOptions
): ClassSummary {
  return ClassSummarySchema.parse(new ClassSummaryAnalyser().analyse(input, options));
}

/**
 * Run an absolute-mode AveragingAnalyser over a single assignment instance.
 *
 * @param {AveragingAnalyserInput} input - The full validated input.
 * @param {AssignmentPartial} assignment - The assignment to isolate.
 * @returns {ReturnType<AveragingAnalyser['analyse']>[number]} The isolated result.
 */
export function isolatedAbsoluteResult(
  input: AveragingAnalyserInput,
  assignment: AssignmentPartial
) {
  const isolatedInput: AveragingAnalyserInput = {
    ...input,
    classes: [{ ...input.classes[0], assignments: [assignment] }],
  };
  return new AveragingAnalyser().analyse(isolatedInput)[0];
}

/**
 * Project one aggregate row onto the four-metric summary score set.
 *
 * @param {object} metrics - The four aggregate metrics.
 * @param {MetricResult} metrics.completeness - Completeness result.
 * @param {MetricResult} metrics.accuracy - Accuracy result.
 * @param {MetricResult} metrics.spag - SPaG result.
 * @param {MetricResult} metrics.overall - Overall composite result.
 * @returns {MetricScores} The projected score set.
 */
export function projectMetrics(metrics: {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
  overall: MetricResult;
}): MetricScores {
  return {
    completeness: metrics.completeness,
    accuracy: metrics.accuracy,
    spag: metrics.spag,
    overall: metrics.overall,
  };
}

/**
 * Independently derive one student's baseline-restricted score set for one
 * isolated assignment, reusing the production rollup helpers named above.
 *
 * @param {AveragingAnalyserInput} input - The full validated input.
 * @param {ReadonlySet<string>} baselineTaskKeys - Whole-class baseline task keys.
 * @param {AssignmentPartial} assignment - The isolated assignment.
 * @param {string} studentId - The ranked student.
 * @returns {MetricScores} The expected baseline score set.
 */
export function expectedBaselineScores(
  input: AveragingAnalyserInput,
  baselineTaskKeys: ReadonlySet<string>,
  assignment: AssignmentPartial,
  studentId: string
): MetricScores {
  const isolatedMetrics = isolatedAbsoluteResult(input, assignment).perStudentTaskMetrics ?? [];
  const forStudent = isolatedMetrics.filter((metric) => metric.studentId === studentId);
  const inBaseline = forStudent.filter((metric) => baselineTaskKeys.has(metric.taskKey));
  const source = inBaseline.length > 0 ? inBaseline : forStudent;
  const shouldConvert = inBaseline.length === 0;
  const rollupFor = (criterion: 'completeness' | 'accuracy' | 'spag'): MetricResult => {
    const rolled = rollupMetric(
      source.map((metric: PerStudentTaskMetric) => metric[criterion]),
      criterion
    );
    return shouldConvert ? convertToBaselineExcluded(rolled) : rolled;
  };
  const completeness = rollupFor('completeness');
  const accuracy = rollupFor('accuracy');
  const spag = rollupFor('spag');
  return {
    completeness,
    accuracy,
    spag,
    overall: computeOverallComposite(completeness, accuracy, spag, DEFAULT_CRITERION_WEIGHTINGS),
  };
}
