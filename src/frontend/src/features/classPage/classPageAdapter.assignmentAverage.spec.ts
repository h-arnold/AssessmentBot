/**
 * Focused adapter tests: per-assignment metric rollup and 40/40/20 average
 * composite behaviour for the Class page adapter (`classPageAdapter.ts`).
 *
 * @remarks
 * Split from the original single-file `classPageAdapter.spec.ts` to keep each
 * spec module under the 500-line `max-lines` lint threshold. Shared fixture
 * builders live in `src/test/classPage/classPageAdapterTestFixtures.ts`.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, expect, it } from 'vitest';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';
import {
  computedPerTaskRow,
  perTaskRow,
  singleAssignmentAdapterInput,
} from '../../test/classPage/classPageAdapterTestFixtures';
import { adaptClassPageToViewModel } from './classPageAdapter';
import type { PerTaskRow } from '../../services/dataAnalysis/dataAnalysis.zod';

describe('adaptClassPageToViewModel', () => {
  const CRITERION_COUNT = 3;
  const EXPECTED_MIXED_OVERALL = 3;
  describe('recentAssignments', () => {
    it('excludes observed all-zero-weight numeric task metrics without changing their task display values', () => {
      const zeroWeightedRow: PerTaskRow = {
        ...perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: createMetricResult('computed', { value: 4, totalWeight: 0 }),
          accuracy: createMetricResult('computed', { value: 3, totalWeight: 0 }),
          spag: createMetricResult('computed', { value: 2, totalWeight: 0 }),
        }),
        averageContribution: { effectiveWeight: 0, includedInAverage: false },
      };
      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput([zeroWeightedRow], ['t1'])
      );

      for (const metric of Object.values(result.recentAssignments[0].metrics)) {
        expect(metric).toMatchObject({
          state: 'excluded',
          value: null,
          totalWeight: 0,
          applicableDataPoints: 0,
        });
        expect(metric.totalDataPoints).toBeGreaterThanOrEqual(1);
      }
      expect(zeroWeightedRow.completeness).toMatchObject({ state: 'computed', value: 4 });
    });

    it('excludes zero-weight raw N in the assignment aggregate while retaining raw N in the per-task row', () => {
      const zeroWeightedN: PerTaskRow = {
        ...perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: createMetricResult('notAttempted'),
          accuracy: createMetricResult('notAttempted'),
          spag: createMetricResult('notAttempted'),
        }),
        averageContribution: { effectiveWeight: 0, includedInAverage: false },
      };
      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput([zeroWeightedN], ['t1'])
      );

      expect(zeroWeightedN.completeness).toMatchObject({ state: 'notAttempted', value: 'N' });
      expect(result.recentAssignments[0].metrics.completeness.state).toBe('excluded');
      expect(result.recentAssignments[0].metrics.average.state).toBe('excluded');
    });

    it('keeps an all-error assignment as error', () => {
      const errors = perTaskRow({
        definitionKey: 'dk1',
        taskId: 't1',
        completeness: createMetricResult('error'),
        accuracy: createMetricResult('error'),
        spag: createMetricResult('error'),
      });
      const result = adaptClassPageToViewModel(singleAssignmentAdapterInput([errors], ['t1']));

      expect(result.recentAssignments[0].metrics.completeness.state).toBe('error');
      expect(result.recentAssignments[0].metrics.average.state).toBe('error');
    });

    it('uses only positive-weight numeric evidence for mixed-weight criterion and overall averages', () => {
      const positiveRow = perTaskRow({
        definitionKey: 'dk1',
        taskId: 't-positive',
        completeness: createMetricResult('computed', { value: 4, totalWeight: 2 }),
        accuracy: createMetricResult('computed', { value: 2, totalWeight: 2 }),
        spag: createMetricResult('computed', { value: 3, totalWeight: 2 }),
      });
      const zeroRow: PerTaskRow = {
        ...perTaskRow({
          definitionKey: 'dk1',
          taskId: 't-zero',
          completeness: createMetricResult('computed', { value: 0, totalWeight: 0 }),
          accuracy: createMetricResult('computed', { value: 0, totalWeight: 0 }),
          spag: createMetricResult('computed', { value: 0, totalWeight: 0 }),
        }),
        averageContribution: { effectiveWeight: 0, includedInAverage: false },
      };
      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput([positiveRow, zeroRow], ['t-positive', 't-zero'])
      );
      const metrics = result.recentAssignments[0].metrics;

      expect(metrics.completeness).toMatchObject({ state: 'computed', value: 4, totalWeight: 2 });
      expect(metrics.accuracy).toMatchObject({ state: 'computed', value: 2, totalWeight: 2 });
      expect(metrics.spag).toMatchObject({ state: 'computed', value: 3, totalWeight: 2 });
      expect(metrics.average.state).toBe('computed');
      if (metrics.average.state === 'computed') {
        expect(metrics.average.value).toBeCloseTo(EXPECTED_MIXED_OVERALL);
      }
    });

    it('rolls up per-task metrics into per-assignment values using rollupMetric', () => {
      // One assignment with 2 tasks.  PerTask rows for definitionKey 'dk1':
      //   Task t1: completeness=4, accuracy=3, spag=2
      //   Task t2: completeness=5, accuracy=4, spag=3
      const perTaskRows: PerTaskRow[] = [
        computedPerTaskRow('dk1', 't1', { completeness: 4, accuracy: 3, spag: 2 }),
        computedPerTaskRow('dk1', 't2', { completeness: 5, accuracy: 4, spag: 3 }),
      ];

      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput(perTaskRows, ['t1', 't2'])
      );

      expect(result.recentAssignments).toHaveLength(1);
      const assignmentMetrics = result.recentAssignments[0].metrics;

      const expectedCompletenessAverage = 4.5;
      const expectedAccuracyAverage = 3.5;
      const expectedSpagAverage = 2.5;

      // completeness: rollupMetric([computed(4,tw=1), computed(5,tw=1)], 'completeness')
      //   totalWeightedSum = 4*1 + 5*1 = 9
      //   computedTotalWeight = 2
      //   value = 9/2 = 4.5
      expect(assignmentMetrics.completeness.state).toBe('computed');
      if (assignmentMetrics.completeness.state === 'computed') {
        expect(assignmentMetrics.completeness.value).toBeCloseTo(expectedCompletenessAverage);
      }

      // accuracy: rollupMetric([computed(3,tw=1), computed(4,tw=1)], 'accuracy')
      //   totalWeightedSum = 3*1 + 4*1 = 7
      //   value = 7/2 = 3.5
      expect(assignmentMetrics.accuracy.state).toBe('computed');
      if (assignmentMetrics.accuracy.state === 'computed') {
        expect(assignmentMetrics.accuracy.value).toBeCloseTo(expectedAccuracyAverage);
      }

      // spag: rollupMetric([computed(2,tw=1), computed(3,tw=1)], 'spag')
      //   totalWeightedSum = 2*1 + 3*1 = 5
      //   value = 5/2 = 2.5
      expect(assignmentMetrics.spag.state).toBe('computed');
      if (assignmentMetrics.spag.state === 'computed') {
        expect(assignmentMetrics.spag.value).toBeCloseTo(expectedSpagAverage);
      }
    });

    it('computes per-assignment average as a composite with 40/40/20 weighting', () => {
      const perTaskRows: PerTaskRow[] = [
        computedPerTaskRow('dk1', 't1', { completeness: 5, accuracy: 3, spag: 2 }),
      ];

      const result = adaptClassPageToViewModel(singleAssignmentAdapterInput(perTaskRows, ['t1']));

      const average = result.recentAssignments[0].metrics.average;
      // Expected: 0.4 * 5 + 0.4 * 3 + 0.2 * 2 = 2.0 + 1.2 + 0.4 = 3.6
      const expectedAverageValue = 3.6;
      expect(average.state).toBe('computed');
      if (average.state === 'computed') {
        expect(average.value).toBeCloseTo(expectedAverageValue);
      }
    });

    it('retains an error criterion observation when computing an average from computed criteria', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: createMetricResult('computed', { value: 5, totalWeight: 1 }),
          accuracy: createMetricResult('error'),
          spag: createMetricResult('computed', { value: 3, totalWeight: 1 }),
        }),
      ];

      const result = adaptClassPageToViewModel(singleAssignmentAdapterInput(perTaskRows, ['t1']));

      const COMPOSITE_NUMERATOR = 2.6;
      const COMPOSITE_DENOMINATOR = 0.6;
      const EXPECTED_AVERAGE_VALUE = COMPOSITE_NUMERATOR / COMPOSITE_DENOMINATOR;
      const EXPECTED_SUM_TOTAL_WEIGHT = 2;
      const EXPECTED_SUM_AP = 2;
      const EXPECTED_SUM_TDP = 3;
      const average = result.recentAssignments[0].metrics.average;
      // completeness rollup → computed(5, tw=1), accuracy rollup → error, spag rollup → computed(3, tw=1)
      // computeAverageMetric with error-exclusion:
      // entries: completeness(0.4, 5) and spag(0.2, 3)
      // numerator = 0.4*5 + 0.2*3 = 2.0 + 0.6 = 2.6
      // denominator = 0.4 + 0.2 = 0.6
      // value = 2.6 / 0.6 = 4.333...
      expect(average.state).toBe('computed');
      if (average.state === 'computed') {
        expect(average.value).toBeCloseTo(EXPECTED_AVERAGE_VALUE);
        expect(average.totalWeight).toBe(EXPECTED_SUM_TOTAL_WEIGHT);
        expect(average.applicableDataPoints).toBe(EXPECTED_SUM_AP);
        expect(average.totalDataPoints).toBe(EXPECTED_SUM_TDP);
      }
    });

    it('sets per-assignment average to error only when all three criteria are error', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: createMetricResult('error'),
          accuracy: createMetricResult('error'),
          spag: createMetricResult('error'),
        }),
      ];

      const result = adaptClassPageToViewModel(singleAssignmentAdapterInput(perTaskRows, ['t1']));

      // All three rows are error → rollupMetric(all error) → error for each criterion
      // then computeAverageMetric(all three error) → error
      expect(result.recentAssignments[0].metrics.average.state).toBe('error');
    });

    it('sets per-assignment average to excluded for zero-weight observed raw N criteria', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: createMetricResult('notAttempted'),
          accuracy: createMetricResult('notAttempted'),
          spag: createMetricResult('notAttempted'),
        }),
      ];

      const result = adaptClassPageToViewModel(singleAssignmentAdapterInput(perTaskRows, ['t1']));

      expect(result.recentAssignments[0].metrics.average).toMatchObject({
        state: 'excluded',
        value: null,
      });
      expect(result.recentAssignments[0].metrics.average.totalDataPoints).toBeGreaterThan(0);
    });

    it('sets per-assignment average to notAttempted when raw N criteria have positive weight', () => {
      const positiveWeight = 1;
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: createMetricResult('notAttempted', { totalWeight: positiveWeight }),
          accuracy: createMetricResult('notAttempted', { totalWeight: positiveWeight }),
          spag: createMetricResult('notAttempted', { totalWeight: positiveWeight }),
        }),
      ];

      const result = adaptClassPageToViewModel(singleAssignmentAdapterInput(perTaskRows, ['t1']));

      const expectedTotalWeight = positiveWeight * CRITERION_COUNT;
      expect(result.recentAssignments[0].metrics.average).toMatchObject({
        state: 'notAttempted',
        totalWeight: expectedTotalWeight,
      });
    });

    it('renormalises the composite when SPaG is notAttempted (completeness + accuracy over 0.8)', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: createMetricResult('computed', { value: 4, totalWeight: 1 }),
          accuracy: createMetricResult('computed', { value: 4, totalWeight: 1 }),
          spag: createMetricResult('notAttempted'),
        }),
      ];

      const result = adaptClassPageToViewModel(singleAssignmentAdapterInput(perTaskRows, ['t1']));

      const average = result.recentAssignments[0].metrics.average;
      // SPaG is notAttempted → excluded.  Renormalised weights: 0.4/0.8 = 0.5 for each
      // Expected: 0.5 * 4 + 0.5 * 4 = 4.0
      const expectedSPaGExcludedAverage = 4;
      expect(average.state).toBe('computed');
      if (average.state === 'computed') {
        expect(average.value).toBeCloseTo(expectedSPaGExcludedAverage);
      }
    });
  });
});
