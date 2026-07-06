import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import {
  createAssignmentPartial,
  createClassFull,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import type { MetricResult } from '../dataAnalysis.zod';
import { expectMetricResultStateAware } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

describe('AveragingAnalyser', () => {
  describe('analyse — filters', () => {
    it('filters assignments by date range, excluding those with createdAt outside [from, to)', () => {
      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          dateRange: {
            from: '2026-01-02T00:00:00.000Z',
            to: '2026-01-04T00:00:00.000Z',
          },
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_out_before',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-01-01T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_out_before', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_in_range',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-01-03T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_in_range', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_out_after',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                createdAt: '2026-01-05T00:00:00.000Z',
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_out_after', {
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
      // Only the in-range assignment (a_in_range, createdAt=2026-01-03) contributes
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('filters assignments by topicKeys, excluding non-matching primaryTopicKey', () => {
      const algebraDefinition = {
        ...createDefinitionPartial({ definitionKey: 'dk_algebra' }),
        primaryTopicKey: 'algebra',
      };
      const geometryDefinition = {
        ...createDefinitionPartial({ definitionKey: 'dk_geometry' }),
        primaryTopicKey: 'geometry',
      };

      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          topicKeys: ['algebra'],
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              {
                ...createAssignmentPartial({
                  assignmentId: 'a_algebra',
                  definitionKey: 'dk_algebra',
                  tasks: [createTaskPartial('t_001')],
                  submissions: [
                    createSubmission('s_001', 'Alice', 'a_algebra', {
                      t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                    }),
                  ],
                }),
                assignmentDefinition: algebraDefinition,
              },
              {
                ...createAssignmentPartial({
                  assignmentId: 'a_geometry',
                  definitionKey: 'dk_geometry',
                  tasks: [createTaskPartial('t_001')],
                  submissions: [
                    createSubmission('s_001', 'Alice', 'a_geometry', {
                      t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                    }),
                  ],
                }),
                assignmentDefinition: geometryDefinition,
              },
            ],
          }),
        ],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Only the algebra assignment (primaryTopicKey='algebra') contributes
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('filters assignments by assignmentDefinitionKeys, excluding non-matching', () => {
      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          assignmentDefinitionKeys: ['dk_algebra'],
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_algebra',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_algebra', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_geometry',
                definitionKey: 'dk_geometry',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_geometry', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
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
      // Only the algebra assignment (definitionKey='dk_algebra') contributes
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('filterAssignments uses Set-based lookups for topicKeys and assignmentDefinitionKeys', () => {
      // Non-trivial filter arrays: 10 topic keys, 15 definition keys
      const topicKeys: string[] = [
        'algebra',
        'geometry',
        'statistics',
        'calculus',
        'trigonometry',
        'probability',
        'number',
        'measurement',
        'functions',
        'data',
      ];
      const assignmentDefinitionKeys: string[] = [
        'dk_algebra',
        'dk_geometry',
        'dk_statistics',
        'dk_calculus',
        'dk_trig',
        'dk_probability',
        'dk_number',
        'dk_measurement',
        'dk_functions',
        'dk_data',
        'dk_ratio',
        'dk_equations',
        'dk_inequalities',
        'dk_sequences',
        'dk_graphs',
      ];

      const input: AveragingAnalyserInput = {
        filter: {
          classIds: ['c_001'],
          topicKeys,
          assignmentDefinitionKeys,
        },
        classes: [
          createClassFull({
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              // 4 assignments matching BOTH topic and definition filters → contribute
              createAssignmentPartial({
                assignmentId: 'a_algebra',
                definitionKey: 'dk_algebra',
                primaryTopicKey: 'algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_algebra', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 1 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_geometry',
                definitionKey: 'dk_geometry',
                primaryTopicKey: 'geometry',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_geometry', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 2 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_statistics',
                definitionKey: 'dk_statistics',
                primaryTopicKey: 'statistics',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_statistics', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 3 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_calculus',
                definitionKey: 'dk_calculus',
                primaryTopicKey: 'calculus',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_calculus', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
              // Topic in filter, definition NOT in filter → excluded
              createAssignmentPartial({
                assignmentId: 'a_topic_match_def_mismatch',
                definitionKey: 'dk_bio',
                primaryTopicKey: 'algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_topic_match_def_mismatch', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
                  }),
                ],
              }),
              // Definition in filter, topic NOT in filter → excluded
              createAssignmentPartial({
                assignmentId: 'a_def_match_topic_mismatch',
                definitionKey: 'dk_algebra',
                primaryTopicKey: 'biology',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_def_match_topic_mismatch', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 6 } }),
                  }),
                ],
              }),
              // NEITHER topic nor definition in filter → excluded
              createAssignmentPartial({
                assignmentId: 'a_biology',
                definitionKey: 'dk_bio',
                primaryTopicKey: 'biology',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_biology', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 7 } }),
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
      // Only 4 assignments (a_algebra, a_geometry, a_statistics, a_calculus) contribute
      // Weighted average = (1 + 2 + 3 + 4) / 4 = 2.5
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 2.5,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
    });

    it('filterAssignments produces identical results for an empty filter array vs an undefined filter', () => {
      const sharedClass = createClassFull({
        classId: 'c_001',
        studentIds: ['s_001'],
        assignments: [
          createAssignmentPartial({
            assignmentId: 'a_algebra',
            definitionKey: 'dk_algebra',
            primaryTopicKey: 'algebra',
            tasks: [createTaskPartial('t_001')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_algebra', {
                t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
              }),
            ],
          }),
          createAssignmentPartial({
            assignmentId: 'a_geometry',
            definitionKey: 'dk_geometry',
            primaryTopicKey: 'geometry',
            tasks: [createTaskPartial('t_001')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_geometry', {
                t_001: createSubmissionItem('t_001', { accuracy: { score: 5 } }),
              }),
            ],
          }),
        ],
      });

      // Input with empty topicKeys array (all assignments pass through)
      const inputEmptyFilter: AveragingAnalyserInput = {
        filter: { classIds: ['c_001'], topicKeys: [] as unknown as [string, ...string[]] },
        classes: [sharedClass],
        assignmentDefinitionPartials: [],
      };

      // Input with undefined topicKeys (all assignments pass through)
      const inputUndefinedFilter: AveragingAnalyserInput = {
        filter: { classIds: ['c_001'] },
        classes: [sharedClass],
        assignmentDefinitionPartials: [],
      };

      const analyser = new AveragingAnalyser();
      const resultsEmpty = analyser.analyse(inputEmptyFilter);
      const resultsUndefined = analyser.analyse(inputUndefinedFilter);

      // Both should produce identical results — all assignments pass through
      expect(resultsEmpty).toEqual(resultsUndefined);
    });
  });
});
