import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessTaskModal } from './AssessTaskModal';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { queryKeys } from '../../../query/queryKeys';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';
import { createAppQueryClient } from '../../../query/queryClient';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { createFixtureClassPartial } from '../../../test/classes/classesPageTestHelpers';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinitionPartials.zod';

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
}));

vi.mock('./matchDefinitionForAssignment', () => ({
  findMatchingDefinition: vi.fn(),
}));

const MOCK_CLASS_ID = 'class-123';
const MOCK_CLASS_NAME = 'My Class';
const MOCK_ASSIGNMENTS = [{ assignmentId: 'a1', title: 'Essay', topicName: 'Writing', topicId: null }];
const MOCK_EMPTY_ASSIGNMENTS: Array<{ assignmentId: string; title: string; topicId: string | null; topicName: string | null }> = [];
const MODAL_TITLE = `Assess Task — ${MOCK_CLASS_NAME}`;
const DEFAULT_ISO_DATETIME = '2025-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

/**
 * Creates an AssignmentDefinitionPartial fixture for cache-hit tests.
 *
 * @param {Partial<AssignmentDefinitionPartial>} overrides Fields to override.
 * @returns {AssignmentDefinitionPartial} A definition partial fixture.
 */
function createDefinitionPartial(
  overrides: Partial<AssignmentDefinitionPartial> = {}
): AssignmentDefinitionPartial {
  return {
    primaryTitle: 'Essay',
    primaryTopic: 'Writing',
    primaryTopicKey: 'topic-writing',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-001',
    templateDocumentId: 'tpl-001',
    assignmentWeighting: null,
    definitionKey: 'essay-def-key',
    tasks: null,
    createdAt: DEFAULT_ISO_DATETIME,
    updatedAt: DEFAULT_ISO_DATETIME,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Standard props
// ---------------------------------------------------------------------------

/**
 * Standard props for the modal in most tests.
 *
 * @param {Partial<{ open: boolean; classId: string; className: string; onClose: () => void }>} [overrides] Optional prop overrides.
 * @returns {object} The complete properties object with sensible defaults.
 */
function defaultProperties(overrides: Partial<{
  open: boolean;
  classId: string;
  className: string;
  onClose: () => void;
}> = {}) {
  return {
    open: true,
    classId: MOCK_CLASS_ID,
    className: MOCK_CLASS_NAME,
    onClose: vi.fn(),
    ...overrides,
  };
}

/** Returns a promise that never resolves — used for loading-state tests. */
function createPendingPromise<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/**
 * Creates a default query client and renders the modal via
 * `renderWithFrontendProviders` so `useQueryClient()` works inside
 * the component.
 *
 * @param {unknown} mockValue - Value to pass to mockReturnValue/mockResolvedValue/mockRejectedValue.
 * @param {'return' | 'resolve' | 'reject'} mockType - How to set up the mock.
 * @returns {ReturnType<typeof screen.getByRole>} The dialog element.
 */
function renderAssessTaskModal(
  mockValue: unknown,
  mockType: 'return' | 'resolve' | 'reject' = 'return'
): ReturnType<typeof screen.getByRole> {
  const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
  // mockValue is deliberately polymorphic (Promise, array, Error) so
  // each branch applies the narrowest type assertion needed by the mock.
  type AssignmentsPayload = { assignmentId: string; title: string; topicId: string | null; topicName: string | null }[];
  if (mockType === 'resolve') {
    mockedGetAssignments.mockResolvedValue(mockValue as AssignmentsPayload);
  } else if (mockType === 'reject') {
    mockedGetAssignments.mockRejectedValue(mockValue);
  } else {
    mockedGetAssignments.mockReturnValue(mockValue as Promise<AssignmentsPayload>);
  }

  renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);
  return screen.getByRole('dialog', { name: MODAL_TITLE });
}

/**
 * Creates a query client pre-populated with the given cache data and renders
 * the modal inside `renderWithFrontendProviders`. Returns the dialog and
 * query client for further interaction.
 *
 * @param {object} options Render options.
 * @param {Array<{ classId: string; yearGroupKey: string | null; className: string }> | undefined} [options.classPartials] Class partials to set in cache.
 * @param {AssignmentDefinitionPartial[] | undefined} [options.definitionPartials] Definition partials to set in cache.
 * @param {unknown} [options.assignments] Assignments to resolve from the service mock.
 * @param {{ kind: string; definition?: AssignmentDefinitionPartial; matches?: AssignmentDefinitionPartial[] } | undefined} [options.findMatchResult] The result from findMatchingDefinition.
 * @param {unknown} [options.startRunResult] The resolve/reject value for startAssessmentRun.
 * @param {'resolve' | 'reject'} [options.startRunType] Whether startAssessmentRun resolves or rejects.
 * @returns {{ dialog: HTMLElement; queryClient: QueryClient }} Dialog element and query client.
 */
// eslint-disable-next-line complexity -- Test helper with many optional parameters
function renderWithCache(
  options: {
    classPartials?: Array<{ classId: string; yearGroupKey: string | null; className: string | null }>;
    definitionPartials?: AssignmentDefinitionPartial[];
    assignments?: unknown;
    findMatchResult?: { kind: string; definition?: AssignmentDefinitionPartial; matches?: AssignmentDefinitionPartial[] };
    startRunResult?: unknown;
    startRunType?: 'resolve' | 'reject';
  } = {}
): { dialog: HTMLElement; queryClient: QueryClient } {
  const {
    classPartials,
    definitionPartials,
    assignments = MOCK_ASSIGNMENTS,
    findMatchResult,
    startRunResult,
    startRunType,
  } = options;

  vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(
    assignments as Array<{ assignmentId: string; title: string; topicId: string | null; topicName: string | null }>
  );

  if (findMatchResult !== undefined) {
    vi.mocked(findMatchingDefinition).mockReturnValue(findMatchResult as ReturnType<typeof findMatchingDefinition>);
  }

  if (startRunType === 'reject') {
    vi.mocked(startAssessmentRun).mockRejectedValue(startRunResult);
  } else if (startRunResult !== undefined) {
    vi.mocked(startAssessmentRun).mockResolvedValue(startRunResult as null);
  }

  const queryClient = createAppQueryClient();
  if (classPartials !== undefined) {
    queryClient.setQueryData(queryKeys.classPartials(), classPartials);
  }
  if (definitionPartials !== undefined) {
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), definitionPartials);
  }

  const { queryClient: returnedClient } = renderWithFrontendProviders(
    <AssessTaskModal {...defaultProperties()} />,
    { queryClient }
  );

  return {
    dialog: screen.getByRole('dialog', { name: MODAL_TITLE }),
    queryClient: returnedClient,
  };
}

