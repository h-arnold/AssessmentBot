import { describe, expect, it } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createDefinitionPartial,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';
import { AveragingAnalyserInputSchema } from '../dataAnalysis.zod';

const FRACTIONAL_SCORE = 2.5;

/**
 * Analyse scores after validating them at the public input boundary.
 * @param {Array<number | 'N' | 'E'>} scores - Criterion scores for each student.
 * @param {number} taskWeighting - Live weighting for the task.
 * @returns {ReturnType<AveragingAnalyser['analyse']>[number]} Analysed class result.
 */
function analyseScores(scores: Array<number | 'N' | 'E'>, taskWeighting: number) {
  const base = buildInput([{ classId: 'c_001', studentIds: [], assignments: [] }]);
  const assignments = scores.map((score, index) => {
    const item = createSubmissionItem('t_001');
    const rawItem = {
      ...item,
      artifact: { ...item.artifact, role: 'submission', type: 'base' },
      assessments: Object.fromEntries(
        ['completeness', 'accuracy', 'spag'].map((criterion) => {
          return [
            criterion,
            score === 'E'
              ? {
                  score,
                  reasoning: 'Assessment failed.',
                  error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
                }
              : { score },
          ];
        })
      ),
    };
    return {
      assignmentId: `a_${index}`,
      assignmentName: 'Test Assignment',
      dueDate: null,
      updatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      documentType: 'assessment',
      assignmentDefinitionKey: 'dk_errors',
      assessmentContractVersion: 1,
      tasks: [{ taskId: 't_001', taskWeighting, taskTitle: null }],
      submissions: [
        {
          studentId: `s_${index}`,
          studentName: `Student ${index}`,
          assignmentId: `a_${index}`,
          documentId: null,
          items: { t_001: rawItem },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
  });
  const candidate: unknown = {
    ...base,
    classes: base.classes.map((classRecord) => ({ ...classRecord, assignments })),
    assignmentDefinitionPartials: [
      createDefinitionPartial({
        definitionKey: 'dk_errors',
        tasks: [createTaskPartial('t_001', taskWeighting)],
      }),
    ],
  };
  const input = AveragingAnalyserInputSchema.parse(candidate);
  return new AveragingAnalyser().analyse(input)[0];
}

describe('AveragingAnalyser explicit error evidence', () => {
  it('accepts raw E and displays all four metrics as error without adding evidence', () => {
    const result = analyseScores(['E'], 1);
    const row = result.perTask[0];
    for (const metric of [row.completeness, row.accuracy, row.spag, row.overall]) {
      expect(metric).toEqual({
        state: 'error',
        value: 'E',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      });
    }
    expect(result.perClass.completeness.totalDataPoints).toBe(0);
  });

  it('does not let E alter numeric, N, zero-weight, mixed, or excluded aggregation', () => {
    const mixed = analyseScores([FRACTIONAL_SCORE, 'E'], 1);
    expect(mixed.perClass.completeness).toMatchObject({
      state: 'computed',
      value: FRACTIONAL_SCORE,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    });
    expect(analyseScores(['N'], 1).perTask[0].completeness).toMatchObject({
      state: 'notAttempted',
      value: 'N',
      totalDataPoints: 1,
    });
    expect(analyseScores([FRACTIONAL_SCORE], 0).perClass.completeness).toMatchObject({
      state: 'excluded',
      value: null,
      totalWeight: 0,
      totalDataPoints: 1,
    });
    expect(analyseScores([FRACTIONAL_SCORE, 'E'], 0).perClass.completeness).toMatchObject({
      state: 'excluded',
      value: null,
      totalWeight: 0,
      totalDataPoints: 1,
    });
  });
});
