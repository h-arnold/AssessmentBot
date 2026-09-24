import { describe, expect, it } from 'vitest';
import {
  createAccumulator,
  createDataPointAccumulator,
  ensureAverageContribution,
  getOrCreatePerStudentTaskAccum,
  getOrCreateStudentAccum,
  getOrCreateTaskAccum,
  preRegisterTasks,
  requireAverageContribution,
} from './averagingAnalyser.accumulatorRegistry';
import type { DataPointAccumulator } from './averagingAnalyser.types';
import { createTaskPartial } from '../../../test/dataAnalysis/fixtures';
import type { AverageContribution } from '../dataAnalysis.zod';

const ZERO = 0;
const ONE = 1;
const TWO = 2;
const THREE = 3;
const FOUR = 4;
const FIVE = 5;

type StudentAccumulator = { studentName: string | null } & DataPointAccumulator;
type TaskAccumulator = { definitionKey: string; taskId: string } & DataPointAccumulator;

describe('accumulator registry', () => {
  it('creates independent empty metric and criterion accumulators', () => {
    const metric = createAccumulator();

    expect(metric).toEqual({
      weightedSum: ZERO,
      totalWeight: ZERO,
      applicableDataPoints: ZERO,
      totalDataPoints: ZERO,
      nCount: ZERO,
      displaySum: ZERO,
      displayCount: ZERO,
      displayNCount: ZERO,
      displayTotalDataPoints: ZERO,
    });

    const first = createDataPointAccumulator();
    const second = createDataPointAccumulator();
    first.completeness.weightedSum = FIVE;

    expect(first.completeness).not.toBe(first.accuracy);
    expect(second.completeness.weightedSum).toBe(ZERO);
  });

  it('pre-registers definition-scoped tasks without replacing an existing accumulator', () => {
    const definitionKey = 'dk_registry';
    const taskAccums = new Map<string, TaskAccumulator>();
    preRegisterTasks(
      [createTaskPartial('t_001'), createTaskPartial('t_002')],
      definitionKey,
      taskAccums
    );

    const taskKey = `${definitionKey}::t_001`;
    const existing = taskAccums.get(taskKey)!;
    existing.accuracy.displaySum = FOUR;
    preRegisterTasks([createTaskPartial('t_001')], definitionKey, taskAccums);

    expect([...taskAccums.keys()]).toEqual([taskKey, `${definitionKey}::t_002`]);
    expect(taskAccums.get(taskKey)).toBe(existing);
    expect(taskAccums.get(taskKey)?.accuracy.displaySum).toBe(FOUR);
  });

  it('returns the same student accumulator after the first registration', () => {
    const studentAccums = new Map<string, StudentAccumulator>();

    const first = getOrCreateStudentAccum(studentAccums, 's_001', 'Alice');
    first.completeness.displayCount = ONE;
    const second = getOrCreateStudentAccum(studentAccums, 's_001', 'Replacement name');

    expect(second).toBe(first);
    expect(studentAccums.get('s_001')?.studentName).toBe('Alice');
    expect(studentAccums.size).toBe(ONE);
  });

  it('returns the same definition-scoped task accumulator after the first registration', () => {
    const taskAccums = new Map<string, TaskAccumulator>();

    const first = getOrCreateTaskAccum(taskAccums, 'dk_registry', 't_001');
    first.spag.displayCount = TWO;
    const second = getOrCreateTaskAccum(taskAccums, 'dk_registry', 't_001');

    expect(second).toBe(first);
    expect(taskAccums.get('dk_registry::t_001')).toBe(first);
    expect(taskAccums.size).toBe(ONE);
  });

  it('creates and reuses per-student task accumulators independently by student and task', () => {
    const perStudentTaskAccums = new Map<string, Map<string, DataPointAccumulator>>();

    const first = getOrCreatePerStudentTaskAccum(
      perStudentTaskAccums,
      's_001',
      'dk_registry::t_001'
    );
    first.completeness.displayCount = THREE;
    const second = getOrCreatePerStudentTaskAccum(
      perStudentTaskAccums,
      's_001',
      'dk_registry::t_001'
    );
    const otherTask = getOrCreatePerStudentTaskAccum(
      perStudentTaskAccums,
      's_001',
      'dk_registry::t_002'
    );
    const otherStudent = getOrCreatePerStudentTaskAccum(
      perStudentTaskAccums,
      's_002',
      'dk_registry::t_001'
    );

    expect(second).toBe(first);
    expect(otherTask).not.toBe(first);
    expect(otherStudent).not.toBe(first);
    expect(perStudentTaskAccums.get('s_001')?.size).toBe(TWO);
    expect(perStudentTaskAccums.get('s_002')?.size).toBe(ONE);
  });

  it('records contribution inclusion from the effective weight', () => {
    const contributions = new Map<string, AverageContribution>();

    ensureAverageContribution(contributions, 'dk_registry', 't_positive', TWO);
    ensureAverageContribution(contributions, 'dk_registry', 't_zero', ZERO);

    expect(contributions.get('dk_registry::t_positive')).toEqual({
      effectiveWeight: TWO,
      includedInAverage: true,
    });
    expect(contributions.get('dk_registry::t_zero')).toEqual({
      effectiveWeight: ZERO,
      includedInAverage: false,
    });
  });

  it('keeps repeated equal contribution registrations idempotent', () => {
    const contributions = new Map<string, AverageContribution>();

    ensureAverageContribution(contributions, 'dk_registry', 't_001', THREE);
    ensureAverageContribution(contributions, 'dk_registry', 't_001', THREE);

    expect(contributions.size).toBe(ONE);
    expect(contributions.get('dk_registry::t_001')?.effectiveWeight).toBe(THREE);
  });

  it('rejects conflicting effective weights for the same task key', () => {
    const contributions = new Map<string, AverageContribution>();
    ensureAverageContribution(contributions, 'dk_registry', 't_001', ONE);

    expect(() => ensureAverageContribution(contributions, 'dk_registry', 't_001', TWO)).toThrow(
      /conflicting effective weights/
    );
  });

  it('returns the registered contribution through the shared lookup', () => {
    const contribution = { effectiveWeight: THREE, includedInAverage: true };
    const contributions = new Map<string, AverageContribution>([
      ['dk_registry::t_001', contribution],
    ]);

    expect(
      requireAverageContribution(contributions, 'dk_registry::t_001', 'buildPerStudentTaskMetrics')
    ).toBe(contribution);
  });

  it('throws a consumer-specific error when contribution lookup is missing', () => {
    expect(() =>
      requireAverageContribution(new Map(), 'dk_registry::t_missing', 'buildPerTaskRows')
    ).toThrow("buildPerTaskRows: missing averageContribution for taskKey 'dk_registry::t_missing'");
  });
});
