import { afterEach, describe, expect, it, vi } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import { accumulateDataPoints } from './averagingAnalyser.accumulation';
import { buildPerStudentTaskMetrics } from './averagingAnalyser.taskProjection';
import { buildPerTaskRows } from './averagingAnalyser.rows';
import { createDataPointAccumulator } from './averagingAnalyser.accumulatorRegistry';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';

const ZERO = 0;
const TWO = 2;
const CRITERION_WEIGHTINGS = { completeness: 0.4, accuracy: 0.4, spag: 0.2 };

type TaskAccumulator = { definitionKey: string; taskId: string } & ReturnType<
  typeof createDataPointAccumulator
>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analyser diagnostic and invariant boundaries', () => {
  it('fails fast when a per-student task has no contribution metadata', () => {
    const taskKey = 'dk_missing::t_001';
    const perStudentTaskAccums = new Map([
      ['s_001', new Map([[taskKey, createDataPointAccumulator()]])],
    ]);

    expect(() => buildPerStudentTaskMetrics('c_001', perStudentTaskAccums, new Map())).toThrow(
      /buildPerStudentTaskMetrics: missing averageContribution/
    );
  });

  it('fails fast when a per-task row has no contribution metadata', () => {
    const taskKey = 'dk_missing::t_001';
    const accumulator = createDataPointAccumulator();
    const taskAccums = new Map<string, TaskAccumulator>([
      [taskKey, { definitionKey: 'dk_missing', taskId: 't_001', ...accumulator }],
    ]);

    expect(() => buildPerTaskRows(taskAccums, CRITERION_WEIGHTINGS, new Map())).toThrow(
      /buildPerTaskRows: missing averageContribution/
    );
  });

  it('warns and skips an assignment when its live definition partial is missing', () => {
    const definitionKey = 'dk_missing';
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
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
      ],
      { assignmentDefinitionPartials: [] }
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sourceClass = input.classes[0]!;

    const accumulators = accumulateDataPoints(sourceClass.assignments, input, CRITERION_WEIGHTINGS);

    expect(accumulators.studentAccums.size).toBe(ZERO);
    expect(accumulators.taskAccums.size).toBe(ZERO);
    expect(accumulators.perStudentTaskAccums.size).toBe(ZERO);
    expect(warnSpy).toHaveBeenCalledWith(
      'accumulateDataPoints',
      expect.objectContaining({
        context: 'accumulateDataPoints',
        errorMessage: `No assignment definition partial found for definitionKey '${definitionKey}'`,
        metadata: { definitionKey },
        level: 'warn',
      })
    );
  });

  it('logs one warning for each missing criterion score dropped from a submission item', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const definitionKey = 'dk_missing_scores';
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
            definitionKey,
            tasks: [createTaskPartial('t_001')],
          }),
        ],
      }
    );

    const result = new AveragingAnalyser().analyse(input)[0];

    expect(warnSpy).toHaveBeenCalledTimes(TWO);
    for (const [, entry] of warnSpy.mock.calls) {
      expect(entry).toEqual(
        expect.objectContaining({
          level: 'warn',
          context: expect.any(String),
          errorMessage: expect.any(String),
        })
      );
    }
    expect(result.perStudent[0].accuracy).toMatchObject({ state: 'computed', value: 4 });
    expect(result.perStudent[0].completeness).toMatchObject({ state: 'error' });
    expect(result.perStudent[0].spag).toMatchObject({ state: 'error' });
  });

  it('keeps class metrics error when no submission creates a per-student task accumulator', () => {
    const definitionKey = 'dk_no_submission';
    const input = buildInput(
      [
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey,
              tasks: [createTaskPartial('t_001')],
              submissions: [],
            }),
          ],
        },
      ],
      {
        assignmentDefinitionPartials: [
          createDefinitionPartial({
            definitionKey,
            tasks: [createTaskPartial('t_001')],
          }),
        ],
      }
    );

    const result = new AveragingAnalyser().analyse(input)[0];

    expect(result.perStudentTaskMetrics).toEqual([]);
    expect(result.perClass).toMatchObject({
      completeness: { state: 'error', totalDataPoints: 0 },
      accuracy: { state: 'error', totalDataPoints: 0 },
      spag: { state: 'error', totalDataPoints: 0 },
      overall: { state: 'error', totalDataPoints: 0 },
    });
  });
});
