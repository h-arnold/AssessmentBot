import { describe, expect, it } from 'vitest';
import { buildPerStudentRows, buildPerTaskRows } from './averagingAnalyser.rows';
import { createDataPointAccumulator } from './averagingAnalyser.accumulatorRegistry';

describe('per-student row naming boundaries', () => {
  it('throws for a null studentName in a single row and names the student ID', () => {
    const studentAccums = new Map([
      [
        's_single',
        {
          studentName: null,
          ...createDataPointAccumulator(),
        },
      ],
    ]);

    expect(() =>
      buildPerStudentRows(studentAccums, new Map(), {
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      })
    ).toThrow(/s_single/);
  });
});

describe('per-task display fallback boundaries', () => {
  it('retains the display overall when the composite resolves excluded', () => {
    const accumulator = createDataPointAccumulator();
    for (const criterion of ['completeness', 'accuracy', 'spag', 'overall'] as const) {
      accumulator[criterion].displaySum = 6;
      accumulator[criterion].displayCount = 1;
      accumulator[criterion].displayTotalDataPoints = 1;
    }

    const rows = buildPerTaskRows(
      new Map([
        [
          'dk_boundary::task',
          {
            definitionKey: 'dk_boundary',
            taskId: 'task',
            ...accumulator,
          },
        ],
      ]),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
      new Map([['dk_boundary::task', { effectiveWeight: 0, includedInAverage: false }]])
    );

    expect(rows[0].overall).toMatchObject({ state: 'computed', value: 6 });
    expect(rows[0].completeness).toMatchObject({ state: 'computed', value: 6 });
  });
});
