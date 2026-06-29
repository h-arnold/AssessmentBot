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
  DEFAULT_CREATED_AT,
} from '../../../test/dataAnalysis/fixtures';
import {
  expectMetricResult,
  checkMetricInvariant,
} from '../../../test/dataAnalysis/averagingAnalyserAssertions';

describe('AveragingAnalyser', () => {
  describe('constructor', () => {
    it('uses default criterion weightings (completeness=0.4, accuracy=0.4, spag=0.2) when none provided', () => {
      const analyser = new AveragingAnalyser();
      expect(analyser).toBeInstanceOf(AveragingAnalyser);
    });

    it('accepts custom criterion weightings', () => {
      const analyser = new AveragingAnalyser({ completeness: 0.5, accuracy: 0.3, spag: 0.2 });
      expect(analyser).toBeInstanceOf(AveragingAnalyser);
    });
  });

  describe('analyse — orchestration', () => {
    it('computes correct weighted average for single student, single task, single criterion', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          className: 'Test Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
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
      expect(results[0].classId).toBe('c_001');
      expect(results[0].className).toBe('Test Class');

      // perStudent
      expect(results[0].perStudent).toHaveLength(1);
      const student = results[0].perStudent[0];
      expect(student.studentId).toBe('s_001');
      expect(student.studentName).toBe('Alice');

      // completeness: no data point
      expectMetricResult(student.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      // accuracy: single score 4, weight 1×1=1
      expectMetricResult(student.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // spag: no data point
      expectMetricResult(student.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      // overall: only accuracy contributes → (0.4*4) / 0.4 = 4
      expectMetricResult(student.overall, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      // perTask
      expect(results[0].perTask).toHaveLength(1);
      const taskRow = results[0].perTask[0];
      expect(taskRow.definitionKey).toBe('dk_algebra');
      expect(taskRow.taskId).toBe('t_001');
      expect(taskRow.taskTitle).toBeNull();

      expectMetricResult(taskRow.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(taskRow.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(taskRow.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(taskRow.overall, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      // perClass — same as per-student (single student)
      expectMetricResult(results[0].perClass.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('produces identical results between default and explicit weightings', () => {
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
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
      ]);

      const defaultAnalyser = new AveragingAnalyser();
      const explicitAnalyser = new AveragingAnalyser({
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      });

      const defaultResults = defaultAnalyser.analyse(input);
      const explicitResults = explicitAnalyser.analyse(input);

      expect(defaultResults).toEqual(explicitResults);
    });

    it('uses custom criterion weightings passed to constructor', () => {
      // Custom: completeness=0.6, accuracy=0.3, spag=0.1
      // Single data point: completeness=3, accuracy=4, spag=5
      // overall_i = (0.6*3 + 0.3*4 + 0.1*5) / (0.6+0.3+0.1) = (1.8+1.2+0.5)/1.0 = 3.5
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
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser({ completeness: 0.6, accuracy: 0.3, spag: 0.1 });
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      const student = results[0].perStudent[0];

      // Per-criterion values unchanged (weighted average per criterion is same regardless of criterion weightings)
      expectMetricResult(student.completeness, {
        value: 3,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(student.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(student.spag, {
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // overall: (0.6*3 + 0.3*4 + 0.1*5) / 1.0 = 3.5
      expectMetricResult(student.overall, {
        value: 3.5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('maintains MetricResultSchema invariant throughout output', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001', 's_002'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                  // s_001 missing t_002
                }),
                createSubmission('s_002', 'Bob', 'a_001', {
                  // s_002 has no items at all
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      // Check that for every MetricResult in the output tree:
      //   value === null  iff  applicableDataPoints === 0
      for (const result of results) {
        for (const student of result.perStudent) {
          checkMetricInvariant(student.completeness);
          checkMetricInvariant(student.accuracy);
          checkMetricInvariant(student.spag);
          checkMetricInvariant(student.overall);
        }
        for (const taskRow of result.perTask) {
          checkMetricInvariant(taskRow.completeness);
          checkMetricInvariant(taskRow.accuracy);
          checkMetricInvariant(taskRow.spag);
          checkMetricInvariant(taskRow.overall);
        }
        checkMetricInvariant(result.perClass.completeness);
        checkMetricInvariant(result.perClass.accuracy);
        checkMetricInvariant(result.perClass.spag);
        checkMetricInvariant(result.perClass.overall);
      }
    });

    it('echoes constructor weightings in appliedCriterionWeightings output', () => {
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
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
      ]);

      // Default analyser
      const defaultAnalyser = new AveragingAnalyser();
      const defaultResults = defaultAnalyser.analyse(input);
      expect(defaultResults[0].appliedCriterionWeightings).toEqual({
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      });

      // Custom analyser
      const customAnalyser = new AveragingAnalyser({ completeness: 0.5, accuracy: 0.3, spag: 0.2 });
      const customResults = customAnalyser.analyse(input);
      expect(customResults[0].appliedCriterionWeightings).toEqual({
        completeness: 0.5,
        accuracy: 0.3,
        spag: 0.2,
      });
    });

    it('returns results sorted by classId for multiple classes', () => {
      const classOverridesInSortTest = [
        {
          classId: 'c_002',
          className: 'Second Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
        {
          classId: 'c_001',
          className: 'First Class',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
      ];
      const input = buildInput(classOverridesInSortTest);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(classOverridesInSortTest.length);
      expect(results[0].classId).toBe('c_001');
      expect(results[1].classId).toBe('c_002');
    });

    it('throws a typed error when an assignment has no assignmentDefinition', () => {
      const assignmentWithoutDefinition = {
        courseId: 'course_001' as const,
        assignmentId: 'a_001',
        assignmentName: 'Test Assignment',
        dueDate: null,
        lastUpdated: null,
        createdAt: DEFAULT_CREATED_AT,
        documentType: 'assessment' as const,
        submissions: [
          createSubmission('s_001', 'Alice', 'a_001', {
            t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
          }),
        ],
        assignmentDefinition: null as unknown as undefined,
      };

      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              assignmentWithoutDefinition as unknown as ReturnType<typeof createAssignmentPartial>,
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      expect(() => analyser.analyse(input)).toThrow(Error);
    });
  });
});