/**
 * Selects an assignment in the dropdown and waits for Start Assessment to
 * become enabled.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 * @returns {Promise<void>} Resolves when the button is enabled.
 */
async function selectAssignment(dialog: HTMLElement): Promise<void> {
  await within(dialog).findByRole('combobox');
  fireEvent.mouseDown(within(dialog).getByRole('combobox'));
  const option = await screen.findByText('Essay');
  fireEvent.click(option);
  await waitFor(() => {
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeEnabled();
  });
}

/**
 * Clicks the Start Assessment button.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 */
function clickStartAssessment(dialog: HTMLElement): void {
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Start Assessment' })
  );
}

/**
 * Asserts that the Start Assessment button is disabled within the given dialog.
 *
 * @param {ReturnType<typeof screen.getByRole>} dialog - The modal dialog element.
 */
function expectStartAssessmentDisabled(dialog: ReturnType<typeof screen.getByRole>): void {
  expect(
    within(dialog).getByRole('button', { name: 'Start Assessment' })
  ).toBeDisabled();
}

/**
 * Asserts that the Cancel button is present within the given dialog.
 *
 * @param {ReturnType<typeof screen.getByRole>} dialog - The modal dialog element.
 */
function expectCancelButtonPresent(dialog: ReturnType<typeof screen.getByRole>): void {
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Modal Shell
// ---------------------------------------------------------------------------

describe('AssessTaskModal shell', () => {
  it('renders with correct title including className', () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockReturnValue(createPendingPromise());

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);

    expect(screen.getByRole('dialog', { name: MODAL_TITLE })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading State
// ---------------------------------------------------------------------------

describe('Loading state', () => {
  it('shows Spin centred in modal body, Select not rendered, Start Assessment disabled', () => {
    const dialog = renderAssessTaskModal(createPendingPromise());

    // Spin is visible in the modal body
    expect(within(dialog).getByRole('status')).toBeInTheDocument(); // Ant Spin renders role="status"

    // Select (combobox) is not rendered while loading
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Ready State (no selection)
// ---------------------------------------------------------------------------

describe('Ready state (no selection)', () => {
  it('shows Select with placeholder, Start Assessment disabled, and Select label', async () => {
    const dialog = renderAssessTaskModal(MOCK_ASSIGNMENTS, 'resolve');

    // Wait for Select (combobox) to appear after fetch resolves
    const select = await within(dialog).findByRole('combobox');
    expect(select).toBeInTheDocument();

    // antd v6 places role="combobox" on a void <input> element
    // (no textContent, no placeholder attribute). The placeholder
    // text is rendered as a visible span, so find it via getByText.
    expect(within(dialog).getByText('Select an assignment')).toBeInTheDocument();

    // "Select assignment" label is visible above the Select
    expect(within(dialog).getByText('Select assignment')).toBeInTheDocument();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Ready State (selection made)
// ---------------------------------------------------------------------------

describe('Ready state (selection made)', () => {
  it('enables Start Assessment and shows confirmation text when an assignment is selected', async () => {
    const dialog = renderAssessTaskModal(MOCK_ASSIGNMENTS, 'resolve');

    // Wait for the Select to appear
    await within(dialog).findByRole('combobox');

    // Open the Select dropdown
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));

    // Select the assignment option by its label
    const option = await screen.findByText('Essay');
    fireEvent.click(option);

    // After selection, Start Assessment should be enabled
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Start Assessment' })
      ).toBeEnabled();
    });

    // antd v6 renders the selected value in multiple DOM locations
    // (aria-live span, Select display, etc.). Use getAllByText and
    // verify at least one match exists.
    const essayMatches = within(dialog).getAllByText('Essay');
    expect(essayMatches.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

describe('Empty state', () => {
  it('shows Empty component with message and disabled Start Assessment', async () => {
    const dialog = renderAssessTaskModal(MOCK_EMPTY_ASSIGNMENTS, 'resolve');

    // Empty component message
    expect(
      await within(dialog).findByText('No assignments found for this class')
    ).toBeInTheDocument();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

describe('Error state', () => {
  it('shows Alert with error, Select not rendered, Start Assessment disabled', async () => {
    const dialog = renderAssessTaskModal(new Error('Failed to fetch assignments'), 'reject');

    // Error Alert is visible
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();

    // Select (combobox) is not rendered in error state
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Interaction: Cancel and Mask Click
// ---------------------------------------------------------------------------

describe('Cancel and close', () => {
  it('calls onClose when Cancel button is clicked', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    const onClose = vi.fn();

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />);

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox'); // wait for ready state

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Ant Design v6 renders modals in a React portal. @rc-component/dialog
  // listens for mousedown+click on the .ant-modal-wrap. Because portal
  // event propagation interacts differently with React's synthetic event
  // system in JSDOM, we use native dispatchEvent to ensure the handlers fire.
  it('calls onClose when modal backdrop is clicked', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    const onClose = vi.fn();

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />);

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');

    const wrap = dialog.closest('.ant-modal-wrap');
    expect(wrap).not.toBeNull();

    await act(async () => {
      wrap!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      wrap!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      wrap!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Interaction: Fetch on Open
// ---------------------------------------------------------------------------

describe('Fetch on open', () => {
  it('calls getGoogleClassroomAssignments with classId when modal opens', () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockReturnValue(createPendingPromise());

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);

    expect(mockedGetAssignments).toHaveBeenCalledWith(MOCK_CLASS_ID);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Interaction: Reopen Resets State
// ---------------------------------------------------------------------------

describe('Reopen resets state', () => {
  it('triggers fresh fetch with new classId when modal reopens for a different class', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);

    const queryClient = createAppQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties()} />
      </QueryClientProvider>
    );

    // Verify initial fetch
    expect(mockedGetAssignments).toHaveBeenCalledWith(MOCK_CLASS_ID);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(1);

    // Close the modal
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ open: false })} />
      </QueryClientProvider>
    );

    // Reopen with a different classId
    const newClassId = 'class-456';
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal
          {...defaultProperties({ open: true, classId: newClassId })}
        />
      </QueryClientProvider>
    );

    // Should trigger a fresh fetch with the new classId
    const expectedFetchCountAfterReopen = 2;
    expect(mockedGetAssignments).toHaveBeenCalledWith(newClassId);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(expectedFetchCountAfterReopen);
  });
});

// ---------------------------------------------------------------------------
// Assessment Run Interaction
// ---------------------------------------------------------------------------

describe('Assessment run interaction', () => {
  // -----------------------------------------------------------------------
  // Cache miss cases
  // -----------------------------------------------------------------------

  it('shows error Alert when classPartials cache is empty', async () => {
    const { dialog } = renderWithCache({
      classPartials: undefined,
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'matched', definition: createDefinitionPartial() },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  it('shows error Alert with specific message when classId is not found in cached classPartials', async () => {
    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: 'other-class', yearGroupKey: 'year-10' })],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'matched', definition: createDefinitionPartial() },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Class not found in cached data');
  });

  it('shows error Alert when assignmentDefinitionPartials cache is empty', async () => {
    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: undefined,
      findMatchResult: { kind: 'matched', definition: createDefinitionPartial() },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Null topic / null year group
  // -----------------------------------------------------------------------

  it('shows no-match error Alert when assignment has null topicName', async () => {
    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: [createDefinitionPartial()],
      // findMatchResult is intentionally omitted: the component returns early
      // before findMatchingDefinition is called because topicName is null.
      assignments: [{ assignmentId: 'a1', title: 'Essay', topicName: null, topicId: null }],
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    // The alert should indicate this assignment cannot be assessed because
    // it has no topic set in Google Classroom.
    expect(alert).toHaveTextContent(/no.*topic|topic.*null|no.*match/i);
  });

  it('shows error Alert with specific message when class has null yearGroupKey', async () => {
    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: null })],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Cannot determine year group for this class');
  });

  // -----------------------------------------------------------------------
  // Match results
  // -----------------------------------------------------------------------

  it('shows error Alert when findMatchingDefinition returns no-match', async () => {
    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await expect(within(dialog).findByRole('alert')).resolves.toBeInTheDocument();
  });

  it('shows error Alert when findMatchingDefinition returns ambiguous match', async () => {
    const definitionOne = createDefinitionPartial({ definitionKey: 'def-1' });
    const definitionTwo = createDefinitionPartial({ definitionKey: 'def-2' });

    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: [definitionOne, definitionTwo],
      findMatchResult: { kind: 'ambiguous', matches: [definitionOne, definitionTwo] },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // API call results
  // -----------------------------------------------------------------------

  it('shows success Alert and single Close button when match + API succeeds', async () => {
    const matchedDefinition = createDefinitionPartial();
    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: null,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Success alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();

    // Footer should have only Close button (no Cancel or Start Assessment)
    await waitFor(() => {
      expect(
        within(dialog).queryByRole('button', { name: 'Cancel' })
      ).toBeNull();
      expect(
        within(dialog).queryByRole('button', { name: 'Start Assessment' })
      ).toBeNull();
    });

    // Scope Close button query to footer to avoid clashing with the modal's
    // built-in X close button which also has accessible name "Close".
    const footer = dialog.querySelector('.ant-modal-footer');
    expect(footer).not.toBeNull();
    expect(
      within(footer as HTMLElement).getByRole('button', { name: 'Close' })
    ).toBeInTheDocument();
  });

  it('shows warning Alert when startAssessmentRun rejects with DefinitionStaleError', async () => {
    const matchedDefinition = createDefinitionPartial();
    const staleError = new ApiTransportError({
      requestId: 'test-id',
      error: { code: 'DEFINITION_STALE', message: 'Definition is stale' },
    });

    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: staleError,
      startRunType: 'reject',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await expect(within(dialog).findByRole('alert')).resolves.toBeInTheDocument();
  });

  it('shows error Alert when startAssessmentRun rejects with generic API error', async () => {
    const matchedDefinition = createDefinitionPartial();
    const genericError = new Error('Something went wrong');

    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: genericError,
      startRunType: 'reject',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await expect(within(dialog).findByRole('alert')).resolves.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Loading state during API call
  // -----------------------------------------------------------------------

  it('shows loading on Start Assessment button during API call, reverts on completion', async () => {
    const matchedDefinition = createDefinitionPartial();
    let resolveRun!: (value: null) => void;
    const pendingRun = new Promise<null>((resolve) => {
      resolveRun = resolve;
    });
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    const { dialog } = renderWithCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // During API call, button should show loading state.
    // Ant Design appends "loading" to the accessible name when loading.
    const button = within(dialog).getByRole('button', { name: 'loading Start Assessment' });
    expect(button).toBeDisabled();

    // Resolve the API call
    await act(async () => {
      resolveRun(null);
    });

    // After completion, loading should be gone (success state shown)
    const footer = dialog.querySelector('.ant-modal-footer');
    expect(footer).not.toBeNull();
    await waitFor(() => {
      expect(
        within(footer as HTMLElement).getByRole('button', { name: 'Close' })
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Success state: Close button behaviour
// ---------------------------------------------------------------------------

describe('Success state close', () => {
  it('calls onClose when Close button is clicked in success state', async () => {
    const matchedDefinition = createDefinitionPartial();
    const onClose = vi.fn();

    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);

    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'matched', definition: matchedDefinition });
    vi.mocked(startAssessmentRun).mockResolvedValue(null);

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [matchedDefinition]);

    renderWithFrontendProviders(
      <AssessTaskModal {...defaultProperties({ onClose })} />,
      { queryClient }
    );

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Wait for success state — find the Close button in the footer
    const footer = dialog.querySelector('.ant-modal-footer');
    expect(footer).not.toBeNull();
    const closeButton = await within(footer as HTMLElement).findByRole('button', { name: 'Close' });

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Footer: Buttons in Non-Success States
// ---------------------------------------------------------------------------

describe('Footer buttons across states', () => {
  it('renders Cancel and Start Assessment in loading, error, empty, and ready states', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);

    // Test loading state — use a fresh render
    mockedGetAssignments.mockReturnValue(createPendingPromise());
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);
    let dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    cleanup();

    // Test error state — separate render
    mockedGetAssignments.mockRejectedValue(new Error('Failed'));
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="error" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('alert');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    cleanup();

    // Test empty state — separate render
    mockedGetAssignments.mockResolvedValue(MOCK_EMPTY_ASSIGNMENTS);
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="empty" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByText('No assignments found for this class');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    cleanup();

    // Test ready state (no selection) — separate render
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="ready-no-sel" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    // Test ready state (selection made) — same render, just interact
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    const option = await screen.findByText('Essay');
    fireEvent.click(option);
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Start Assessment' })
      ).toBeEnabled();
    });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();
  });
});
