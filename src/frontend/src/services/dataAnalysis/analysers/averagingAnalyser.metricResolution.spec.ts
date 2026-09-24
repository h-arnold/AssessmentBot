import { describe, expect, it } from 'vitest';
import { computeOverallComposite } from './averagingAnalyser.composite';
import { createAccumulator } from './averagingAnalyser.accumulatorRegistry';
import { resolveAggregateMetric, resolveDisplayMetric } from './averagingAnalyser.metricResolution';
import { AveragingAnalyser } from './averagingAnalyser';
import smallManifestRaw from '../../../../../../tests/__mocks__/data/synthetic-analysis/small/manifest.json?raw';
import smallPartialsRaw from '../../../../../../tests/__mocks__/data/synthetic-analysis/small/assignmentDefinitionPartials.json?raw';
import smallClassesRaw from '../../../../../../tests/__mocks__/data/synthetic-analysis/small/classesById.json?raw';
import {
  createComputedMetricResult,
  createErrorMetricResult,
  createExcludedMetricResult,
  createNotAttemptedMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import { FLOAT_TOLERANCE } from '../../../test/dataAnalysis/averagingAnalyserAssertions';
import {
  AveragingAnalyserInputSchema,
  AveragingResultSchema,
  type AveragingAnalyserInput,
} from '../dataAnalysis.zod';

const WEIGHTS = { completeness: 0.4, accuracy: 0.4, spag: 0.2 };
const EXPECTED_SMALL_SEED = 17_031;
const EXPECTED_SCORE = 6;
const EXPECTED_COMPOSITE_VALUE = 3.8;
const EXPECTED_SINGLE_CRITERION_VALUE = 3;
const EXPECTED_ERROR_EXCLUDED_VALUE = 4;
const EXPECTED_ERROR_EXCLUDED_DENOMINATOR = 0.6;

type CanonicalSubmission = {
  items: Record<string, { assessments?: { completeness?: { score: number | 'N' } } }>;
};
type CanonicalAssignment = {
  assignmentId: string;
  assignmentDefinitionKey: string;
  submissions: CanonicalSubmission[];
};
type CanonicalClass = { classId: string; assignments: CanonicalAssignment[] } & Record<
  string,
  unknown
>;
type CanonicalPartial = {
  definitionKey: string;
  assignmentWeighting: number | null;
  tasks: Array<{ taskId: string; taskWeighting: number }>;
} & Record<string, unknown>;
/**
 * Create a metric accumulator with optional boundary fields.
 * @param {Partial<ReturnType<typeof createAccumulator>>} [overrides] - Fields to replace.
 * @returns {ReturnType<typeof createAccumulator>} The configured accumulator.
 */
function createMetricAccumulator(
  overrides: Partial<ReturnType<typeof createAccumulator>> = {}
): ReturnType<typeof createAccumulator> {
  return { ...createAccumulator(), ...overrides };
}

describe('metric resolution boundaries', () => {
  it('resolves aggregate numeric contribution before other evidence', () => {
    const result = resolveAggregateMetric(
      createMetricAccumulator({
        weightedSum: 8,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 3,
        nCount: 1,
        displaySum: 8,
        displayCount: 2,
        displayNCount: 1,
        displayTotalDataPoints: 3,
      })
    );

    expect(result).toEqual({
      state: 'computed',
      value: 4,
      totalWeight: 2,
      applicableDataPoints: 2,
      totalDataPoints: 3,
    });
  });

  it('resolves positive-weight raw N as notAttempted when no numeric contribution exists', () => {
    const result = resolveAggregateMetric(
      createMetricAccumulator({
        nCount: 1,
        totalWeight: 1,
        totalDataPoints: 1,
        displayNCount: 1,
        displayTotalDataPoints: 1,
      })
    );

    expect(result).toEqual({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 1,
      applicableDataPoints: 0,
      totalDataPoints: 1,
    });
  });

  it('resolves observed non-contributing evidence as excluded', () => {
    const result = resolveAggregateMetric(
      createMetricAccumulator({
        displaySum: 5,
        displayCount: 1,
        displayTotalDataPoints: 1,
      })
    );

    expect(result).toEqual({
      state: 'excluded',
      value: null,
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 1,
    });
  });

  it('resolves no aggregate evidence as error', () => {
    expect(resolveAggregateMetric(createMetricAccumulator())).toEqual({
      state: 'error',
      value: 'E',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 0,
    });
  });

  it('resolves display numeric evidence without applying contribution weight', () => {
    const result = resolveDisplayMetric(
      createMetricAccumulator({
        displaySum: 7,
        displayCount: 2,
        displayTotalDataPoints: 2,
        totalWeight: 0,
      })
    );

    expect(result).toEqual({
      state: 'computed',
      value: 3.5,
      totalWeight: 0,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });
  });

  it('resolves display raw N before no display evidence', () => {
    const result = resolveDisplayMetric(
      createMetricAccumulator({
        displayNCount: 1,
        displayTotalDataPoints: 1,
        totalWeight: 0,
      })
    );

    expect(result).toEqual({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 1,
    });
  });

  it('prefers display numeric evidence over display raw N', () => {
    const result = resolveDisplayMetric(
      createMetricAccumulator({
        displaySum: 4,
        displayCount: 1,
        displayNCount: 1,
        displayTotalDataPoints: 2,
        totalWeight: 0,
      })
    );

    expect(result).toMatchObject({
      state: 'computed',
      value: 4,
      totalDataPoints: 2,
    });
  });

  it('resolves no display evidence as error', () => {
    expect(resolveDisplayMetric(createMetricAccumulator())).toEqual({
      state: 'error',
      value: 'E',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 0,
    });
  });
});

describe('aggregate metric state resolution', () => {
  it('resolves overall all-excluded criteria to excluded', () => {
    const result = computeOverallComposite(
      createExcludedMetricResult(),
      createExcludedMetricResult(),
      createExcludedMetricResult(),
      WEIGHTS
    );

    expect(result).toMatchObject({ state: 'excluded', value: null, totalWeight: 0 });
  });

  it('resolves excluded plus error criteria to excluded, not error', () => {
    const result = computeOverallComposite(
      createExcludedMetricResult(),
      createErrorMetricResult(),
      createExcludedMetricResult(),
      WEIGHTS
    );

    expect(result).toMatchObject({ state: 'excluded', value: null });
  });

  it('resolves excluded plus a positive contribution to computed', () => {
    const result = computeOverallComposite(
      createExcludedMetricResult(),
      createComputedMetricResult({ value: EXPECTED_SCORE, totalWeight: 1 }),
      createExcludedMetricResult(),
      WEIGHTS
    );

    expect(result.state).toBe('computed');
    expect(result.value).toBeCloseTo(EXPECTED_SCORE, FLOAT_TOLERANCE);
    expect(result.totalWeight).toBe(1);
  });

  it('renormalises a positive criterion when other criteria have zero weighting', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createErrorMetricResult({ totalDataPoints: 1 }),
      createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      { completeness: 1, accuracy: 0, spag: 0 }
    );

    expect(result).toMatchObject({
      state: 'computed',
      value: 4,
      totalWeight: 2,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });
  });

  it('resolves all-error criteria to error', () => {
    const result = computeOverallComposite(
      createErrorMetricResult(),
      createErrorMetricResult(),
      createErrorMetricResult(),
      WEIGHTS
    );

    expect(result).toMatchObject({ state: 'error', value: 'E' });
  });

  it('preserves zero-observation notAttempted placeholders as notAttempted', () => {
    const noData = createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 0 });
    const result = computeOverallComposite(noData, noData, noData, WEIGHTS);

    expect(result).toMatchObject({ state: 'notAttempted', totalDataPoints: 0 });
  });

  it('resolves zero-weight observed raw notAttempted criteria to excluded', () => {
    const zeroWeightObservedN = createNotAttemptedMetricResult({
      totalWeight: 0,
      totalDataPoints: 1,
    });
    const result = computeOverallComposite(
      zeroWeightObservedN,
      zeroWeightObservedN,
      zeroWeightObservedN,
      WEIGHTS
    );

    expect(result).toMatchObject({
      state: 'excluded',
      value: null,
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 3,
    });
  });

  it('sums metadata across computed criteria rather than using Math.max', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createComputedMetricResult({
        value: 4,
        totalWeight: 20,
        applicableDataPoints: 3,
        totalDataPoints: 3,
      }),
      createComputedMetricResult({
        value: 5,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      }),
      WEIGHTS
    );
    expect(result).toMatchObject({
      state: 'computed',
      totalWeight: 35,
      applicableDataPoints: 6,
      totalDataPoints: 6,
    });
    expect(result.value).toBeCloseTo(EXPECTED_COMPOSITE_VALUE, FLOAT_TOLERANCE);
  });

  it('sums only computed metadata when other criteria are notAttempted', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      WEIGHTS
    );
    expect(result).toMatchObject({
      state: 'computed',
      totalWeight: 10,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });
    expect(result.value).toBeCloseTo(EXPECTED_SINGLE_CRITERION_VALUE, FLOAT_TOLERANCE);
  });

  it('sums totalDataPoints across all error criteria', () => {
    const result = computeOverallComposite(
      createErrorMetricResult({ totalDataPoints: 2 }),
      createErrorMetricResult({ totalDataPoints: 3 }),
      createErrorMetricResult({ totalDataPoints: 1 }),
      WEIGHTS
    );
    expect(result).toMatchObject({
      state: 'error',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 6,
    });
  });

  it('sums totalDataPoints across all notAttempted criteria', () => {
    const result = computeOverallComposite(
      createNotAttemptedMetricResult({ totalWeight: 1, totalDataPoints: 4 }),
      createNotAttemptedMetricResult({ totalWeight: 1, totalDataPoints: 2 }),
      createNotAttemptedMetricResult({ totalWeight: 1, totalDataPoints: 1 }),
      WEIGHTS
    );
    expect(result).toMatchObject({
      state: 'notAttempted',
      totalWeight: 3,
      applicableDataPoints: 0,
      totalDataPoints: 7,
    });
  });

  it('excludes an error criterion from the weighted average', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 8,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createErrorMetricResult({ totalDataPoints: 1 }),
      createComputedMetricResult({
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      }),
      WEIGHTS
    );
    expect(result).toMatchObject({
      state: 'computed',
      totalWeight: 3,
      applicableDataPoints: 3,
      totalDataPoints: 3,
    });
    expect(result.value).toBeCloseTo(
      EXPECTED_ERROR_EXCLUDED_VALUE / EXPECTED_ERROR_EXCLUDED_DENOMINATOR,
      FLOAT_TOLERANCE
    );
  });

  it('keeps composite applicable points bounded by total points', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 5,
        totalWeight: 10,
        applicableDataPoints: 5,
        totalDataPoints: 10,
      }),
      createComputedMetricResult({
        value: 4,
        totalWeight: 10,
        applicableDataPoints: 8,
        totalDataPoints: 10,
      }),
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 1,
        totalDataPoints: 10,
      }),
      WEIGHTS
    );
    expect(result.state).toBe('computed');
    expect(result.applicableDataPoints).toBeLessThanOrEqual(result.totalDataPoints);
  });

  it('analyses a cloned canonical small profile after a live weighting mutation', () => {
    const manifest = JSON.parse(smallManifestRaw) as { seed: number };
    const partials = JSON.parse(smallPartialsRaw) as CanonicalPartial[];
    const classes = JSON.parse(smallClassesRaw) as Record<string, CanonicalClass>;
    const sourceClass = classes['class-0'];
    const sourceAssignment = sourceClass.assignments.find(
      (assignment) => assignment.assignmentDefinitionKey === 'definition-1-sheets'
    );
    const definition = partials.find((partial) => partial.definitionKey === 'definition-1-sheets');
    expect(sourceAssignment).toBeDefined();
    expect(definition).toBeDefined();
    const selectedAssignment = sourceAssignment!;

    const clone = structuredClone({ class: sourceClass, definition: definition! });
    // The analyser supports a minimal projection of the canonical class when
    // the scenario concerns one definition; no fixture values are invented.
    clone.class.assignments = [
      clone.class.assignments.find(
        (assignment) => assignment.assignmentId === selectedAssignment.assignmentId
      )!,
    ];
    const assessedItem = clone.class.assignments.find(
      (assignment) => assignment.assignmentId === selectedAssignment.assignmentId
    )!.submissions[0].items['task-1-0']!;
    const expectedDisplayScore = assessedItem.assessments!.completeness!.score;
    clone.definition.assignmentWeighting = 0;

    expect(manifest.seed).toBe(EXPECTED_SMALL_SEED);
    const unvalidatedInput = {
      filter: { classIds: [clone.class.classId] },
      classes: [clone.class],
      assignmentDefinitionPartials: [clone.definition],
    } as AveragingAnalyserInput;
    const input = AveragingAnalyserInputSchema.parse(unvalidatedInput);
    const result = new AveragingAnalyser().analyse(input)[0];
    const validatedResult = AveragingResultSchema.parse(result);

    expect(validatedResult.perStudentTaskMetrics![0].averageContribution).toEqual({
      effectiveWeight: 0,
      includedInAverage: false,
    });
    expect(validatedResult.perStudentTaskMetrics![0].completeness).toMatchObject({
      state: 'computed',
      value: expectedDisplayScore,
      totalWeight: 0,
    });
    expect(validatedResult.perTask[0].averageContribution).toEqual({
      effectiveWeight: 0,
      includedInAverage: false,
    });
    expect(validatedResult.perClass.completeness).toMatchObject({
      state: 'excluded',
      value: null,
      totalWeight: 0,
    });
    expect(validatedResult.perClass.completeness.totalDataPoints).toBeGreaterThanOrEqual(1);
  });
});
