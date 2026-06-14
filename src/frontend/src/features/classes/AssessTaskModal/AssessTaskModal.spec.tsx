import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
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
import type { AssignmentTopic } from '../../../services/referenceData/referenceData.zod';
import type { GoogleClassroomAssignmentsResponse } from '../../../services/googleClassrooms/googleClassroomAssignments.zod';
import {
  MOCK_CLASS_ID,
  MOCK_ASSIGNMENTS,
  MOCK_EMPTY_ASSIGNMENTS,
  MODAL_TITLE,
  createDefinitionPartial,
  defaultProperties,
  createPendingPromise,
  renderAssessTaskModal,
  renderWithCache,
  selectAssignment,
  clickStartAssessment,
  expectStartAssessmentDisabled,
  expectCancelButtonPresent,
} from '../../../test/classes/AssessTaskModal.test-utilities';

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
}));

vi.mock('./matchDefinitionForAssignment', () => ({
  findMatchingDefinition: vi.fn(),
}));

/**
 * Removes function values from an object, replacing them with a marker,
 * so the remaining object can be safely JSON-serialized.
 *
 * @param {Record<string, unknown>} object The object to clean.
 * @returns {Record<string, unknown>} A new object with functions removed.
 */
function stripFunctions(object: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (typeof value !== 'function') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

vi.mock('../../assignmentWizard/AssignmentDefinitionWizardModal', () => ({
  AssignmentDefinitionWizardModal: vi.fn((properties: Record<string, unknown>) => {
    // Store ALL props (including functions) on the element via ref
    // so tests can access function references directly.
    const elementReference = (element: HTMLDivElement | null) => {
      if (element) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element as any).__wizardProps = properties;
      }
    };

    return (
      <div
        ref={elementReference}
        data-testid="wizard-mock"
        data-props={JSON.stringify(stripFunctions(properties))}
      />
    );
  }),
}));

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
      expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
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
        <AssessTaskModal {...defaultProperties({ open: true, classId: newClassId })} />
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
      classPartials: [
        createFixtureClassPartial({ classId: 'other-class', yearGroupKey: 'year-10' }),
      ],
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
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
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
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
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

  it('shows error Alert when findMatchingDefinition returns ambiguous match', async () => {
    const definitionOne = createDefinitionPartial({ definitionKey: 'def-1' });
    const definitionTwo = createDefinitionPartial({ definitionKey: 'def-2' });

    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
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
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
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
      expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(within(dialog).queryByRole('button', { name: 'Start Assessment' })).toBeNull();
    });

    // Scope Close button query to footer to avoid clashing with the modal's
    // built-in X close button which also has accessible name "Close".
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows warning Alert when startAssessmentRun rejects with DefinitionStaleError', async () => {
    const matchedDefinition = createDefinitionPartial();
    const staleError = new ApiTransportError({
      requestId: 'test-id',
      error: { code: 'DEFINITION_STALE', message: 'Definition is stale' },
    });

    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
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
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
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
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
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
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    await waitFor(() => {
      expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// No-match resolution — choice state
// ---------------------------------------------------------------------------

describe('No-match resolution — choice state', () => {
  it('shows choice prompt with Alert, Create New Definition button, and disabled Link to Existing button when findMatchingDefinition returns no-match', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // An info Alert should explain the no-match situation
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/no matching assignment definition found/i);
    expect(alert).toHaveTextContent(/Essay/);

    // Two choice buttons should be visible
    expect(within(dialog).getByRole('button', { name: 'Create New Definition' })).toBeInTheDocument();

    const linkButton = within(dialog).getByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toBeDisabled();
  });

  it('hides assignment Select and shows only Cancel in footer during choice state', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Assignment Select should NOT be visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    // Footer should only have Cancel (no Start Assessment)
    expectCancelButtonPresent(dialog);
    expect(within(dialog).queryByRole('button', { name: /start assessment/i })).toBeNull();
  });

  it('transitions to creating state when Create New Definition is clicked', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Click "Create New Definition" — this should transition to 'creating'
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Once in creating state, the choice buttons should be gone
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
    });

    // The choice prompt Alert should also be gone — body content changed from choice to creating
    expect(within(dialog).queryByText(/no matching assignment definition found/i)).toBeNull();

    // The assignment Select remains hidden (was hidden in choice, stays hidden in creating)
    expect(within(dialog).queryByRole('combobox')).toBeNull();
  });

  it('shows Link to Existing button disabled with Tooltip Coming soon', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const linkButton = within(dialog).getByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeDisabled();

    // Hover over the button wrapper to trigger the Tooltip
    const buttonParent = linkButton.parentElement;
    if (buttonParent) {
      fireEvent.pointerEnter(buttonParent);
    }

    // Tooltip should show "Coming soon" text
    await screen.findByText('Coming soon');
  });

  it('reopens modal and resets noMatchResolution to idle', async () => {
    const onClose = vi.fn();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);
    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [createDefinitionPartial()]);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ onClose })} />
      </QueryClientProvider>
    );

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Verify the choice prompt is shown
    expect(within(dialog).getByRole('button', { name: 'Create New Definition' })).toBeInTheDocument();

    // Close the modal
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ open: false, onClose })} />
      </QueryClientProvider>
    );

    // Reopen with the same classId
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ onClose })} />
      </QueryClientProvider>
    );

    const reopenedDialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(reopenedDialog).findByRole('combobox');

    // noMatchResolution should be reset to 'idle', so choice prompt is NOT shown
    expect(within(reopenedDialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
  });

  it('reopens modal and resets assessmentState to idle', async () => {
    const onClose = vi.fn();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);
    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [createDefinitionPartial()]);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ onClose })} />
      </QueryClientProvider>
    );

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Close the modal
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ open: false, onClose })} />
      </QueryClientProvider>
    );

    // Reopen with the same classId
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ onClose })} />
      </QueryClientProvider>
    );

    const reopenedDialog = await screen.findByRole('dialog', { name: MODAL_TITLE });

    // assessmentState should be 'idle', so Select is visible and no Alert
    await within(reopenedDialog).findByRole('combobox');
    expect(within(reopenedDialog).queryByRole('alert')).toBeNull();
  });

  it('initial noMatchResolution is idle — matched flow succeeds without choice prompt', async () => {
    const matchedDefinition = createDefinitionPartial();
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: null,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // The choice prompt must NOT appear — confirming noMatchResolution starts as 'idle'.
    // If noMatchResolution were 'choice', the choice prompt would render instead of
    // the normal success flow after a matched definition is found.
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
      expect(within(dialog).queryByRole('button', { name: 'Link to Existing Definition' })).toBeNull();
      expect(within(dialog).queryByText(/no matching assignment definition found/i)).toBeNull();
    });

    // Success state should appear (standard matched flow)
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
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

    vi.mocked(findMatchingDefinition).mockReturnValue({
      kind: 'matched',
      definition: matchedDefinition,
    });
    vi.mocked(startAssessmentRun).mockResolvedValue(null);

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [matchedDefinition]);

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />, {
      queryClient,
    });

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Wait for success state — find the Close button in the footer
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    const closeButton = await within(footer!).findByRole('button', { name: 'Close' });

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
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    cleanup();

    // Test error state — separate render
    mockedGetAssignments.mockRejectedValue(new Error('Failed'));
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="error" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('alert');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    cleanup();

    // Test empty state — separate render
    mockedGetAssignments.mockResolvedValue(MOCK_EMPTY_ASSIGNMENTS);
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="empty" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByText('No assignments found for this class');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    cleanup();

    // Test ready state (no selection) — separate render
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="ready-no-sel" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    // Test ready state (selection made) — same render, just interact
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    const option = await screen.findByText('Essay');
    fireEvent.click(option);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
    });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// No-match resolution — creating state and wizard integration
