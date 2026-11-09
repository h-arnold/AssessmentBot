/** Row-building boundaries: date-range exclusion, null studentName and the rollupAccumulators helper. */

import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createClassFull,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';
import type { MetricResult } from '../dataAnalysis.zod';
import { expectMetricResultStateAware } from '@/test/dataAnalysis/averagingAnalyserAssertions';

describe('AveragingAnalyser', () => {
  describe('analyse — rows', () => {
    it('excludes student from perStudent when all submissions are filtered out by date range', () => {
      const assignmentOutsideDateRange = createAssignmentPartial({
        assignmentId: 'a_outside',
        definitionKey: 'dk_algebra',
        tasks: [createTaskPartial('t_001')],
        createdAt: '2026-01-01T00:00:00.000Z',
        submissions: [
          createSubmission('s_001', 'Alice', 'a_outside', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
          }),
          createSubmission('s_002', 'Bob', 'a_outside', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
          }),
        ],
      });
      const assignmentInsideDateRange = createAssignmentPartial({
        assignmentId: 'a_inside',
        definitionKey: 'dk_algebra',
        tasks: [createTaskPartial('t_001')],
        createdAt: '2026-06-15T00:00:00.000Z',
        submissions: [
          createSubmission('s_001', 'Alice', 'a_inside', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
          }),
        ],
      });
      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          analysisMode: 'absolute',
          dateRange: {
            from: '2026-01-02T00:00:00.000Z',
            to: '2027-01-01T00:00:00.000Z',
          },
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001', 's_002'],
            assignments: [assignmentOutsideDateRange, assignmentInsideDateRange],
          }),
        ],
        assignmentDefinitionPartials: [
          createDefinitionPartial({
            definitionKey: 'dk_algebra',
            tasks: [createTaskPartial('t_001')],
          }),
        ],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      // Alice has a submission in range (a_inside) → included
      expect(results[0].perStudent).toHaveLength(1);
      expect(results[0].perStudent[0].studentId).toBe('s_001');

      // Bob's only submission is on a_outside which is out of range → excluded

      // perClass only considers Alice's in-range submission
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('perStudent row building throws when a submission has a null studentName', () => {
      const assignmentWithNullStudentName = createAssignmentPartial({
        assignmentId: 'a_001',
        definitionKey: 'dk_algebra',
        tasks: [createTaskPartial('t_001')],
        submissions: [
          createSubmission('s_001', 'Alice', 'a_001', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
          }),
          createSubmission('s_002', null, 'a_001', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
          }),
        ],
      });
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001', 's_002'],
          assignments: [assignmentWithNullStudentName],
        },
      ]);

      const analyser = new AveragingAnalyser();
      expect(() => analyser.analyse(input)).toThrow();
    });
  });
});

describe('rollupAccumulators (exported)', () => {
  it('is exported and throws when called with empty accumulators iterable', async () => {
    const module_ = (await import('./averagingAnalyser.rows')) as unknown as {
      rollupAccumulators?: (...arguments_: unknown[]) => unknown;
    };
    const rollupAccumulators = module_.rollupAccumulators;

    // Fails in RED phase because rollupAccumulators is currently private.
    // GREEN phase exports it, making this assertion pass.
    expect(typeof rollupAccumulators).toBe('function');

    const criterionWeightings = { completeness: 0.4, accuracy: 0.4, spag: 0.2 };

    // When no accumulators exist, rollupAccumulators delegates to rollupMetric
    // which throws on an empty subTasks array.
    expect(() =>
      (rollupAccumulators as (...arguments_: unknown[]) => unknown)([], criterionWeightings)
    ).toThrow();
  });
});
