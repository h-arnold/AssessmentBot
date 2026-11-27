/**
 * Averages-basis control placement specs for the Class page (`ClassPage`).
 *
 * Pins the mount point per state: ready overview → Student Averages card's
 * top-right `extra`; ready heatmap → the `TaskHeatmapTable` card's `extra`;
 * blocking → the header fallback, preserving the `All tasks` escape. One
 * control mounts at a time (the page-scoped E2E locator is strict).
 *
 * Also covers the a11y contract: labelled options, mode wiring, the hidden
 * label preserving `aria-labelledby`, disabled affordances (root class, disabled
 * radios, sr-only description, `aria-describedby` while disabled), and the ineligible escape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClassPage } from './ClassPage';
import type { ClassPageAdapterResult, RecentAssignmentCardModel } from './classPageAdapter.zod';
import type { ClassPageError } from './useClassPageData';
import {
  analyserResultFixture,
  buildDefaultAssignmentFixture,
  classFullFixture,
  VALID_ASSIGNMENT_PARTIAL,
} from '@/test/taskHeatmapPageFixtures';
import { MODE_CONTROL_LABEL, READY_AVAILABILITY } from '@/test/averagesBasisTestConstants';

const CLASS_PAGE_CLASS_ID = 'class-1';
const CLASS_NAME = 'Class A';
const RECENT_ASSIGNMENT_NAME = 'Assignment One';

const ABSOLUTE_OPTION_LABEL = 'All tasks';
const BASELINE_OPTION_LABEL = 'Baseline tasks';

// Stable DOM ids owned by the control (the Class page mounts once per class).
const MODE_CONTROL_LABEL_ID = 'class-page-mode-control-label';
const MODE_CONTROL_DESCRIPTION_ID = 'class-page-mode-control-description';

// Availability-driven disabled-state copy produced by the hook (specification
// decision 6): the neutral awaiting-data reason.
const AWAITING_DATA_REASON = 'Waiting for class data';

/** Number of options the mode control presents. */
const MODE_OPTION_COUNT = 2;

const {
  mockUseClassPageData,
  mockAssessTaskModal,
  mockUseClassSelection,
  mockGetAssignment,
  mockTaskHeatmapTable,
} = vi.hoisted(() => {
  return {
    mockUseClassPageData: vi.fn(),
    mockAssessTaskModal: vi.fn(function MockAssessTaskModal() {
      return createElement('div', { 'data-testid': 'assess-task-modal' });
    }),
    mockUseClassSelection: vi.fn(() => {
      return {
        selectedClassId: CLASS_PAGE_CLASS_ID,
        className: CLASS_NAME,
        onSelectClass: vi.fn(),
        onNavigateToClasses: vi.fn(),
      };
    }),
    mockGetAssignment: vi.fn(),
    mockTaskHeatmapTable: vi.fn(function MockTaskHeatmapTable() {
      return createElement('div', { 'data-testid': 'task-heatmap-table' });
    }),
  };
});

vi.mock('./useClassPageData', () => ({ useClassPageData: mockUseClassPageData }));
vi.mock('../classes/AssessTaskModal/AssessTaskModal', () => {
  return {
    AssessTaskModal: mockAssessTaskModal,
  };
});
vi.mock('@/ClassSelectionContext', () => ({ useClassSelection: mockUseClassSelection }));
vi.mock('@/services/assignmentAssessment/assignmentAssessmentService', () => {
  return {
    getAssignment: mockGetAssignment,
  };
});

// `StudentAveragesTableCard` is unmocked so placement is asserted against its
// real card head. Only the heavy heatmap table is mocked; its head lives in `TaskHeatmapPage`.

vi.mock('../taskHeatmap/TaskHeatmapTable', () => ({ TaskHeatmapTable: mockTaskHeatmapTable }));

/** Zero-data display metric used by the Assignments table row fixture. */
const NO_DATA_METRIC: ClassPageAdapterResult['studentAverages'][number]['metrics']['completeness'] =
  {
    state: 'notAttempted',
    value: 'N',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
  };

/** The assignment row shown in the Class page overview table. */
const RECENT_ASSIGNMENT: RecentAssignmentCardModel = {
  assignmentId: 'a-1',
  assignmentName: RECENT_ASSIGNMENT_NAME,
  lastAssessedAt: '2026-01-15T00:00:00.000Z',
  lastAssessedAtLabel: '15 Jan 2026',
  metrics: {
    completeness: NO_DATA_METRIC,
    accuracy: NO_DATA_METRIC,
    spag: NO_DATA_METRIC,
    average: NO_DATA_METRIC,
  },
};