// ---------------------------------------------------------------------------

describe('No-match resolution — creating state and wizard integration', () => {
  it('renders wizard with mode="create" and correct initialValues when topicId matches cache', async () => {
    const assignments: GoogleClassroomAssignmentsResponse = [
      { assignmentId: 'a1', title: 'Essay', topicName: 'Writing', topicId: 'topic-writing' },
    ];

    const { dialog, queryClient } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      assignments,
      findMatchResult: { kind: 'no-match' },
    });

    // Populate topics cache with a matching topic
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [
      { key: 'topic-writing', name: 'Writing', yearGroupKeys: ['year-10'] },
    ]);

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Wait for choice state, then click "Create New Definition"
    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // The wizard mock should now be rendered inside the dialog
    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};

    expect(properties.mode).toBe('create');
    expect(properties.open).toBe(true);
    expect(properties.definitionKey).toBeNull();
    expect(properties.initialValues).toEqual({
      title: 'Essay',
      topic: 'topic-writing',
      yearGroup: 'year-10',
    });
    expect(typeof properties.onCreateSuccess).toBe('function');
    expect(typeof properties.onClose).toBe('function');
  });

  it('leaves topic field empty when topicId is not in the assignmentTopics cache', async () => {
    const assignments: GoogleClassroomAssignmentsResponse = [
      { assignmentId: 'a1', title: 'Essay', topicName: 'Writing', topicId: 'unknown-topic' },
    ];

    const { dialog, queryClient } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      assignments,
      findMatchResult: { kind: 'no-match' },
    });

    // Populate topics cache but with NO matching topic
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [
      { key: 'topic-maths', name: 'Maths', yearGroupKeys: ['year-10'] },
      { key: 'topic-science', name: 'Science', yearGroupKeys: ['year-10'] },
    ]);

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};

    // Topic should NOT be present in initialValues when not found in cache
    expect(properties.initialValues).toEqual({
      title: 'Essay',
      yearGroup: 'year-10',
    });
    expect(properties.initialValues.topic).toBeUndefined();
  });

  it('leaves topic field empty when topicId is null', async () => {
    const { dialog, queryClient } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
      assignments: [{ assignmentId: 'a1', title: 'Essay', topicName: 'Writing', topicId: null }],
    });

    // Populate assignmentTopics cache so the test validates the correct code path
    // — topicId is null, so topic should remain blank even when topics are cached.
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [
      { key: 'topic-writing', name: 'Writing', yearGroupKeys: ['year-10'] },
    ]);

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};

    // Topic should NOT be in initialValues when topicId is null
    expect(properties.initialValues).toEqual({
      title: 'Essay',
      yearGroup: 'year-10',
    });
    expect(properties.initialValues.topic).toBeUndefined();
  });

  it('calls startAssessmentRun and shows success state when wizard saves successfully', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
      startRunResult: null,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Get the wizard mock and invoke onCreateSuccess to trigger auto-assessment
    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};
    properties.onCreateSuccess('new-def-key');

    // startAssessmentRun should have been called with the new definition key
    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledWith({
        definitionKey: 'new-def-key',
        assignmentId: 'a1',
        courseId: MOCK_CLASS_ID,
      });
    });

    // Success state should be shown
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/assessment started for/i);
    expect(alert).toHaveTextContent(/Essay/);

    // Footer should show Close button only
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows error state when startAssessmentRun fails after wizard creates definition', async () => {
    const apiError = new Error('API failure');
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
      startRunResult: apiError,
      startRunType: 'reject',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Get the wizard mock and invoke onCreateSuccess
    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};
    properties.onCreateSuccess('new-def-key');

    // Error alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('API failure');
  });

  it('returns to choice state when wizard is cancelled', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Get the wizard mock and call onClose to simulate wizard cancel
    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};

    // Simulate wizard cancel (onClose fires without onCreateSuccess having been called)
    properties.onClose();

    // Should return to choice state — choice buttons appear again
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Create New Definition' })
      ).toBeInTheDocument();
    });

    // The wizard mock should be unmounted
    expect(screen.queryByTestId('wizard-mock')).toBeNull();
  });

  it('calls modal onClose when Cancel is clicked during creating state', async () => {
    const onClose = vi.fn();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);
    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [createDefinitionPartial()]);

    renderWithFrontendProviders(
      <AssessTaskModal {...defaultProperties({ onClose })} />,
      { queryClient }
    );

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Now in creating state — click Cancel in the AssessTaskModal footer
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows correct UI during auto-assessment loading and final state after resolution', async () => {
    let resolveRun!: (value: null) => void;
    const pendingRun = new Promise<null>((resolve) => {
      resolveRun = resolve;
    });
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'no-match' },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Get the wizard mock and invoke onCreateSuccess to trigger auto-assessment
    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};
    properties.onCreateSuccess('new-def-key');

    // During loading: the wizard mock should be unmounted
    expect(screen.queryByTestId('wizard-mock')).toBeNull();

    // During loading: assignment Select NOT visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    // During loading: footer shows Cancel + disabled Start Assessment
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const startButton = within(dialog).getByRole('button', { name: /start assessment/i });
    expect(startButton).toBeDisabled();

    // Resolve the API call
    await act(async () => {
      resolveRun(null);
    });

    // After resolution: success state shown
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/assessment started for/i);

    // Footer should show Close button only
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    await waitFor(() => {
      expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  it('calls modal onClose when outer Cancel is clicked during auto-assessment loading', async () => {
    const onClose = vi.fn();

    // Mock startAssessmentRun with a pending promise so auto-assessment stays loading
    const pendingRun = new Promise<null>(() => {});
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);
    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [createDefinitionPartial()]);

    renderWithFrontendProviders(
      <AssessTaskModal {...defaultProperties({ onClose })} />,
      { queryClient }
    );

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await within(dialog).findByRole('button', { name: 'Create New Definition' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Get the wizard mock and invoke onCreateSuccess to trigger auto-assessment
    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = (wizard as any).__wizardProps || {};
    properties.onCreateSuccess('test-key');

    // During auto-assessment loading, Cancel should be in the footer
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    // Click Cancel — the outer modal's Cancel during creating+loading calls onClose
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
