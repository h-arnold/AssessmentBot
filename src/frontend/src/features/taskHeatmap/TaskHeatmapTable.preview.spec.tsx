import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskHeatmapTable } from './TaskHeatmapTable';
import {
  buildHeatmapResult,
  getHeatmapCellByLabel,
  POPULATED_LOOKUP,
  EMPTY_LOOKUP,
} from '../../test/taskHeatmapTableTestHelpers';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import type * as TaskPreviewDataModule from './assembleTaskPreviewData';

const { assembleTaskPreviewDataSpy } = vi.hoisted(() => ({
  assembleTaskPreviewDataSpy: vi.fn(),
}));

vi.mock('./assembleTaskPreviewData', async (importOriginal) => {
  const actual = await importOriginal<typeof TaskPreviewDataModule>();
  assembleTaskPreviewDataSpy.mockImplementation(actual.assembleTaskPreviewData);
  return { ...actual, assembleTaskPreviewData: assembleTaskPreviewDataSpy };
});

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  assembleTaskPreviewDataSpy.mockClear();
  user = userEvent.setup();
});
afterEach(() => {
  cleanup();
});

describe('TaskHeatmapTable popover integration and preview presentation', () => {
  it('uses the human-readable task title in both cell and trigger accessible names', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const accessibleName = 'Student One, Task 1, Completeness: 5';
    const cell = getHeatmapCellByLabel(accessibleName);
    const trigger = within(cell).getByRole('button', { name: accessibleName });

    expect(cell).toHaveAttribute('aria-label', accessibleName);
    expect(trigger).toHaveAttribute('aria-label', accessibleName);
  });

  it('does not describe the Ant Design Popover trigger as a dialog', () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    const trigger = within(cell).getByRole('button');

    expect(trigger).not.toHaveAttribute('aria-haspopup');
  });

  it('does not assemble preview data until its popover opens', async () => {
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={POPULATED_LOOKUP}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    expect(assembleTaskPreviewDataSpy).not.toHaveBeenCalled();

    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    await user.hover(within(cell).getByRole('button'));
    await waitFor(() => {
      expect(document.querySelector('.ant-popover-content')).toBeInTheDocument();
    });

    expect(assembleTaskPreviewDataSpy).toHaveBeenCalledWith(
      expect.objectContaining({ artifactContent: 'Student answered the question correctly.' }),
      expect.objectContaining({ state: 'computed', value: 5 }),
      'completeness',
      'task_001'
    );
  });

  // -------------------------------------------------------------------------
  // 6. Popover integration — metric sub-cells are wrapped in Popover with
  //    TaskPreviewCard content, while existing cell appearance is preserved.
  // -------------------------------------------------------------------------

  it('wraps each metric sub-cell render output in an Ant Design Popover', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Find a computed cell's score span via its aria-label
    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    const trigger = cell.querySelector('span');
    expect(trigger).toBeInTheDocument();

    // Hover the trigger — Popover should appear after mouseEnterDelay
    await user.hover(trigger!);

    // Assert the popover wrapper appears in the DOM
    await waitFor(() => {
      expect(document.querySelector('.ant-popover')).toBeInTheDocument();
    });
  });

  it('popover content renders the TaskPreviewCard with metric label, reasoning, and student response sections', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    // Wait for popover to open and assert TaskPreviewCard sections
    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      expect(popover!.textContent).toContain('Completeness');
      expect(popover!.textContent).toContain('Reasoning');
      expect(popover!.textContent).toContain('Student Response');
    });
  });

  it('preserves the existing aria-label on metric sub-cells after popover integration', () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // The aria-label comes from onCell, not from render — Popover does not
    // change onCell, so the label should be unchanged.
    expect(getHeatmapCellByLabel('Student One, Task 1, Completeness: 5')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student One, Task 1, Accuracy: 3')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Two, Task 2, Completeness: E')).toBeInTheDocument();
  });

  it('preserves the existing cell tone style (background colour) after popover integration', () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Student One, Task 1, Completeness: 5 is a computed score at the ceiling
    // of the range — the cell should carry a green/gradient background colour.
    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    // resolveMetricTone sets backgroundColor (camelCase) on the <td> via onCell
    expect(cell.style.backgroundColor).toBeTruthy();
    expect(cell.style.backgroundColor).not.toBe('');
  });

  it('renders the heatmap with interactive metric sub-cells that open a popover on hover', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={false}
        showAssignmentError={false}
      />
    );

    // Assert metric sub-cells are present and labelled
    expect(getHeatmapCellByLabel('Student One, Task 1, Completeness: 5')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Two, Task 1, Completeness: 3')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Three, Task 1, Completeness: N')).toBeInTheDocument();

    // Hover a computed cell and assert the popover opens
    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      expect(document.querySelector('.ant-popover')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // real-data wiring: skeleton, error, populated, empty popover states
  // and metric cell display invariance.
  // -------------------------------------------------------------------------

  it('renders a skeleton in the popover when isAssignmentLoading is true', async () => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={null}
        isAssignmentLoading={true}
        showAssignmentError={false}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      // The skeleton must use an <output> element (implicit role="status") with aria-busy="true"
      const skeleton = popover!.querySelector('output[aria-busy="true"]');
      expect(skeleton).toBeInTheDocument();
    });
  });

  it.each<{
    title: string;
    lookup: CellPreviewLookup | null;
    showAssignmentError: boolean;
    expectedText: string;
  }>([
    {
      title: 'renders an error Alert in the popover when showAssignmentError is true',
      lookup: null,
      showAssignmentError: true,
      expectedText: "Couldn't load task details",
    },
    {
      title:
        'shows artifact content from cellPreviewLookup in the popover when the lookup has data',
      lookup: POPULATED_LOOKUP,
      showAssignmentError: false,
      expectedText: 'Student answered the question correctly.',
    },
    {
      title:
        'shows empty artifact and No reasoning available in the popover when the lookup has no entry',
      lookup: EMPTY_LOOKUP,
      showAssignmentError: false,
      expectedText: 'No reasoning available',
    },
  ])('$title', async ({ lookup, showAssignmentError, expectedText }) => {
    const result = buildHeatmapResult();
    render(
      <TaskHeatmapTable
        heatmapResult={result}
        cellPreviewLookup={lookup}
        isAssignmentLoading={false}
        showAssignmentError={showAssignmentError}
      />
    );

    const cell = getHeatmapCellByLabel('Student One, Task 1, Completeness: 5');
    const trigger = cell.querySelector('span')!;
    expect(trigger).toBeInTheDocument();

    await user.hover(trigger);

    await waitFor(() => {
      const popover = document.querySelector('.ant-popover');
      expect(popover).toBeInTheDocument();
      expect(popover!.textContent).toContain(expectedText);
    });
  });

  it('keeps metric score cell display unchanged regardless of the three new props', () => {
    // Render with loading state — cell display must be unchanged
    render(
      <TaskHeatmapTable
        heatmapResult={buildHeatmapResult()}
        cellPreviewLookup={null}
        isAssignmentLoading={true}
        showAssignmentError={false}
      />
    );

    expect(getHeatmapCellByLabel('Student One, Task 1, Completeness: 5')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student One, Task 1, Accuracy: 3')).toBeInTheDocument();
    expect(getHeatmapCellByLabel('Student Two, Task 2, Completeness: E')).toBeInTheDocument();
  });
});
