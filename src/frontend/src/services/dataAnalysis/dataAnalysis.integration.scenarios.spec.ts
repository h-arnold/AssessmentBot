import { describe, it, expect } from 'vitest';
import { DataAnalysisService } from './dataAnalysisService';
import { DataAnalysisResponseSchema } from './dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
  createDefinitionPartial,
} from '../../test/dataAnalysis/fixtures';
import { expectMetricResultStateAware } from '../../test/dataAnalysis/averagingAnalyserAssertions';

// ---------------------------------------------------------------------------
// Integration tests — advanced scenarios
// ---------------------------------------------------------------------------

describe('DataAnalysisService integration — advanced scenarios', () => {
  describe('empty tasks in partials', () => {
    it('processes submissions correctly when live partials have an empty tasks array', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            className: 'Test Class',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: 1,
                tasks: [createTaskPartial('t_001', 1), createTaskPartial('t_002', 1)],
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
              assignmentWeighting: 1,
              tasks: [],
            }),
          ],
        }
      );

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(() => DataAnalysisResponseSchema.parse(results)).not.toThrow();
      expect(results).toHaveLength(1);

      expectMetricResultStateAware(results[0].perStudent[0].accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      expect(results[0].perTask).toHaveLength(1);
      expect(results[0].perTask[0].taskId).toBe('t_001');
    });
  });

  describe('multiple assignments with different weightings', () => {
    it('weights scores from different assignments according to their live partial weightings', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            className: 'Test Class',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: 1,
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_002',
                definitionKey: 'dk_geometry',
                assignmentWeighting: 1,
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_002', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 2 } }),
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
              assignmentWeighting: 2,
              tasks: [createTaskPartial('t_001', 1)],
            }),
            createDefinitionPartial({
              definitionKey: 'dk_geometry',
              assignmentWeighting: 3,
              tasks: [createTaskPartial('t_001', 1)],
            }),
          ],
        }
      );

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(() => DataAnalysisResponseSchema.parse(results)).not.toThrow();
      expect(results).toHaveLength(1);

      expectMetricResultStateAware(results[0].perStudent[0].accuracy, {
        state: 'computed',
        value: 14 / 5,
        totalWeight: 5,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
    });
  });

  describe('full end-to-end scenario', () => {
    it('produces correct numeric outcomes for a multi-student, multi-assignment scenario', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            className: 'Year 10 Maths',
            studentIds: ['s_001', 's_002'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: 1,
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      accuracy: { score: 4 },
                      completeness: { score: 3 },
                    }),
                  }),
                  createSubmission('s_002', 'Bob', 'a_001', {
                    t_001: createSubmissionItem('t_001', {
                      accuracy: { score: 3 },
                      completeness: { score: 4 },
                      spag: { score: 5 },
                    }),
                  }),
                ],
              }),
              createAssignmentPartial({
                assignmentId: 'a_002',
                definitionKey: 'dk_geometry',
                assignmentWeighting: 1,
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_002', {
                    t_001: createSubmissionItem('t_001', {
                      accuracy: { score: 5 },
                      completeness: { score: 5 },
                      spag: { score: 5 },
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
              assignmentWeighting: 2,
              tasks: [createTaskPartial('t_001', 1)],
            }),
            createDefinitionPartial({
              definitionKey: 'dk_geometry',
              assignmentWeighting: 1,
              tasks: [createTaskPartial('t_001', 1)],
            }),
          ],
        }
      );

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(() => DataAnalysisResponseSchema.parse(results)).not.toThrow();

      expect(results).toHaveLength(1);
      expect(results[0].classId).toBe('c_001');
      expect(results[0].className).toBe('Year 10 Maths');

      expect(results[0].appliedCriterionWeightings).toEqual({
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      });

      expect(results[0].perStudent).toHaveLength(2);
      expect(results[0].perStudent[0].studentName).toBe('Alice');
      expect(results[0].perStudent[1].studentName).toBe('Bob');

      // ── Alice ────────────────────────────────────────────────────────────
      const alice = results[0].perStudent[0];

      const aliceAccuracyValue = 13 / 3;
      expectMetricResultStateAware(alice.accuracy, {
        state: 'computed',
        value: aliceAccuracyValue,
        totalWeight: 3,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });

      const aliceCompletenessValue = 11 / 3;
      expectMetricResultStateAware(alice.completeness, {
        state: 'computed',
        value: aliceCompletenessValue,
        totalWeight: 3,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });

      expectMetricResultStateAware(alice.spag, {
        state: 'computed',
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      const aliceOverallValue = 0.4 * aliceCompletenessValue + 0.4 * aliceAccuracyValue + 0.2 * 5;
      expectMetricResultStateAware(alice.overall, {
        state: 'computed',
        value: aliceOverallValue,
        totalWeight: 7,
        applicableDataPoints: 5,
        totalDataPoints: 5,
      });

      // ── Bob ──────────────────────────────────────────────────────────────
      const bob = results[0].perStudent[1];

      expectMetricResultStateAware(bob.accuracy, {
        state: 'computed',
        value: 3,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      expectMetricResultStateAware(bob.completeness, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      expectMetricResultStateAware(bob.spag, {
        state: 'computed',
        value: 5,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      expectMetricResultStateAware(bob.overall, {
        state: 'computed',
        value: 0.4 * 4 + 0.4 * 3 + 0.2 * 5,
        totalWeight: 6,
        applicableDataPoints: 3,
        totalDataPoints: 3,
      });

      expect(results[0].perTask).toHaveLength(2);
    });
  });
});
