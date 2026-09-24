import { afterEach, describe, it, expect, vi } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import { buildTaskColumns } from '../heatmapAdapter';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import { expectMetricResultStateAware } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AveragingAnalyser assignment processing', () => {
  describe('positive-weight accumulation', () => {
    it('excludes SPaG N from spag weighted sum and adjusts overall denominator', () => {
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

      expectMetricResultStateAware(student.completeness, {
        state: 'computed',
        value: 3,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(student.accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(student.spag, {
        state: 'notAttempted',
        totalWeight: 1,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(student.overall, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
    });

    it('uses product of assignmentWeighting and taskWeighting as per-data-point weight', () => {
      const doubleAssignmentWeighting = 2;
      const tripleTaskWeighting = 3;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: doubleAssignmentWeighting,
                tasks: [createTaskPartial('t_001', tripleTaskWeighting)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      completeness: { score: 4 },
                      accuracy: { score: 4 },
                      spag: { score: 4 },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              assignmentWeighting: doubleAssignmentWeighting,
              tasks: [createTaskPartial('t_001', tripleTaskWeighting)],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perStudent[0].accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 6,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResultStateAware(results[0].perStudent[0].overall, {
        state: 'computed',
        value: 4,
        totalWeight: 18,
        applicableDataPoints: 3,
        totalDataPoints: 3,
      });
    });

    it('keeps analyser and heatmap adapter effective contribution metadata aligned', () => {
      const definitionKey = 'dk_shared_weighting';
      const fractionalTaskWeighting = 0.4;
      const partial = createDefinitionPartial({
        definitionKey,
        assignmentWeighting: 0.5,
        tasks: [createTaskPartial('t_001', fractionalTaskWeighting), createTaskPartial('t_002', 0)],
      });
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey,
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { completeness: { score: 4 } }),
                    t_002: createSubmissionItem('t_002', { completeness: { score: 5 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        { assignmentDefinitionPartials: [partial] }
      );

      const analyserResult = new AveragingAnalyser().analyse(input)[0];
      const adapterColumns = buildTaskColumns(partial);
      const analyserTasks = new Map(analyserResult.perTask.map((task) => [task.taskId, task]));

      for (const column of adapterColumns) {
        expect(column.averageContribution).toEqual(
          analyserTasks.get(column.taskId)?.averageContribution
        );
      }
    });

    it('resolves taskWeighting from pre-fetched assignmentDefinitionPartials cross-reference', () => {
      const preFetchedTaskWeighting = 5;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001', preFetchedTaskWeighting)],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perClass.accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('drops and warns when a submission task is absent from the live partial', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const unknownTaskId = 't_stale';
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                    [unknownTaskId]: createSubmissionItem(unknownTaskId, {
                      accuracy: { score: 5 },
                    }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
            }),
          ],
        }
      );

      const results = new AveragingAnalyser().analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perStudent[0].accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expect(results[0].perTask.map((task) => task.taskId)).toEqual(['t_001']);
      expect(results[0].perStudentTaskMetrics?.map((metric) => metric.taskKey)).toEqual([
        'dk_algebra::t_001',
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        'processAssignment',
        expect.objectContaining({
          context: 'processAssignment',
          errorMessage: `Submission task '${unknownTaskId}' is absent from the live assignment definition; dropping the item`,
          metadata: { definitionKey: 'dk_algebra', taskId: unknownTaskId },
          level: 'warn',
        })
      );
    });

    it('applies the live task weighting from the matching definition partial', () => {
      const preFetchedTaskWeighting = 5;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [{ taskId: 't_001', taskWeighting: preFetchedTaskWeighting, taskTitle: null }],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perClass.accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('skips an assignment when its definitionKey is absent from the live partials', () => {
      const unusedTaskWeighting = 5;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', unusedTaskWeighting)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_geometry',
              tasks: [createTaskPartial('t_001', unusedTaskWeighting)],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perClass.accuracy, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('treats null assignmentWeighting as 1', () => {
      const taskWeightingForNullTest = 2;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: null,
                tasks: [createTaskPartial('t_001', taskWeightingForNullTest)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              assignmentWeighting: null,
              tasks: [createTaskPartial('t_001', taskWeightingForNullTest)],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perClass.accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });
  });
});
