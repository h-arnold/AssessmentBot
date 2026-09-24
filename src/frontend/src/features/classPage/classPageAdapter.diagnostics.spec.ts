import { afterEach, describe, expect, it, vi } from 'vitest';
import { adaptClassPageToViewModel } from './classPageAdapter';
import {
  DEFAULT_TS,
  assignment,
  averagingResult,
  classFull,
  student,
} from '../../test/classPage/classPageAdapterTestFixtures';
import {
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
} from '../../test/dataAnalysis/fixtures';

const DEFINITION_KEY = 'def-recent-gap';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('class page recent-assignment diagnostics', () => {
  it('uses the Class-page no-data placeholder without warning when an assignment has no submissions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = adaptClassPageToViewModel({
      analyserResult: averagingResult({ perTask: [] }),
      classFull: classFull({
        students: [student('s-1', 'Alice')],
        assignments: [
          assignment({
            assignmentId: 'a-no-submissions',
            updatedAt: DEFAULT_TS,
            definitionKey: DEFINITION_KEY,
            taskIds: ['task-1'],
          }),
        ],
      }),
      assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: DEFINITION_KEY })],
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(result.recentAssignments[0].metrics.completeness).toEqual({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 0,
    });
  });

  it('warns once when submissions exist but matching analyser per-task rows are absent', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const assignmentId = 'a-with-submissions';
    const assessedAssignment = {
      ...assignment({
        assignmentId,
        updatedAt: DEFAULT_TS,
        definitionKey: DEFINITION_KEY,
        taskIds: ['task-1'],
      }),
      submissions: [
        createSubmission('s-1', 'Alice', assignmentId, {
          'task-1': createSubmissionItem('task-1', { accuracy: { score: 4 } }),
        }),
      ],
    };

    adaptClassPageToViewModel({
      analyserResult: averagingResult({ perTask: [] }),
      classFull: classFull({
        students: [student('s-1', 'Alice')],
        assignments: [assessedAssignment],
      }),
      assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: DEFINITION_KEY })],
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [context, rawEntry] = warnSpy.mock.calls[0]!;
    const entry = rawEntry as {
      errorMessage?: unknown;
      level?: unknown;
      metadata?: Record<string, unknown>;
    };
    expect(context).toEqual(expect.any(String));
    expect(context).not.toBe('');
    expect(entry).toMatchObject({
      level: 'warn',
      metadata: {
        assignmentId,
        definitionKey: DEFINITION_KEY,
        submissionCount: 1,
      },
    });
    const message = String(entry.errorMessage);
    expect(message).toMatch(/no/i);
    expect(message).toMatch(/analyser/i);
    expect(message).toMatch(/per-task/i);
    expect(message).toMatch(/row/i);
  });
});
