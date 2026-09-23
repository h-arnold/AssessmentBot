import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import { expectMetricResultStateAware } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

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

    it('falls back to taskWeighting 1 when no matching task entry is found in assignmentDefinitionPartials', () => {
      const input = buildInput(
        [
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
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [],
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
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('resolveTaskWeight uses the pre-built Map (O(1) lookup)', () => {
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

    it('resolveTaskWeight falls back to 1 when the definitionKey is not in the pre-fetched partials', () => {
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
