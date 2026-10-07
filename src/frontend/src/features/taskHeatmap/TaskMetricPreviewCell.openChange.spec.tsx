import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as AntdModule from 'antd';

const popoverSeam = vi.hoisted(() => ({
  onOpenChange: undefined as ((open: boolean) => void) | undefined,
}));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof AntdModule>();
  return {
    ...actual,
    Popover: ({
      children,
      content,
      onOpenChange,
    }: {
      children: ReactNode;
      content: ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => {
      popoverSeam.onOpenChange = onOpenChange;
      return (
        <>
          {children}
          {content}
        </>
      );
    },
  };
});

import { TaskMetricPreviewCell } from './TaskMetricPreviewCell';
import {
  buildCanonicalReadyCellData,
  CANONICAL_READY_CELL,
} from '../../test/taskHeatmap/previewFixtures';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';
import { formatMetricDisplayText } from '../../services/dataAnalysis/metricDisplay/metricDisplayText';
import { buildMetricCellAccessibleLabel } from './taskHeatmapTableColumns';
import { SOURCE_ACTION_LABEL } from './TaskPreviewCard';

afterEach(() => {
  cleanup();
  popoverSeam.onOpenChange = undefined;
  vi.restoreAllMocks();
});

describe('TaskMetricPreviewCell open-change focus scheduling', () => {
  it('schedules source focus when the open callback arrives with an action mounted and keyboard intent pending', async () => {
    const scheduled: Array<() => void> = [];
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
      scheduled.push(callback);
    });

    const metricResult = createComputedMetricResult({
      value: CANONICAL_READY_CELL.completenessScore,
    });
    const scoreText = formatMetricDisplayText(metricResult, 0);
    const label = buildMetricCellAccessibleLabel(
      CANONICAL_READY_CELL.studentName,
      CANONICAL_READY_CELL.taskTitle,
      'completeness',
      scoreText
    );
    render(
      <TaskMetricPreviewCell
        accessibleLabel={label}
        scoreText={scoreText}
        cellData={buildCanonicalReadyCellData()}
        metricResult={metricResult}
        metricKey="completeness"
        taskId={CANONICAL_READY_CELL.taskId}
        isLoading={false}
        hasError={false}
      />
    );

    const trigger = screen.getByRole('button', { name: label });
    const action = screen.getByRole('link', { name: SOURCE_ACTION_LABEL });
    trigger.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(trigger).toHaveFocus();
    expect(action).not.toHaveFocus();
    const countBeforeOpenCallback = scheduled.length;

    expect(popoverSeam.onOpenChange).toBeDefined();
    let callbackScheduledFocus: (() => void) | undefined;
    await act(async () => {
      popoverSeam.onOpenChange?.(true);
      callbackScheduledFocus = scheduled[countBeforeOpenCallback];
    });

    expect(scheduled.slice(countBeforeOpenCallback)).toContain(callbackScheduledFocus);
    await act(async () => {
      callbackScheduledFocus?.();
    });
    expect(action).toHaveFocus();
  });
});
