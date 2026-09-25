import { describe, expect, it } from 'vitest';
import { createDefinitionPartial, createTaskPartial } from '../../test/dataAnalysis/fixtures';
import { buildTaskColumns } from './heatmapAdapter';

const NEGATIVE_TASK_WEIGHTING = -1;
const LARGE_FINITE_WEIGHTING = Number.MAX_VALUE;

describe('heatmap task-column weighting boundaries', () => {
  it('rejects a negative effective weight before projecting task-column metadata', () => {
    const partial = createDefinitionPartial({
      tasks: [createTaskPartial('task-001', NEGATIVE_TASK_WEIGHTING)],
    });

    expect(() => buildTaskColumns(partial)).toThrow();
  });

  it('rejects an overflowed effective product from finite live weightings', () => {
    const partial = createDefinitionPartial({
      assignmentWeighting: LARGE_FINITE_WEIGHTING,
      tasks: [createTaskPartial('task-001', LARGE_FINITE_WEIGHTING)],
    });

    expect(() => buildTaskColumns(partial)).toThrow();
  });
});
