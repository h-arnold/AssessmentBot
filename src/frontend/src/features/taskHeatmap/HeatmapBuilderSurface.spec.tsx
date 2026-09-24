/**
 * Component tests for the Heatmaps builder surface
 * (`HeatmapBuilderSurface`).
 *
 * @remarks
 * These tests pin the assembled surface's behaviour: the selection bar (three
 * labelled controls, disabled-dependent affordances, option ordering and checkbox
 * membership), the content-region precedence matrix (loading skeleton, blocking
 * Result, no-class / no-assignments Empty guidance, ready-with-selections table),
 * and the refresh affordances. They serve as the acceptance gate for the standalone
 * Heatmaps builder surface.
 *
 * The hook `useHeatmapsPageData` is mocked at the module seam (`vi.mock('./useHeatmapsPageData')`)
 * so each test drives one discriminated surface state. The mock return shape is
 * derived from the REAL `HeatmapsPageData` contract exported by `useHeatmapsPageData.ts`
 * (surfaceState discriminator, structured errors, `mergedResult` shape via
 * `adaptMetricsToMergedHeatmap` in `services/dataAnalysis/heatmapAdapter.merged.ts`).
 *
 * --- `optionRender` value-accessor pin (confirmed against INSTALLED antd typings) ---
 * The repo pins **antd v6.3.1** (the "(v5)" hint in the plan is stale). The installed
 * `@rc-component/select` (antd v6's Select base) types `optionRender` as:
 *
 *   optionRender?: (
 *     oriOption: FlattenOptionData<OptionType>,
 *     info: { index: number }
 *   ) => React.ReactNode;
 *
 *   interface FlattenOptionData<OptionType> {
 *     label?: React.ReactNode;
 *     data: OptionType;            // the original option entry
 *     key: React.Key;
 *     value?: RawValueType;        // RawValueType = string | number
 *     groupOption?: boolean;
 *     group?: boolean;
 *   }
 *
 * There is **no `selected` flag** on the option object. Therefore the rendered
 * Checkbox `checked` state MUST be derived from membership of the option's `value`
 * (or `data.value`) in the surface's controlled selected-values array:
 *
 *   const checked = selectedValues.includes(String(oriOption.value));
 *
 * The tests below assert exactly that contract (test "reflects controlled selection
 * membership ...") so a green implementation cannot read a non-existent
 * `option.selected` prop.
 *
 * --- EMPTY-STATE COPY (I3) ---
 * The empty-state guidance copy constants (`NO_CLASS_EMPTY_COPY`,
 * `NO_ASSIGNMENTS_EMPTY_COPY`) are sourced from `pageContent.heatmaps` (single source of
 * truth), per the green-phase handoff; the tests assert against that imported copy rather
 * than hard-coded literals.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HeatmapsSurfaceState } from './heatmapsSurfaceState';
import type { SelectionState } from './selectionCascade';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import {
  ASSIGNMENT_DEFINITION_PARTIALS,
  ASSIGNMENTS_PLACEHOLDER,
  CLASS_FULL,
  CLASS_PLACEHOLDER,
  DISABLED_REASON,
  NO_ASSIGNMENTS_EMPTY_COPY,
  NO_CLASS_EMPTY_COPY,
  PAGE_TITLE,
  READY_CLASS_QUERY,
  SELECTOR_CONTROL_COUNT,
  TOPICS_PLACEHOLDER,
  buildMergedResult,
  renderSurface,
} from '../../test/heatmapBuilderSurfaceTestHelpers';

// Mock the orchestration hook at the module seam. The stub does not import it yet,
// so the mock is inert against the placeholder; the green surface will consume it.
vi.mock('./useHeatmapsPageData', () => ({
  useHeatmapsPageData: vi.fn(),
}));

// ===========================================================================
// Tests
// ===========================================================================

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('HeatmapBuilderSurface — selection bar', () => {
  it('renders three labelled controls in order: class, topics, assignments', () => {
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: [] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
    });

    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(SELECTOR_CONTROL_COUNT);

    // Visible labels carry the accessible names; order is fixed per the layout spec.
    // Assert via the accessible name (not a raw `aria-label` attribute) so a green
    // implementation that wires labels through `aria-labelledby` still satisfies the test.
    expect(comboboxes[0]).toHaveAccessibleName(/class/i);
    expect(comboboxes[1]).toHaveAccessibleName(/topics/i);
    expect(comboboxes[2]).toHaveAccessibleName(/assignments/i);
  });

  it('disables topics and assignments with an accessible reason until a class is chosen', () => {
    // No class selected → dependent selectors disabled, reason discoverable (not tooltip-only).
    renderSurface({
      selection: { classId: null, topicKeys: [], assignmentIds: [] } as SelectionState,
    });

    const topics = screen.getByRole('combobox', { name: /topics/i });
    const assignments = screen.getByRole('combobox', { name: /assignments/i });

    expect(topics).toBeDisabled();
    expect(assignments).toBeDisabled();

    // The reason must be discoverable by assistive tech (Tooltip content rendered in DOM).
    const reason = screen.getByText(DISABLED_REASON);
    expect(reason).toHaveAttribute('id', 'heatmap-selection-disabled-reason');
    // Both dependent controls use the same DOM-present reason, not colour alone.
    expect(topics).toHaveAttribute('aria-describedby', 'heatmap-selection-disabled-reason');
    expect(assignments).toHaveAttribute('aria-describedby', 'heatmap-selection-disabled-reason');
    expect(topics).toHaveAccessibleDescription(DISABLED_REASON);
    expect(assignments).toHaveAccessibleDescription(DISABLED_REASON);
  });

  it('shows action-describing placeholders for all three selectors', () => {
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: [] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
    });

    expect(screen.getByText(CLASS_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByText(TOPICS_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByText(ASSIGNMENTS_PLACEHOLDER)).toBeInTheDocument();
  });

  it('lists assignment options in class-assignment order (not re-sorted by title)', async () => {
    // The class lists assignments in order a1 (def-z) then a2 (def-a); their
    // resolved titles are "Zebra Task" then "Apple Task" — alphabetically
    // reversed. A re-sort by title would flip the order, so asserting the
    // observed order proves the surface preserves `ClassFull.assignments` order
    // (assignment options preserve `ClassFull.assignments` order; re-sorting by title is forbidden).
    const orderedClassFull: ClassFull = {
      classId: 'class-1',
      className: 'Test Class 7A',
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: 'yg-7',
      classOwner: null,
      teachers: [],
      students: [{ id: 's-1', name: 'Student One', email: 's1@test.com' }],
      assignments: [
        {
          assignmentId: 'a1',
          assignmentDefinitionKey: 'def-z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
        {
          assignmentId: 'a2',
          assignmentDefinitionKey: 'def-a',
          updatedAt: '2025-02-01T00:00:00.000Z',
        },
      ],
      active: true,
    } as unknown as ClassFull;
    const orderedPartials: AssignmentDefinitionPartialsResponse = [
      {
        primaryTitle: 'Zebra Task',
        primaryTopic: 'Topic Z',
        primaryTopicKey: 'topic-z',
        yearGroupKey: 'yg-7',
        yearGroupLabel: 'Year 7',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'doc',
        referenceDocumentId: null,
        templateDocumentId: null,
        assignmentWeighting: 1,
        definitionKey: 'def-z',
        tasks: [{ taskId: 'tZ', taskWeighting: 1, taskTitle: 'Task Z' }],
        createdAt: null,
        updatedAt: null,
      },
      {
        primaryTitle: 'Apple Task',
        primaryTopic: 'Topic A',
        primaryTopicKey: 'topic-a',
        yearGroupKey: 'yg-7',
        yearGroupLabel: 'Year 7',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'doc',
        referenceDocumentId: null,
        templateDocumentId: null,
        assignmentWeighting: 1,
        definitionKey: 'def-a',
        tasks: [{ taskId: 'tA', taskWeighting: 1, taskTitle: 'Task A' }],
        createdAt: null,
        updatedAt: null,
      },
    ];

    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: [] } as SelectionState,
      classFull: orderedClassFull,
      classFullQuery: READY_CLASS_QUERY,
      assignmentDefinitionPartials: orderedPartials,
    });

    const assignments = screen.getByRole('combobox', { name: /assignments/i });
    await user.click(assignments);

    const optionNames = screen.getAllByRole('option').map((option) => option.textContent?.trim());
    expect(optionNames).toEqual(['Zebra Task', 'Apple Task']);
  });
});

describe('HeatmapBuilderSurface — checkbox options', () => {
  it('reflects controlled selection membership via the derived optionRender checked state', async () => {
    // 'a1' is selected; 'a2' is not. The Checkbox checked state must be derived from
    // membership of option.value in the controlled selection — NOT from a (non-existent)
    // option.selected flag (see file header for the pinned antd v6 accessor).
    // Per finding C1 the assignment options are labelled by the RESOLVED `primaryTitle`
    // (from `assignmentDefinitionPartials`), so options are located by title, not by id.
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: ['a1'] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      assignmentDefinitionPartials: ASSIGNMENT_DEFINITION_PARTIALS,
    });

    const assignments = screen.getByRole('combobox', { name: /assignments/i });
    await user.click(assignments);

    // Each rendered option exposes a Checkbox whose checked state tracks membership.
    // Options are resolved by definition partial title: a1 → 'Title def1', a2 → 'Title def2'.
    const selectedAssignmentOption = screen.getByRole('option', { name: /title def1/i });
    const unselectedAssignmentOption = screen.getByRole('option', { name: /title def2/i });

    const selectedAssignmentCheckbox = within(selectedAssignmentOption).getByRole('checkbox');
    const unselectedAssignmentCheckbox = within(unselectedAssignmentOption).getByRole('checkbox');

    // A-N1 removed the redundant explicit `aria-checked` prop; Ant Design's Checkbox
    // derives checked state on the native input, so assert the `checked` state instead.
    expect(selectedAssignmentCheckbox).toBeChecked();
    expect(unselectedAssignmentCheckbox).not.toBeChecked();
  });

  it('narrows options client-side via the search box', async () => {
    // Per finding C1 the assignment options are labelled by the RESOLVED `primaryTitle`
    // (from `assignmentDefinitionPartials`), so the search narrows options by title.
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: [] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      assignmentDefinitionPartials: ASSIGNMENT_DEFINITION_PARTIALS,
    });

    const assignments = screen.getByRole('combobox', { name: /assignments/i });
    await user.click(assignments);

    // Search narrows the option list without a server round-trip. In antd v6.3.1
    // the search surface for a searchable Select IS the combobox (no separate
    // `searchbox`-role node is rendered), so the query targets that element.
    await user.type(assignments, 'Title def1');
    expect(screen.getByRole('option', { name: /title def1/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /title def2/i })).not.toBeInTheDocument();
  });
});

describe('HeatmapBuilderSurface — content-region precedence matrix', () => {
  it('renders a shape-matched skeleton in the initial loading state', () => {
    renderSurface({
      surfaceState: { status: 'loading' } as HeatmapsSurfaceState,
    });

    expect(document.querySelector('.ant-skeleton')).toBeInTheDocument();
  });

  it('renders a blocking Result in the blocking state (layout-spec deviation from Alert)', () => {
    renderSurface({
      surfaceState: {
        status: 'blocking',
        error: { type: 'classNotFound' },
      } as HeatmapsSurfaceState,
    });

    // The layout spec documents Result (not Alert) for the primary content region.
    expect(document.querySelector('.ant-result')).toBeInTheDocument();
  });

  it('renders the no-class Empty guidance when no class is selected', () => {
    renderSurface({
      selection: { classId: null, topicKeys: [], assignmentIds: [] } as SelectionState,
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
    });

    expect(screen.getByText(NO_CLASS_EMPTY_COPY)).toBeInTheDocument();
    expect(document.querySelector('.ant-empty')).toBeInTheDocument();
  });

  it('renders the no-assignments Empty guidance when a class is loaded but none selected', () => {
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: [] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
    });

    expect(screen.getByText(NO_ASSIGNMENTS_EMPTY_COPY)).toBeInTheDocument();
    expect(document.querySelector('.ant-empty')).toBeInTheDocument();
  });

  it('renders the merged-table Card when ready with selections', () => {
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: ['a1'] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      mergedResult: buildMergedResult(),
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
    });

    // The merged table is the TaskHeatmapTable (aria-label "Task Heatmap").
    expect(screen.getByLabelText('Task Heatmap')).toBeInTheDocument();
  });

  it('gives the blocking state precedence over empty-state candidates when both co-occur', () => {
    // Both a blocking error AND a no-class condition are present; blocking must win.
    renderSurface({
      selection: { classId: null, topicKeys: [], assignmentIds: [] } as SelectionState,
      surfaceState: {
        status: 'blocking',
        error: { type: 'classNotFound' },
      } as HeatmapsSurfaceState,
    });

    expect(document.querySelector('.ant-result')).toBeInTheDocument();
    expect(screen.queryByText(NO_CLASS_EMPTY_COPY)).not.toBeInTheDocument();
  });
});

describe('HeatmapBuilderSurface — refresh', () => {
  it('triggers the hook refetch when the Refresh button is clicked', async () => {
    const refetch = vi.fn();
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: ['a1'] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      mergedResult: buildMergedResult(),
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
      refetch,
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exposes a busy affordance on the content region (not the disabled button) while isRefreshing is true', () => {
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: ['a1'] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      mergedResult: buildMergedResult(),
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
      isRefreshing: true,
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    // The Refresh button is disabled for the affordance, but NOT aria-busy: a
    // disabled native button is removed from the accessibility tree, so its
    // aria-busy would never be announced (per the background-refresh standard).
    expect(refreshButton).toBeDisabled();
    expect(refreshButton).not.toHaveAttribute('aria-busy');

    // The persistent content region carries the busy signal instead.
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();

    // A visually-hidden live status announces the background refresh.
    expect(screen.getByText(/refreshing heatmap/i)).toBeInTheDocument();
  });

  it('keeps the merged table visible across a background refresh', () => {
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: ['a1'] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      mergedResult: buildMergedResult(),
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
      isRefreshing: true,
    });

    // Visible data persists during refresh — no skeleton flash, table stays mounted.
    expect(screen.getByLabelText('Task Heatmap')).toBeInTheDocument();
    expect(document.querySelector('.ant-skeleton')).not.toBeInTheDocument();
  });
});

describe('HeatmapBuilderSurface — chrome title derivation', () => {
  it('shows the page title and a Refresh action when no class is selected', () => {
    renderSurface({
      selection: { classId: null, topicKeys: [], assignmentIds: [] } as SelectionState,
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
    });

    // Heading derives from pageContent.heatmaps.heading when no class is chosen.
    expect(screen.getByRole('heading', { name: PAGE_TITLE })).toBeInTheDocument();
    // The chrome always renders the Refresh action (per the layout spec).
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('shows the selected class name as the title when a class is selected', () => {
    renderSurface({
      selection: { classId: 'class-1', topicKeys: [], assignmentIds: [] } as SelectionState,
      classFull: CLASS_FULL,
      classFullQuery: READY_CLASS_QUERY,
      surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
    });

    expect(screen.getByRole('heading', { name: 'Test Class 7A' })).toBeInTheDocument();
  });
});
