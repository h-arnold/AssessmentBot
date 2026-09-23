import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { TaskHeatmapTable } from './TaskHeatmapTable';
import type {
  MergedHeatmapResult,
  MergedHeatmapTaskColumn,
} from '../../services/dataAnalysis/heatmapAdapter.merged';
import type { PreviewStatus } from './assembleMergedPreviewData';
import { buildCell } from '../../test/taskHeatmapTableTestHelpers';

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  user = userEvent.setup();
});
afterEach(() => {
  cleanup();
});

// ===========================================================================
// Preview-status resolution order, merged wiring, and adaptive assignment tiers
// ===========================================================================

/** Readonly per-taskKey preview-status map (matches the planned prop contract). */
type PreviewStatusMap = ReadonlyMap<string, PreviewStatus>;

let lastRenderProperties: ComponentProps<typeof TaskHeatmapTable> | null = null;

/**
 * Render `TaskHeatmapTable` with its narrowed structural props.
 *
 * @param {ComponentProps<typeof TaskHeatmapTable>} properties - Component props.
 * @returns {ReturnType<typeof render>} The Testing Library render result.
 */
function renderTable(
  properties: ComponentProps<typeof TaskHeatmapTable>
): ReturnType<typeof render> {
  lastRenderProperties = properties;
  return render(<TaskHeatmapTable {...properties} />);
}

// ---------------------------------------------------------------------------
// Merged-shaped fixtures (mirror `MergedHeatmapResult` contract)
// ---------------------------------------------------------------------------

/** Definition key for the single-source and first two-source assignment. */
const MERGED_DEF_1 = 'def-1';
/** Definition key for the second two-source assignment. */
const MERGED_DEF_2 = 'def-2';
/** Shared definition key used by the collapsed-duplicate fixture. */
const MERGED_DEF_SHARED = 'def-shared';

/** First source assignment identifier. */
const A1_ID = 'a-1';
/** First source assignment name (used as the adaptive-tier parent title). */
const A1_NAME = 'Assignment One';
/** Second source assignment identifier. */
const A2_ID = 'a-2';
/** Second source assignment name (used as the adaptive-tier parent title). */
const A2_NAME = 'Assignment Two';

/** Completeness score for the first task column in merged fixtures. */
const MERGED_PRIMARY_TASK_SCORE = 5;
/** Completeness score for subsequent task columns in merged fixtures. */
const MERGED_SECONDARY_TASK_SCORE = 3;

/**
 * Build merged-shaped student rows with the given number of task cells.
 *
 * @param {number} taskCount - Number of task columns (cells per row).
 * @returns {MergedHeatmapResult['rows']} Three student rows.
 */
function buildMergedRows(taskCount: number): MergedHeatmapResult['rows'] {
  const studentNames = ['Student One', 'Student Two', 'Student Three'];
  const studentIds = ['s-1', 's-2', 's-3'];
  return studentIds.map((studentId, index) => ({
    studentId,
    studentName: studentNames[index]!,
    cells: Array.from({ length: taskCount }, (_, taskIndex) =>
      buildCell({
        completenessValue:
          taskIndex === 0 ? MERGED_PRIMARY_TASK_SCORE : MERGED_SECONDARY_TASK_SCORE,
      })
    ),
  }));
}

/**
 * Build a single-source merged result (one assignment, three task columns).
 *
 * @returns {MergedHeatmapResult} A merged-shaped view model for one assignment.
 */