/** Availability state before any successful analysis (control disabled). */
const AWAITING_DATA_AVAILABILITY = {
  status: 'awaiting-data' as const,
  reason: AWAITING_DATA_REASON,
};

/** Ineligibility copy for a class below the three-student minimum. */
const ROSTER_REASON = 'Baseline mode needs at least 3 students in this class';

/** Availability state of a class that cannot use baseline mode (control enabled). */
const INELIGIBLE_AVAILABILITY = {
  status: 'ineligible' as const,
  reason: ROSTER_REASON,
};

/**
 * Builds ready-state data for the Class page backed by the shared heatmap
 * fixtures, so the heatmap child view renders the real `TaskHeatmapPage`.
 *
 * @returns {object} The ready-state payload returned by the mocked data hook.
 */
function createReadyClassPageData() {
  return {
    classFull: classFullFixture,
    analyserResult: analyserResultFixture,
    assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
    adapterResult: {
      recentAssignments: [RECENT_ASSIGNMENT],
      studentAverages: [],
      classMetrics: analyserResultFixture.perClass,
    } satisfies ClassPageAdapterResult,
    error: null,
    surfaceState: { status: 'ready' },
    refetch: vi.fn(),
    baselineAvailability: READY_AVAILABILITY,
  };
}

/**
 * Renders the Class page inside a React Query provider.
 *
 * @returns {void}
 */
function renderClassPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ClassPage, { classId: CLASS_PAGE_CLASS_ID })
    )
  );
}

/**
 * Clicks the assignment name in the Assignments table so the Class page switches to its
 * heatmap view.
 *
 * @param {ReturnType<typeof userEvent.setup>} user The user-event controller.
 * @returns {Promise<void>} Resolves once the heatmap view is active.
 */
async function openHeatmapView(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const card = await screen.findByRole('button', { name: new RegExp(RECENT_ASSIGNMENT_NAME, 'i') });
  await user.click(card);
}

/**
 * Resolves the nearest `.ant-card` ancestor: the Student Averages card (ready
 * overview), the `TaskHeatmapTable` card (ready heatmap), or the blocking fallback.
 *
 * @param {HTMLElement} control - The mode-control radiogroup.
 * @returns {HTMLElement} The nearest card ancestor hosting the control.
 */
function getModeControlCard(control: HTMLElement): HTMLElement {
  const card = control.closest('.ant-card');
  if (!(card instanceof HTMLElement)) {
    throw new TypeError('Mode control is not hosted in a card');
  }
  return card;
}

/**
 * Locates the sr-only description node by its stable id; the label is also
 * sr-only, so a bare `.sr-only` query would select the wrong element.
 *
 * @returns {Element | null} The description node, or null when absent.
 */
function getDescriptionNode(): Element | null {
  return document.querySelector(`#${MODE_CONTROL_DESCRIPTION_ID}`);
}

