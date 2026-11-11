/**
 * Mode-control slot specs for the Class page header (`ClassPage`).
 *
 * Covers the attempt-baseline mode control's DOM contract in the always-rendered
 * header slot (attempt-baseline layout specification, "Class-page header —
 * mode-control slot"): the slot placement between the title card and the nav
 * card, the two labelled options with the current mode selected, the mode-change
 * wiring into `useClassPageData`, the slot's presence in the blocking view and
 * the embedded heatmap view, and the disabled-state affordances (root disabled
 * class and disabled radio inputs rather than an `aria-disabled` attribute, the
 * always-rendered sr-only description node, and the `aria-describedby` binding
 * that is present exactly while the control is disabled), and the
 * ineligible-state escape route (the control stays enabled while only the
 * baseline option is disabled, carrying the reason in its tooltip).
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

const CLASS_PAGE_CLASS_ID = 'class-1';
const CLASS_NAME = 'Class A';
const RECENT_ASSIGNMENT_NAME = 'Assignment One';

// Visible control copy pinned by the attempt-baseline layout specification
// (copy home: `pageContent` under `classDetail`).
const MODE_CONTROL_LABEL = 'Averages basis';
const ABSOLUTE_OPTION_LABEL = 'All tasks';
const BASELINE_OPTION_LABEL = 'Baseline tasks';

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
  mockStudentAveragesTableCard,
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
    mockStudentAveragesTableCard: vi.fn(function MockStudentAveragesTableCard() {
      return createElement('div', { 'data-testid': 'student-averages-table-card' });
    }),
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

vi.mock('@/ClassSelectionContext', () => {
  return {
    useClassSelection: mockUseClassSelection,
  };
});

vi.mock('@/services/assignmentAssessment/assignmentAssessmentService', () => {
  return {
    getAssignment: mockGetAssignment,
  };
});

vi.mock('./StudentAveragesTableCard', () => {
  return {
    StudentAveragesTableCard: mockStudentAveragesTableCard,
  };
});

vi.mock('../taskHeatmap/TaskHeatmapTable', () => {
  return {
    TaskHeatmapTable: mockTaskHeatmapTable,
  };
});

/** Zero-data display metric used by the recent-assignment card fixture. */
const NO_DATA_METRIC: ClassPageAdapterResult['studentAverages'][number]['metrics']['completeness'] =
  {
    state: 'notAttempted',
    value: 'N',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
  };

/** The recent-assignment card shown in the Class page overview. */
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

/** Availability state of an eligible class (control enabled, no reason). */
const READY_AVAILABILITY = { status: 'ready' as const, reason: null };

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
 * Clicks the recent-assignment card so the Class page switches to its
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
 * Locates the mode-control card that hosts the labelled control.
 *
 * @param {HTMLElement} control - The mode-control radiogroup.
 * @returns {Element} The card element wrapping the control slot.
 */
function getModeControlCard(control: HTMLElement): Element {
  const card = control.closest('.ant-card');
  if (!(card instanceof Element)) {
    throw new TypeError('Mode-control slot is not hosted in a card');
  }
  return card;
}

beforeEach(() => {
  mockUseClassPageData.mockImplementation(() => createReadyClassPageData());
  mockGetAssignment.mockImplementation(() => Promise.resolve(buildDefaultAssignmentFixture()));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ClassPage — mode-control slot', () => {
  it('renders the labelled mode control between the title card and the nav card in the overview view', () => {
    renderClassPage();

    const control = screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL });

    const titleCard = screen.getByRole('heading', { name: CLASS_NAME }).closest('.ant-card');
    const controlCard = getModeControlCard(control);
    const navCard = screen.getByLabelText('Back to Classes').closest('.ant-card');
    if (!(titleCard instanceof Element) || !(navCard instanceof Element)) {
      throw new TypeError('Class page header cards are missing');
    }

    // The slot sits between PageTitleCard and PageNavCard in the stacked header.
    expect(
      titleCard.compareDocumentPosition(controlCard) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      navCard.compareDocumentPosition(controlCard) & Node.DOCUMENT_POSITION_PRECEDING
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
    const resultTitle = screen.getByText("Couldn't compute averages");

    // The control precedes the blocking result in the stacked header.
    expect(
      control.compareDocumentPosition(resultTitle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // Retained evidence from the last successful result keeps the control enabled.
    expect(control).not.toHaveClass('ant-segmented-disabled');
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

    // The visible group label is bound via aria-labelledby.
    const labelElement = screen.getByText(MODE_CONTROL_LABEL);
    expect(control.getAttribute('aria-labelledby')).toBe(labelElement.id);

    // The reason is discoverable without hover: the sr-only description node
    // carries it and the control references it while disabled.
    const descriptionNode = document.querySelector('.sr-only');
    expect(descriptionNode).not.toBeNull();
    expect(descriptionNode).toHaveTextContent(AWAITING_DATA_REASON);
    expect(descriptionNode?.id).toBeTruthy();
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
    const descriptionNode = getModeControlCard(control).querySelector('.sr-only');
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
    const descriptionNode = getModeControlCard(control).querySelector('.sr-only');
    expect(descriptionNode).not.toBeNull();
    expect(descriptionNode).toHaveTextContent('');
  });

  it('keeps the mode control rendered in the embedded heatmap view', async () => {
    const user = userEvent.setup();
    renderClassPage();
    await openHeatmapView(user);

    expect(screen.getByRole('radiogroup', { name: MODE_CONTROL_LABEL })).toBeInTheDocument();
  });
});
