/** Computed row breakdowns: per-student, per-task and per-class rows and their ordering. */

import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';
import type { MetricResult } from '../dataAnalysis.zod';
import { expectMetricResultStateAware } from '@/test/dataAnalysis/averagingAnalyserAssertions';

describe('AveragingAnalyser', () => {
  describe('analyse — rows', () => {
    it('computes per-student and per-task breakdowns correctly for multiple students and tasks', () => {
      const studentIdsInTest = ['s_001', 's_002'];
      const tasksInMultiTest = [createTaskPartial('t_001'), createTaskPartial('t_002')];
      const assignment = createAssignmentPartial({
        assignmentId: 'a_001',
        definitionKey: 'dk_algebra',
        tasks: tasksInMultiTest,
        submissions: [
          createSubmission('s_001', 'Alice', 'a_001', {
            t_001: createSubmissionItem('t_001', {
              completeness: { score: 3 },
              accuracy: { score: 4 },
              spag: { score: 5 },
            }),
            t_002: createSubmissionItem('t_002', {
              completeness: { score: 4 },
              accuracy: { score: 3 },
              spag: { score: 4 },
            }),
          }),
          createSubmission('s_002', 'Bob', 'a_001', {
            t_001: createSubmissionItem('t_001', {
              completeness: { score: 5 },
              accuracy: { score: 5 },
              spag: { score: 5 },
            }),
            t_002: createSubmissionItem('t_002', {
              completeness: { score: 2 },
              accuracy: { score: 3 },
              spag: { score: 4 },
            }),
          }),
        ],
      });
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: studentIdsInTest,
          assignments: [assignment],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].classId).toBe('c_001');

      // perStudent sorted by name
      expect(results[0].perStudent).toHaveLength(studentIdsInTest.length);
      const alice = results[0].perStudent[0];
      const bob = results[0].perStudent[1];
      expect(alice.studentId).toBe('s_001');
      expect(bob.studentId).toBe('s_002');

      // All results should be computed since we have numeric scores
      // Alice — completeness (3+4)/2 = 3.5
      expectMetricResultStateAware(alice.completeness as unknown as MetricResult, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — accuracy (4+3)/2 = 3.5
      expectMetricResultStateAware(alice.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — spag (5+4)/2 = 4.5
      expectMetricResultStateAware(alice.spag as unknown as MetricResult, {
        state: 'computed',
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — overall: t1=(0.4*3+0.4*4+0.2*5)=3.8, t2=(0.4*4+0.4*3+0.2*4)=3.6, avg=(3.8+3.6)/2=3.7
      // Metadata summed across computed criteria per CRITICAL-3 (sum not Math.max):
      // totalWeight: 2(completeness)+2(accuracy)+2(spag) = 6
      expectMetricResultStateAware(alice.overall as unknown as MetricResult, {
        state: 'computed',
        value: 3.7,
        totalWeight: 6,
        applicableDataPoints: 6,
        totalDataPoints: 6,
      });
      // Bob — completeness (5+2)/2 = 3.5
      expectMetricResultStateAware(bob.completeness as unknown as MetricResult, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — accuracy (5+3)/2 = 4
      expectMetricResultStateAware(bob.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — spag (5+4)/2 = 4.5
      expectMetricResultStateAware(bob.spag as unknown as MetricResult, {
        state: 'computed',
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — overall: t1=(0.4*5+0.4*5+0.2*5)=5, t2=(0.4*2+0.4*3+0.2*4)=2.8, avg=(5+2.8)/2=3.9
      // Metadata summed across computed criteria per CRITICAL-3 (sum not Math.max):
      // totalWeight: 2(completeness)+2(accuracy)+2(spag) = 6
      expectMetricResultStateAware(bob.overall as unknown as MetricResult, {
        state: 'computed',
        value: 3.9,
        totalWeight: 6,
        applicableDataPoints: 6,
        totalDataPoints: 6,
      });

      // perTask sorted by (definitionKey, taskId)
      expect(results[0].perTask).toHaveLength(tasksInMultiTest.length);
      const task1 = results[0].perTask[0];
      const task2 = results[0].perTask[1];
      expect(task1.definitionKey).toBe('dk_algebra');
      expect(task1.taskId).toBe('t_001');
      expect(task2.taskId).toBe('t_002');
      // Task t_001: Alice(3,4,5) Bob(5,5,5)
      expectMetricResultStateAware(task1.completeness as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task1.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task1.spag as unknown as MetricResult, {
        state: 'computed',
        value: 5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task1.overall as unknown as MetricResult, {
        state: 'computed',
        value: 4.4,
        totalWeight: 6,
        applicableDataPoints: 6,
        totalDataPoints: 6,
      }); // (3.8+5)/2=4.4, metadata summed across computed criteria per CRITICAL-3
      // Task t_002: Alice(4,3,4) Bob(2,3,4)
      expectMetricResultStateAware(task2.completeness as unknown as MetricResult, {
        state: 'computed',
        value: 3,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task2.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 3,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task2.spag as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task2.overall as unknown as MetricResult, {
        state: 'computed',
        value: 3.2,
        totalWeight: 6,
        applicableDataPoints: 6,
        totalDataPoints: 6,
      }); // (3.6+2.8)/2=3.2, metadata summed across computed criteria per CRITICAL-3
      // perClass — All 4 data points
      expectMetricResultStateAware(results[0].perClass.completeness as unknown as MetricResult, {
        state: 'computed',
        value: 3.5,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 3.75,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResult, {
        state: 'computed',
        value: 4.5,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResult, {
        state: 'computed',
        value: 3.8,
        totalWeight: 12,
        applicableDataPoints: 12,
        totalDataPoints: 12,
      }); // (3.8+3.6+5+2.8)/4=3.8, metadata summed across computed criteria per CRITICAL-3
    });

    it('sorts perTask rows by definitionKey then taskId', () => {
      const zebraTasks = [createTaskPartial('t_002'), createTaskPartial('t_001')];
      const alphaTasks = [createTaskPartial('t_001')];
      const totalTaskCount = zebraTasks.length + alphaTasks.length;
      const zebraAssignment = createAssignmentPartial({
        assignmentId: 'a_001',
        definitionKey: 'dk_zebra',
        tasks: zebraTasks,
        submissions: [
          createSubmission('s_001', 'Alice', 'a_001', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
            t_002: createSubmissionItem('t_002', { accuracy: { score: 3 } }),
          }),
        ],
      });
      const alphaAssignment = createAssignmentPartial({
        assignmentId: 'a_002',
        definitionKey: 'dk_alpha',
        tasks: alphaTasks,
        submissions: [
          createSubmission('s_001', 'Alice', 'a_002', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
          }),
        ],
      });
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [zebraAssignment, alphaAssignment],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perTask).toHaveLength(totalTaskCount);

      // Sorted by (definitionKey, taskId)
      expect(results[0].perTask[0].definitionKey).toBe('dk_alpha');
      expect(results[0].perTask[0].taskId).toBe('t_001');
      expect(results[0].perTask[1].definitionKey).toBe('dk_zebra');
      expect(results[0].perTask[1].taskId).toBe('t_001');
      expect(results[0].perTask[2].definitionKey).toBe('dk_zebra');
      expect(results[0].perTask[2].taskId).toBe('t_002');
    });
  });
});