beforeEach(() => {
  mockUseClassPageData.mockImplementation(() => createReadyClassPageData());
  mockGetAssignment.mockImplementation(() => Promise.resolve(buildDefaultAssignmentFixture()));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ClassPage — Averages basis control', () => {
  it('places the control in the Student Averages card header in the overview view', () => {
    renderClassPage();

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    expect(screen.getAllByRole('radiogroup', { name: MODE_CONTROL_LABEL })).toHaveLength(1);

    const controlCard = getModeControlCard(control);
    // The control belongs to the Student Averages card, not a header slot.
    expect(within(controlCard).getByText('Student Averages')).toBeInTheDocument();
    const extra = controlCard.querySelector(':scope .ant-card-head .ant-card-extra');
    expect(extra).not.toBeNull();
    expect(extra).toContainElement(control);

    // The hosting card now sits below both header cards, not between them.
    const titleCard = screen.getByRole('heading', { name: CLASS_NAME }).closest('.ant-card');
    const navCard = screen.getByLabelText('Back to Classes').closest('.ant-card');
    if (!(titleCard instanceof Element) || !(navCard instanceof Element)) {
      throw new TypeError('Class page header cards are missing');
    }
    expect(
      titleCard.compareDocumentPosition(controlCard) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      navCard.compareDocumentPosition(controlCard) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders the two mode options with the current mode selected', () => {
    renderClassPage();

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    const radios = within(control).getAllByRole('radio');
    expect(radios).toHaveLength(MODE_OPTION_COUNT);

    // The control reflects the hook's analysis mode (absolute on arrival).
    expect(within(control).getByRole('radio', { name: ABSOLUTE_OPTION_LABEL })).toBeChecked();
    expect(within(control).getByRole('radio', { name: BASELINE_OPTION_LABEL })).not.toBeChecked();
  });

  it('re-runs the data hook with the selected mode when the user switches mode', async () => {
    const user = userEvent.setup();
    renderClassPage();

    const baselineOption = screen.getByRole('radio', { name: BASELINE_OPTION_LABEL });
    await user.click(baselineOption);

    expect(mockUseClassPageData).toHaveBeenLastCalledWith(CLASS_PAGE_CLASS_ID, 'topDecileBaseline');
  });

  it('keeps the control in the Student Averages card header after switching mode', async () => {
    const user = userEvent.setup();
    renderClassPage();

    await user.click(screen.getByRole('radio', { name: BASELINE_OPTION_LABEL }));

    // Placement is stable across mode changes: the real card still hosts the
    // control in its head `extra`, with a single control mounted.
    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    expect(screen.getAllByRole('radiogroup', { name: MODE_CONTROL_LABEL })).toHaveLength(1);
    const controlCard = getModeControlCard(control);
    expect(within(controlCard).getByText('Student Averages')).toBeInTheDocument();
    expect(controlCard.querySelector(':scope .ant-card-head .ant-card-extra')).toContainElement(
      control
    );
  });

  it('keeps the mode control rendered above the blocking result and enabled on retained evidence', () => {
    const analyserError: ClassPageError = {
      type: 'analyserError',
      cause: new Error('baseline derivation failed'),
    };
    mockUseClassPageData.mockReturnValue({
      ...createReadyClassPageData(),
      surfaceState: { status: 'blocking', error: analyserError },
      error: analyserError,
      adapterResult: null,
      analyserResult: null,
    });

    renderClassPage();

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    expect(screen.getAllByRole('radiogroup', { name: MODE_CONTROL_LABEL })).toHaveLength(1);
    const resultTitle = screen.getByText("Couldn't compute averages");

    // The header fallback precedes the blocking result in the stacked header.
    expect(
      control.compareDocumentPosition(resultTitle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // Retained evidence from the last successful result keeps the control enabled.
    expect(control).not.toHaveClass('ant-segmented-disabled');
  });

  it('hides the visible label while preserving the radiogroup accessible name', () => {
    renderClassPage();

    // No visual clutter: the label is visually hidden via `sr-only` but keeps
    // its stable id so the accessible name still resolves.
    const labelElement = screen.getByText(MODE_CONTROL_LABEL);
    expect(labelElement).toHaveClass('sr-only');
    expect(labelElement.id).toBe(MODE_CONTROL_LABEL_ID);

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    expect(control).toBeInTheDocument();
    expect(control.getAttribute('aria-labelledby')).toBe(MODE_CONTROL_LABEL_ID);
  });

  it('disables the control and binds the reason while data is awaited', () => {
    const analyserError: ClassPageError = {
      type: 'analyserError',
      cause: new Error('baseline derivation failed'),
    };
    mockUseClassPageData.mockReturnValue({
      ...createReadyClassPageData(),
      surfaceState: { status: 'blocking', error: analyserError },
      error: analyserError,
      adapterResult: null,
      analyserResult: null,
      baselineAvailability: AWAITING_DATA_AVAILABILITY,
    });

    renderClassPage();

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });

    // Disabled state surfaces as the root class plus disabled radio inputs —
    // neither antd nor the underlying control emits `aria-disabled`.
    expect(control).toHaveClass('ant-segmented-disabled');
    expect(control).not.toHaveAttribute('aria-disabled');
    for (const radio of within(control).getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }

    // The group label is bound via aria-labelledby.
    const labelElement = screen.getByText(MODE_CONTROL_LABEL);
    expect(control.getAttribute('aria-labelledby')).toBe(labelElement.id);

    // The reason is discoverable without hover: the sr-only description node
    // carries it and the control references it while disabled.
    const descriptionNode = getDescriptionNode();
    expect(descriptionNode).not.toBeNull();
    expect(descriptionNode).toHaveTextContent(AWAITING_DATA_REASON);
    expect(descriptionNode?.id).toBe(MODE_CONTROL_DESCRIPTION_ID);
    expect(control.getAttribute('aria-describedby')).toBe(descriptionNode?.id);
  });

  it('keeps the control enabled and leaves absolute selectable when ineligible', async () => {
    const user = userEvent.setup();
    // A shrunk roster makes baseline mode ineligible while baseline is the
    // selected mode: the control stays enabled so absolute remains reachable.
    mockUseClassPageData.mockImplementation((_classId: string, mode: string) => {
      return mode === 'topDecileBaseline'
        ? { ...createReadyClassPageData(), baselineAvailability: INELIGIBLE_AVAILABILITY }
        : createReadyClassPageData();
    });

    renderClassPage();

    await user.click(screen.getByRole('radio', { name: BASELINE_OPTION_LABEL }));
    expect(mockUseClassPageData).toHaveBeenLastCalledWith(CLASS_PAGE_CLASS_ID, 'topDecileBaseline');

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    const absoluteOption = within(control).getByRole('radio', { name: ABSOLUTE_OPTION_LABEL });
    const baselineOption = within(control).getByRole('radio', { name: BASELINE_OPTION_LABEL });

    // Only the baseline option is disabled; the control itself is not.
    expect(control).not.toHaveClass('ant-segmented-disabled');
    expect(control).not.toHaveAttribute('aria-disabled');
    expect(absoluteOption).toBeEnabled();
    expect(baselineOption).toBeDisabled();
    expect(baselineOption).toBeChecked();

    // The escape route works: selecting absolute switches the mode back.
    await user.click(absoluteOption);
    expect(mockUseClassPageData).toHaveBeenLastCalledWith(CLASS_PAGE_CLASS_ID, 'absolute');
  });

  it('ignores a click on the disabled baseline option when ineligible', async () => {
    const user = userEvent.setup();
    mockUseClassPageData.mockReturnValue({
      ...createReadyClassPageData(),
      baselineAvailability: INELIGIBLE_AVAILABILITY,
    });

    renderClassPage();

    const baselineOption = screen.getByRole('radio', { name: BASELINE_OPTION_LABEL });
    expect(baselineOption).toBeDisabled();

    const callsBeforeClick = mockUseClassPageData.mock.calls.length;
    await user.click(baselineOption);

    // The fail-fast guard is the disabled option: the mode never leaves absolute.
    expect(mockUseClassPageData).toHaveBeenCalledTimes(callsBeforeClick);
    expect(mockUseClassPageData).toHaveBeenLastCalledWith(CLASS_PAGE_CLASS_ID, 'absolute');
  });

  it('exposes the availability reason through the disabled baseline option tooltip', async () => {
    const user = userEvent.setup();
    mockUseClassPageData.mockReturnValue({
      ...createReadyClassPageData(),
      baselineAvailability: INELIGIBLE_AVAILABILITY,
    });

    renderClassPage();

    const baselineOption = screen.getByRole('radio', { name: BASELINE_OPTION_LABEL });
    const baselineOptionLabel = baselineOption.closest('label');
    if (!(baselineOptionLabel instanceof HTMLElement)) {
      throw new TypeError('Baseline option is not hosted in a label');
    }

    await user.hover(baselineOptionLabel);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(ROSTER_REASON);
  });

  it('renders the availability reason in the sr-only description node while ineligible', () => {
    mockUseClassPageData.mockReturnValue({
      ...createReadyClassPageData(),
      baselineAvailability: INELIGIBLE_AVAILABILITY,
    });

    renderClassPage();

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });

    // The description node always exists and carries the reason for ineligible.
    const descriptionNode = getDescriptionNode();
    expect(descriptionNode).not.toBeNull();
    expect(descriptionNode).toHaveTextContent(ROSTER_REASON);

    // The binding stays reserved for the disabled control state, so the reason
    // reaches assistive tech through the option tooltip instead.
    expect(control).not.toHaveAttribute('aria-describedby');
  });

  it('renders an always-present empty description node and no describedby binding while enabled', () => {
    renderClassPage();

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });

    expect(control).not.toHaveClass('ant-segmented-disabled');
    for (const radio of within(control).getAllByRole('radio')) {
      expect(radio).toBeEnabled();
    }

    // The binding is present exactly while disabled: absent when enabled.
    expect(control).not.toHaveAttribute('aria-describedby');

    // The description node itself is always rendered — empty while enabled.
    const descriptionNode = getDescriptionNode();
    expect(descriptionNode).not.toBeNull();
    expect(descriptionNode).toHaveTextContent('');
  });

  it('places the control in the heatmap table card header in the embedded heatmap view', async () => {
    const user = userEvent.setup();
    renderClassPage();
    await openHeatmapView(user);

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });
    expect(screen.getAllByRole('radiogroup', { name: MODE_CONTROL_LABEL })).toHaveLength(1);

    // The control belongs to the card wrapping the Task Heatmap table.
    const heatmapTable = screen.getByTestId('task-heatmap-table');
    const tableCard = heatmapTable.closest('.ant-card');
    if (!(tableCard instanceof Element)) {
      throw new TypeError('Task Heatmap table is not hosted in a card');
    }
    const extra = tableCard.querySelector('.ant-card-extra');
    expect(extra).not.toBeNull();
    expect(extra).toContainElement(control);
  });
});
