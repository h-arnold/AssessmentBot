/** Row states when evidence is absent: empty input, all-error rows and all-not-attempted rows. */

import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';
import type { MetricResult } from '../dataAnalysis.zod';
import { expectMetricResultStateAware } from '@/test/dataAnalysis/averagingAnalyserAssertions';

describe('AveragingAnalyser', () => {
  describe('analyse — rows', () => {
    it('returns empty array when no classes are provided', () => {
      const input: AveragingAnalyserInput = {
        filter: { classIds: ['c_001'], analysisMode: 'absolute' },
        classes: [],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toEqual([]);
    });

    it('returns per-class metrics all error when class has no assignments', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          className: 'Empty Class',
          assignments: [],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perStudent).toEqual([]);
      expect(results[0].perTask).toEqual([]);

      // All per-class metric results should be error (0 data points, 0 'N')
      // This will FAIL in the Red phase (current code produces value: null)
      expectMetricResultStateAware(results[0].perClass.completeness as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('returns per-student metrics all error when student has empty items', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [createSubmission('s_001', 'Alice', 'a_001', {})],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perStudent).toHaveLength(1);

      const student = results[0].perStudent[0];
      expect(student.studentId).toBe('s_001');

      // All student metrics are error (0 data points)
      // This will FAIL in the Red phase
      expectMetricResultStateAware(student.completeness as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(student.accuracy as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(student.spag as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(student.overall as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('returns per-task metrics all error when no student submitted for a task', () => {
      const tasksInNoSubmissionTest = [createTaskPartial('t_001'), createTaskPartial('t_002')];
      const assignmentWithNoSubmissionForTask = createAssignmentPartial({
        assignmentId: 'a_001',
        definitionKey: 'dk_algebra',
        tasks: tasksInNoSubmissionTest,
        submissions: [
          createSubmission('s_001', 'Alice', 'a_001', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
          }),
        ],
      });
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [assignmentWithNoSubmissionForTask],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: tasksInNoSubmissionTest,
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perTask).toHaveLength(tasksInNoSubmissionTest.length);

      const taskWithData = results[0].perTask[0];
      const taskWithoutData = results[0].perTask[1];

      expect(taskWithData.taskId).toBe('t_001');
      expectMetricResultStateAware(taskWithData.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      expect(taskWithoutData.taskId).toBe('t_002');
      // No submissions for t_002 → error
      // This will FAIL in the Red phase
      expectMetricResultStateAware(taskWithoutData.completeness as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(taskWithoutData.accuracy as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(taskWithoutData.spag as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(taskWithoutData.overall as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('returns overall notAttempted when all criteria are N for a data point', () => {
      const assignmentWithNotAttemptedScores = createAssignmentPartial({
        assignmentId: 'a_001',
        definitionKey: 'dk_algebra',
        tasks: [createTaskPartial('t_001')],
        submissions: [
          createSubmission('s_001', 'Alice', 'a_001', {
            t_001: createSubmissionItem('t_001', {
              completeness: { score: 'N' },
              accuracy: { score: 'N' },
              spag: { score: 'N' },
            }),
          }),
        ],
      });
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [assignmentWithNotAttemptedScores],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      const student = results[0].perStudent[0];
      // Per-criterion metrics all notAttempted with value 'N' (nCount > 0)
      // This will FAIL in the Red phase (current code produces value: null)
      // totalWeight is now accumulated for 'N' scores (was 0 before Bug #1 fix)
      expectMetricResultStateAware(student.completeness as unknown as MetricResult, {
        state: 'notAttempted',
        totalWeight: 1,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(student.accuracy as unknown as MetricResult, {
        state: 'notAttempted',
        totalWeight: 1,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(student.spag as unknown as MetricResult, {
        state: 'notAttempted',
        totalWeight: 1,
        totalDataPoints: 1,
      });
      // Overall is notAttempted because all three criteria are 'N'
      // Metadata summed across criteria (sum not Math.max):
      // totalWeight: 1(completeness)+1(accuracy)+1(spag) = 3
      // totalDataPoints: 1+1+1 = 3
      expectMetricResultStateAware(student.overall as unknown as MetricResult, {
        state: 'notAttempted',
        totalWeight: 3,
        totalDataPoints: 3,
      });
    });
  });
});
