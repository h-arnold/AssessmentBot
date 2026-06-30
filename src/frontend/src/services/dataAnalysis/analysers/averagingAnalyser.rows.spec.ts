import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createClassFull,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import {
  expectMetricResultStateAware,
  type MetricResultType,
} from '../../../test/dataAnalysis/averagingAnalyserAssertions';

describe('AveragingAnalyser', () => {
  describe('analyse — rows', () => {
    it('computes per-student and per-task breakdowns correctly for multiple students and tasks', () => {
      const studentIdsInTest = ['s_001', 's_002'];
      const tasksInMultiTest = [createTaskPartial('t_001'), createTaskPartial('t_002')];
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: studentIdsInTest,
          assignments: [
            createAssignmentPartial({
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
            }),
          ],
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
      expectMetricResultStateAware(alice.completeness as unknown as MetricResultType, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — accuracy (4+3)/2 = 3.5
      expectMetricResultStateAware(alice.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — spag (5+4)/2 = 4.5
      expectMetricResultStateAware(alice.spag as unknown as MetricResultType, {
        state: 'computed',
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Alice — overall: t1=(0.4*3+0.4*4+0.2*5)=3.8, t2=(0.4*4+0.4*3+0.2*4)=3.6, avg=(3.8+3.6)/2=3.7
      expectMetricResultStateAware(alice.overall as unknown as MetricResultType, {
        state: 'computed',
        value: 3.7,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — completeness (5+2)/2 = 3.5
      expectMetricResultStateAware(bob.completeness as unknown as MetricResultType, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — accuracy (5+3)/2 = 4
      expectMetricResultStateAware(bob.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — spag (5+4)/2 = 4.5
      expectMetricResultStateAware(bob.spag as unknown as MetricResultType, {
        state: 'computed',
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      // Bob — overall: t1=(0.4*5+0.4*5+0.2*5)=5, t2=(0.4*2+0.4*3+0.2*4)=2.8, avg=(5+2.8)/2=3.9
      expectMetricResultStateAware(bob.overall as unknown as MetricResultType, {
        state: 'computed',
        value: 3.9,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });

      // perTask sorted by (definitionKey, taskId)
      expect(results[0].perTask).toHaveLength(tasksInMultiTest.length);
      const task1 = results[0].perTask[0];
      const task2 = results[0].perTask[1];
      expect(task1.definitionKey).toBe('dk_algebra');
      expect(task1.taskId).toBe('t_001');
      expect(task2.taskId).toBe('t_002');
      // Task t_001: Alice(3,4,5) Bob(5,5,5)
      expectMetricResultStateAware(task1.completeness as unknown as MetricResultType, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task1.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 4.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task1.spag as unknown as MetricResultType, {
        state: 'computed',
        value: 5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task1.overall as unknown as MetricResultType, {
        state: 'computed',
        value: 4.4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }); // (3.8+5)/2=4.4
      // Task t_002: Alice(4,3,4) Bob(2,3,4)
      expectMetricResultStateAware(task2.completeness as unknown as MetricResultType, {
        state: 'computed',
        value: 3,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task2.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 3,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task2.spag as unknown as MetricResultType, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(task2.overall as unknown as MetricResultType, {
        state: 'computed',
        value: 3.2,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }); // (3.6+2.8)/2=3.2
      // perClass — All 4 data points
      expectMetricResultStateAware(
        results[0].perClass.completeness as unknown as MetricResultType,
        {
          state: 'computed',
          value: 3.5,
          totalWeight: 4,
          applicableDataPoints: 4,
          totalDataPoints: 4,
        }
      );
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 3.75,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResultType, {
        state: 'computed',
        value: 4.5,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResultType, {
        state: 'computed',
        value: 3.8,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      }); // (3.8+3.6+5+2.8)/4=3.8
    });

    it('returns empty array when no classes are provided', () => {
      const input: AveragingAnalyserInput = {
        filter: { classIds: ['c_001'] },
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
      expectMetricResultStateAware(
        results[0].perClass.completeness as unknown as MetricResultType,
        {
          state: 'error',
          totalWeight: 0,
          totalDataPoints: 0,
        }
      );
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResultType, {
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
      expectMetricResultStateAware(student.completeness as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(student.accuracy as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(student.spag as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(student.overall as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('returns per-task metrics all error when no student submitted for a task', () => {
      const tasksInNoSubmissionTest = [createTaskPartial('t_001'), createTaskPartial('t_002')];
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: tasksInNoSubmissionTest,
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expect(results[0].perTask).toHaveLength(tasksInNoSubmissionTest.length);

      const taskWithData = results[0].perTask[0];
      const taskWithoutData = results[0].perTask[1];

      expect(taskWithData.taskId).toBe('t_001');
      expectMetricResultStateAware(taskWithData.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      expect(taskWithoutData.taskId).toBe('t_002');
      // No submissions for t_002 → error
      // This will FAIL in the Red phase
      expectMetricResultStateAware(taskWithoutData.completeness as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(taskWithoutData.accuracy as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(taskWithoutData.spag as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(taskWithoutData.overall as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('sorts perTask rows by definitionKey then taskId', () => {
      const zebraTasks = [createTaskPartial('t_002'), createTaskPartial('t_001')];
      const alphaTasks = [createTaskPartial('t_001')];
      const totalTaskCount = zebraTasks.length + alphaTasks.length;
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_zebra',
              tasks: zebraTasks,
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  t_002: createSubmissionItem('t_002', { accuracy: { score: 3 } }),
                }),
              ],
            }),
            createAssignmentPartial({
              assignmentId: 'a_002',
              definitionKey: 'dk_alpha',
              tasks: alphaTasks,
              submissions: [
                createSubmission('s_001', 'Alice', 'a_002', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                }),
              ],
            }),
          ],
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

    it('excludes student from perStudent when all submissions are filtered out by date range', () => {
      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          dateRange: {
            from: '2026-01-02T00:00:00.000Z',
            to: '2027-01-01T00:00:00.000Z',
          },
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001', 's_002'],
            assignments: [
              createAssignmentPartial({
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
              }),
              createAssignmentPartial({
                assignmentId: 'a_inside',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-06-15T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_inside', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      // Alice has a submission in range (a_inside) → included
      expect(results[0].perStudent).toHaveLength(1);
      expect(results[0].perStudent[0].studentId).toBe('s_001');

      // Bob's only submission is on a_outside which is out of range → excluded

      // perClass only considers Alice's in-range submission
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('perStudent row building throws when a submission has a null studentName', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001', 's_002'],
          assignments: [
            createAssignmentPartial({
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
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      expect(() => analyser.analyse(input)).toThrow();
    });

    it('returns overall notAttempted when all criteria are N for a data point', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
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
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      const student = results[0].perStudent[0];
      // Per-criterion metrics all notAttempted with value 'N' (nCount > 0)
      // This will FAIL in the Red phase (current code produces value: null)
      expectMetricResultStateAware(student.completeness as unknown as MetricResultType, {
        state: 'notAttempted',
        totalWeight: 0,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(student.accuracy as unknown as MetricResultType, {
        state: 'notAttempted',
        totalWeight: 0,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(student.spag as unknown as MetricResultType, {
        state: 'notAttempted',
        totalWeight: 0,
        totalDataPoints: 1,
      });
      // Overall is notAttempted because all three criteria are 'N'
      expectMetricResultStateAware(student.overall as unknown as MetricResultType, {
        state: 'notAttempted',
        totalWeight: 0,
        totalDataPoints: 1,
      });
    });
  });
});