function buildSingleSourceMergedResult(): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_1}::t1`,
      taskId: 't1',
      taskTitle: 'A1 Task 1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_1}::t2`,
      taskId: 't2',
      taskTitle: 'A1 Task 2',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_1}::t3`,
      taskId: 't3',
      taskTitle: 'A1 Task 3',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    sourceAssignments: [
      { assignmentId: A1_ID, definitionKey: MERGED_DEF_1, assignmentName: A1_NAME },
    ],
    taskColumns,
    rows: buildMergedRows(taskColumns.length),
  };
}

/**
 * Build a two-source merged result (two assignments, two task columns each).
 *
 * @returns {MergedHeatmapResult} A merged-shaped view model spanning two assignments.
 */
function buildTwoSourceMergedResult(): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_1}::t1`,
      taskId: 't1',
      taskTitle: 'A1 Task 1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_1}::t2`,
      taskId: 't2',
      taskTitle: 'A1 Task 2',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_1,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_2}::t3`,
      taskId: 't3',
      taskTitle: 'A2 Task 1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A2_ID,
      definitionKey: MERGED_DEF_2,
      assignmentName: A2_NAME,
    },
    {
      taskKey: `${MERGED_DEF_2}::t4`,
      taskId: 't4',
      taskTitle: 'A2 Task 2',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A2_ID,
      definitionKey: MERGED_DEF_2,
      assignmentName: A2_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    sourceAssignments: [
      { assignmentId: A1_ID, definitionKey: MERGED_DEF_1, assignmentName: A1_NAME },
      { assignmentId: A2_ID, definitionKey: MERGED_DEF_2, assignmentName: A2_NAME },
    ],
    taskColumns,
    rows: buildMergedRows(taskColumns.length),
  };
}

/**
 * Build a collapsed-duplicate merged result: two source assignments share one
 * definition key, so the de-duplicated columns carry the FIRST instance's identity.
 *
 * @returns {MergedHeatmapResult} A merged-shaped view model with a collapsed column set.
 */
function buildCollapsedMergedResult(): MergedHeatmapResult {
  const taskColumns: MergedHeatmapTaskColumn[] = [
    {
      taskKey: `${MERGED_DEF_SHARED}::t1`,
      taskId: 't1',
      taskTitle: 'Shared Task 1',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_SHARED,
      assignmentName: A1_NAME,
    },
    {
      taskKey: `${MERGED_DEF_SHARED}::t2`,
      taskId: 't2',
      taskTitle: 'Shared Task 2',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: A1_ID,
      definitionKey: MERGED_DEF_SHARED,
      assignmentName: A1_NAME,
    },
  ];
  return {
    classId: 'class-1',
    className: 'Class A',
    // Both instances share the definition key — the signal set for a collapsed group.
    sourceAssignments: [
      { assignmentId: A1_ID, definitionKey: MERGED_DEF_SHARED, assignmentName: A1_NAME },
      { assignmentId: A2_ID, definitionKey: MERGED_DEF_SHARED, assignmentName: A2_NAME },
    ],
    taskColumns,
    rows: buildMergedRows(taskColumns.length),
  };
}

/**
 * Open a metric cell popover by hovering its trigger and return the popover node.
 *
 * @param {string} taskId - The task ID whose Completeness cell should be hovered.
 * @returns {Promise<HTMLElement>} The opened Ant Design popover element.
 */
async function openTaskPopover(taskId: string): Promise<HTMLElement> {
  // Locate by task id and metric only — the completeness score varies per
  // column in the merged fixtures, so the score component of the label is
  // intentionally not pinned here.
  //
  // antd v6 reuses a SINGLE popup node across every trigger instance and, under
  // jsdom (which provides no layout), never rebinds that node's content to a
  // second trigger once it has opened. To inspect a specific cell's popover
  // content deterministically, remount the table from the captured render props
  // so the popup is freshly bound to THIS cell (skeleton / alert / card). The
  // behavioural assertions below run against the returned `.ant-popover` node
  // and are unchanged.
  if (lastRenderProperties) {
    cleanup();
    renderTable(lastRenderProperties);
  }
  // The merged fixtures vary the completeness score per task, so match by the
  // stable "Student One, <taskId>, Completeness:" label prefix rather than a
  // non-literal RegExp (lint-forbidden) or a hard-coded score.
  const cell = screen.getAllByLabelText((content): boolean =>
    content.startsWith(`Student One, ${taskId}, Completeness:`)
  )[0];
  const trigger = cell.querySelector('span');
  expect(trigger).toBeInTheDocument();
  await user.hover(trigger!);
  await waitFor(() => {
    const popovers = document.querySelectorAll('.ant-popover');
    const last = [...popovers].pop() ?? null;
    // antd v6 renders popover content directly under `.ant-popover-content`
    // (no v5-style `.ant-popover-inner-content` wrapper), so assert on the
    // actual content node.
    const inner = last?.querySelector('.ant-popover-content');
    expect(inner).toBeTruthy();
    expect((inner as HTMLElement)?.childElementCount ?? 0).toBeGreaterThan(0);
  });
  const popovers = document.querySelectorAll('.ant-popover');
  return ([...popovers].pop() ?? null) as HTMLElement;
}

describe('TaskHeatmapTable preview-status resolution and adaptive assignment tiers', () => {
  // -------------------------------------------------------------------------
  // Status resolution order — map entry FIRST, else aggregate booleans.
  // -------------------------------------------------------------------------

  it('renders a skeleton when the per-taskKey map entry is loading, overriding the false aggregate booleans', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: true, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.querySelector('output[aria-busy="true"]')).toBeInTheDocument();
  });

  it('treats the aggregate loading flag as inert when the map supplies a healthy entry (normal card, not a skeleton)', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: false, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: true,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popover = await openTaskPopover('t1');
    // A healthy map entry must win over the aggregate loading flag.
    expect(popover.querySelector('output[aria-busy="true"]')).not.toBeInTheDocument();
    expect(popover.textContent).toContain('Student Response');
  });

  it('renders an error Alert when the per-taskKey map entry has an error, overriding the false aggregate booleans', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: false, hasError: true }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.textContent).toContain("Couldn't load task details");
  });

  it('owns status entirely via the map when aggregates are passed as false (loading → skeleton, error → alert, healthy → card)', async () => {
    const result = buildSingleSourceMergedResult();
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: true, hasError: false }],
      [`${MERGED_DEF_1}::t2`, { isLoading: false, hasError: true }],
      [`${MERGED_DEF_1}::t3`, { isLoading: false, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    const popoverT1 = await openTaskPopover('t1');
    expect(popoverT1.querySelector('output[aria-busy="true"]')).toBeInTheDocument();

    const popoverT2 = await openTaskPopover('t2');
    expect(popoverT2.textContent).toContain("Couldn't load task details");

    const popoverT3 = await openTaskPopover('t3');
    expect(popoverT3.textContent).toContain('Student Response');
  });

  it('falls back to the aggregate loading boolean when the preview-status map is undefined (embedded parity)', async () => {
    const result = buildSingleSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: true,
      showAssignmentError: false,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.querySelector('output[aria-busy="true"]')).toBeInTheDocument();
  });

  it('falls back to the aggregate error boolean when the preview-status map is undefined (embedded parity)', async () => {
    const result = buildSingleSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: true,
    });

    const popover = await openTaskPopover('t1');
    expect(popover.textContent).toContain("Couldn't load task details");
  });

  it('falls back to the aggregate booleans for a column with no map entry (not a default healthy state)', async () => {
    const result = buildSingleSourceMergedResult();
    // Map present but healthy for t1 only; t2 has NO map entry. Aggregate is loading.
    const previewStatusByTaskKey: PreviewStatusMap = new Map<string, PreviewStatus>([
      [`${MERGED_DEF_1}::t1`, { isLoading: false, hasError: false }],
    ]);
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: true,
      showAssignmentError: false,
      previewStatusByTaskKey,
    });

    // Present, healthy entry must win → normal card (NOT the aggregate skeleton).
    const popoverT1 = await openTaskPopover('t1');
    expect(popoverT1.querySelector('output[aria-busy="true"]')).not.toBeInTheDocument();
    expect(popoverT1.textContent).toContain('Student Response');

    // Missing entry falls back to the loading aggregate → skeleton (NOT a default healthy card).
    const popoverT2 = await openTaskPopover('t2');
    expect(popoverT2.querySelector('output[aria-busy="true"]')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Adaptive assignment tiers — deeper nested `children` grouping.
  // -------------------------------------------------------------------------

  it('renders a two-tier header with no assignment parent group for a single source assignment', () => {
    const result = buildSingleSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
    });

    // No assignment parent group header titled by the assignment name.
    expect(screen.queryByRole('columnheader', { name: A1_NAME })).not.toBeInTheDocument();

    // Task group headers are still present (two-tier as today).
    expect(screen.getByRole('columnheader', { name: 'A1 Task 1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'A1 Task 2' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'A1 Task 3' })).toBeInTheDocument();
  });

  it('wraps each source assignment under a parent group column titled by assignmentName for two or more sources', () => {
    const result = buildTwoSourceMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
    });

    const parentOne = screen.getByRole('columnheader', { name: A1_NAME });
    const parentTwo = screen.getByRole('columnheader', { name: A2_NAME });
    expect(parentOne).toBeInTheDocument();
    expect(parentTwo).toBeInTheDocument();

    // Stable order: the first source assignment's parent precedes the second.
    const headers = [...document.querySelectorAll('thead .ant-table-cell')];
    const oneIndex = headers.findIndex((header) => header.textContent?.includes(A1_NAME));
    const twoIndex = headers.findIndex((header) => header.textContent?.includes(A2_NAME));
    expect(oneIndex).toBeGreaterThanOrEqual(0);
    expect(twoIndex).toBeGreaterThan(oneIndex);
  });

  it('collapses two source assignments sharing a definition key into one parent group labelled "<first assignmentName> (shared definition)"', () => {
    const result = buildCollapsedMergedResult();
    renderTable({
      heatmapResult: result,
      cellPreviewLookup: null,
      isAssignmentLoading: false,
      showAssignmentError: false,
    });

    // Exactly one collapsed parent group, suffixed with the shared-definition label.
    const collapsedParent = screen.getByRole('columnheader', {
      name: `${A1_NAME} (shared definition)`,
    });
    expect(collapsedParent).toBeInTheDocument();

    // No second parent group for the second (sharing) assignment instance.
    expect(screen.queryByRole('columnheader', { name: A2_NAME })).not.toBeInTheDocument();

    // The shared definition produces ONE collapsed column set.
    expect(screen.getAllByRole('columnheader', { name: 'Shared Task 1' })).toHaveLength(1);
  });
});
