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
import { expectMetricResult } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

describe('AveragingAnalyser', () => {
  describe('analyse — accumulation', () => {
    it('skips assignment when assignmentWeighting is 0', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              assignmentWeighting: 0,
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 5 },
                    accuracy: { score: 5 },
                    spag: { score: 5 },
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
      // All metrics are null — zero-weight assignment contributes no data
      expectMetricResult(results[0].perClass.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    });

    it('skips task when taskWeighting is 0', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001', 0)],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 5 },
                    accuracy: { score: 5 },
                    spag: { score: 5 },
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
      // All metrics are null — zero-weight task contributes no data
      expectMetricResult(results[0].perClass.completeness, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.accuracy, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
      expectMetricResult(results[0].perClass.overall, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    });

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

      // completeness: value = 3, weight = 1
      expectMetricResult(student.completeness, {
        value: 3,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // accuracy: value = 4, weight = 1
      expectMetricResult(student.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // spag: 'N' → not contributing, applicableDataPoints = 0, totalDataPoints still 1
      expectMetricResult(student.spag, {
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      });
      // overall: spag excluded from denominator
      // overall_i = (0.4*3 + 0.4*4 + 0.2*N) / (0.4 + 0.4 + 0) = (1.2 + 1.6) / 0.8 = 3.5
      expectMetricResult(student.overall, {
        value: 3.5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('uses product of assignmentWeighting and taskWeighting as per-data-point weight', () => {
      const doubleAssignmentWeighting = 2;
      const tripleTaskWeighting = 3;
      // doubleAssignmentWeighting × tripleTaskWeighting → weight = 6
      // Single data point: accuracy = 4
      // Weighted sum = 6 * 4 = 24, totalWeight = 6, value = 24 / 6 = 4
      const input = buildInput([
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
      // accuracy: value = (6*4)/6 = 4, totalWeight = 6
      expectMetricResult(results[0].perStudent[0].accuracy, {
        value: 4,
        totalWeight: 6,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      expectMetricResult(results[0].perStudent[0].overall, {
        value: 4,
        totalWeight: 6,
        applicableDataPoints: 1,
        totalDataPoints: 1,
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
          // Pre-fetched partials have taskWeighting 5 for t_001 — authoritative source
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
      // totalWeight = assignmentWeighting(1) × taskWeighting(5 from pre-fetched) = 5
      expectMetricResult(results[0].perClass.accuracy, {
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
          // Pre-fetched partials exist but have empty tasks array — no t_001 entry
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
      // Fallback taskWeighting = 1 → totalWeight = 1 × 1 = 1
      expectMetricResult(results[0].perClass.accuracy, {
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
          // Pre-fetched partials supply taskWeighting=5 for t_001
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [{ id: 't_001', taskWeighting: preFetchedTaskWeighting }],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // totalWeight = assignmentWeighting(1) × taskWeighting(5) = 5
      // This matches the existing resolution-path tests, confirming
      // behavioural equivalence regardless of how the cross-reference
      // lookup is implemented internally.
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('resolveTaskWeight falls back to 1 when the definitionKey is not in the pre-fetched partials', () => {
      // Arbitrary non-zero weighting used both in the assignment tasks
      // (pre-registration) and the non-matching partial to prove the
      // absent definition causes a full fallback to 1.
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
          // Pre-fetched partials exist but do NOT include 'dk_algebra'
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
      // resolveTaskWeight cannot find 'dk_algebra' among the partials
      // → falls back to taskWeighting 1
      // totalWeight = assignmentWeighting(1) × taskWeighting(1) = 1
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('treats null assignmentWeighting as 1', () => {
      const taskWeightingForNullTest = 2;
      const input = buildInput([
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
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // assignmentWeighting=1 (null→1), taskWeighting=2 → totalWeight=2
      expectMetricResult(results[0].perClass.accuracy, {
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });
  });
});
